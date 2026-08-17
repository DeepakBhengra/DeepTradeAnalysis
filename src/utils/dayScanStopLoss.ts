import type {
  Candle,
  DeepakDayScanTrade,
  DayScanSimulationExit,
  DayScanSimulationPayload,
  DayScanSimulationSignal,
  IndicatorSnapshot,
} from "../types.js";
import { formatIstTime, getIstTimeParts, isWithinIstSessionWindow } from "./marketTime.js";
import { candleMidPrice } from "./sessionMarkPrice.js";
import {
  isStopLossHit,
  normalizeStopLossPct,
} from "./stopLossPct.js";

type TradeLike = Pick<
  DeepakDayScanTrade,
  | "side"
  | "entryTimeIst"
  | "entryPrice"
  | "exitTimeIst"
  | "exitPrice"
  | "targetHit"
  | "profit"
  | "exitReason"
  | "stopLossHit"
>;

export interface SessionMarkBar {
  timeIst: string;
  price: number;
}

function compareIstTime(left: string, right: string): number {
  return left.localeCompare(right);
}

function roundTripProfit(
  side: "BUY" | "SELL",
  entryPrice: number,
  exitPrice: number,
): number {
  if (side === "BUY") {
    return exitPrice - entryPrice;
  }
  return entryPrice - exitPrice;
}

/** Session mid bars for a date, chronological. */
export function sessionMarkBarsFromSnapshots(
  snapshots: Array<Pick<IndicatorSnapshot, "timestamp" | "high" | "low">>,
  dateKey: string,
  sessionStart = "09:15",
  sessionEnd = "15:30",
): SessionMarkBar[] {
  const bars: SessionMarkBar[] = [];
  for (const snap of snapshots) {
    if (!isWithinIstSessionWindow(snap.timestamp, sessionStart, sessionEnd)) {
      continue;
    }
    if (getIstTimeParts(snap.timestamp).dateKey !== dateKey) {
      continue;
    }
    bars.push({
      timeIst: formatIstTime(snap.timestamp),
      price: candleMidPrice(snap),
    });
  }
  return bars;
}

export function sessionMarkBarsFromCandles(
  candles: Array<Pick<Candle, "timestamp" | "high" | "low">>,
  dateKey: string,
  sessionStart = "09:15",
  sessionEnd = "15:30",
): SessionMarkBar[] {
  return sessionMarkBarsFromSnapshots(candles, dateKey, sessionStart, sessionEnd);
}

/**
 * First session bar at/after entry where adverse move ≥ stop-loss %,
 * only if that bar is strictly earlier than an existing strategy exit.
 */
export function findStopLossExitBar(
  trade: Pick<
    TradeLike,
    "side" | "entryTimeIst" | "entryPrice" | "exitTimeIst"
  >,
  bars: SessionMarkBar[],
  stopLossPct: number | null | undefined,
): SessionMarkBar | null {
  const threshold = normalizeStopLossPct(stopLossPct);
  if (threshold == null) {
    return null;
  }

  for (const bar of bars) {
    if (compareIstTime(bar.timeIst, trade.entryTimeIst) < 0) {
      continue;
    }
    if (
      trade.exitTimeIst != null &&
      compareIstTime(trade.exitTimeIst, bar.timeIst) <= 0
    ) {
      // Strategy (or earlier) exit already at/before this bar.
      break;
    }
    if (
      isStopLossHit(trade.side, trade.entryPrice, bar.price, threshold)
    ) {
      return bar;
    }
  }
  return null;
}

/** Attach stop-loss % exit when it fires before the strategy exit (or when still open). */
export function applyStopLossExitToTrade<T extends TradeLike>(
  trade: T,
  bars: SessionMarkBar[],
  stopLossPct: number | null | undefined,
): T {
  const bar = findStopLossExitBar(trade, bars, stopLossPct);
  if (!bar) {
    return trade;
  }

  return {
    ...trade,
    exitTimeIst: bar.timeIst,
    exitPrice: bar.price,
    targetHit: false,
    profit: roundTripProfit(trade.side, trade.entryPrice, bar.price),
    exitReason: "stop_loss",
    stopLossHit: true,
  };
}

export function applyStopLossExitsToTrades<T extends TradeLike>(
  trades: T[],
  bars: SessionMarkBar[],
  stopLossPct: number | null | undefined,
): T[] {
  if (normalizeStopLossPct(stopLossPct) == null) {
    return trades;
  }
  return trades.map((trade) => applyStopLossExitToTrade(trade, bars, stopLossPct));
}

function simulationSignalToExit(
  signal: DayScanSimulationSignal,
): DayScanSimulationExit | null {
  if (signal.exitTimeIst == null || signal.exitPrice == null) {
    return null;
  }
  return {
    date: signal.date,
    strategy: signal.strategy,
    side: signal.side,
    scenarioNumber: signal.scenarioNumber,
    scenarioKey: signal.scenarioKey,
    tradingSymbol: signal.tradingSymbol,
    symbol: signal.symbol,
    sector: signal.sector,
    entryTimeIst: signal.entryTimeIst,
    entryPrice: signal.entryPrice,
    exitTimeIst: signal.exitTimeIst,
    exitPrice: signal.exitPrice,
    targetHit: signal.targetHit,
    profit: signal.profit,
    profitTarget: signal.profitTarget,
    bbMatchType: signal.bbMatchType,
    exitReason: signal.exitReason ?? (signal.targetHit ? "target" : null),
    stopLossHit: signal.stopLossHit ?? false,
  };
}

/**
 * Overlay Samco-configured stop-loss % onto a Day Scan Simulator frame
 * using the current candle marks (exit at mark when SL hits and no earlier strategy exit).
 */
export function applyStopLossToDayScanSimulationPayload(
  payload: DayScanSimulationPayload,
  stopLossPct: number | null | undefined,
): DayScanSimulationPayload {
  const threshold = normalizeStopLossPct(stopLossPct);
  if (threshold == null) {
    return payload;
  }

  const simulatedTimeIst = payload.simulation.simulatedTimeIst;
  const markBySymbol = new Map(
    payload.marks.map((mark) => [mark.tradingSymbol, mark]),
  );

  const entries = payload.entries.map((entry) => {
    const alreadyExited =
      entry.exitTimeIst != null &&
      entry.exitPrice != null &&
      compareIstTime(entry.exitTimeIst, simulatedTimeIst) <= 0;
    if (alreadyExited) {
      return entry;
    }

    const mark = markBySymbol.get(entry.tradingSymbol);
    if (!mark) {
      return entry;
    }
    if (compareIstTime(entry.entryTimeIst, mark.timeIst) > 0) {
      return entry;
    }
    if (
      !isStopLossHit(entry.side, entry.entryPrice, mark.price, threshold)
    ) {
      return entry;
    }

    return {
      ...entry,
      exitTimeIst: mark.timeIst,
      exitPrice: mark.price,
      targetHit: false,
      profit: roundTripProfit(entry.side, entry.entryPrice, mark.price),
      exitReason: "stop_loss" as const,
      stopLossHit: true,
    };
  });

  const exits = entries
    .map(simulationSignalToExit)
    .filter((exit): exit is DayScanSimulationExit => {
      if (!exit) {
        return false;
      }
      return compareIstTime(exit.exitTimeIst, simulatedTimeIst) <= 0;
    })
    .sort((left, right) => compareIstTime(left.exitTimeIst, right.exitTimeIst));

  const profits = exits
    .map((exit) => exit.profit)
    .filter((profit): profit is number => profit != null && Number.isFinite(profit));

  return {
    ...payload,
    entries,
    exits,
    summary: {
      ...payload.summary,
      exitCount: exits.length,
      openPositions: entries.length - exits.length,
      targetsHit: exits.filter((exit) => exit.targetHit).length,
      stopsHit: exits.filter((exit) => exit.stopLossHit).length,
      avgProfit:
        profits.length > 0
          ? profits.reduce((sum, profit) => sum + profit, 0) / profits.length
          : null,
    },
  };
}
