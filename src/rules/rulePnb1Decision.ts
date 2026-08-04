import { config } from "../config.js";
import { computeStochasticMomentum } from "../indicators/stochasticMomentum.js";
import type {
  DeepakBbMatchType,
  DeepakTradeSignal,
  IndicatorSnapshot,
  RulePnb1Exit,
  RulePnb1ScanResult,
  RulePnb1ScenarioKey,
  RulePnb1Signal,
} from "../types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
} from "../utils/marketTime.js";

/** Normalize NSE:PNB / pnb → PNB for the exclusive-symbol guard. */
export function normalizeRulePnb1TradingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/^NSE:/, "");
}

/** True only for the exclusive RulePNB1 symbol (PNB). */
export function isRulePnb1Symbol(symbol: string | null | undefined): boolean {
  if (!symbol) {
    return false;
  }
  return (
    normalizeRulePnb1TradingSymbol(symbol) === config.rulePnb1.tradingSymbol
  );
}

/** Throws when a caller tries to run RulePNB1 on a non-PNB symbol. */
export function assertRulePnb1Symbol(symbol: string): void {
  if (!isRulePnb1Symbol(symbol)) {
    throw new Error(
      `RulePNB1 is PNB-only and cannot run on ${normalizeRulePnb1TradingSymbol(symbol) || "(empty)"}. Use trading symbol PNB.`,
    );
  }
}

const SCENARIO_NUMBER: Record<RulePnb1ScenarioKey, number> = {
  sell_smi_down_cross: 1,
  buy_smi_up_cross: 1,
};

const SCENARIO_LABEL: Record<RulePnb1ScenarioKey, string> = {
  sell_smi_down_cross: "rulePnb1 sell SMI down-cross",
  buy_smi_up_cross: "rulePnb1 buy SMI up-cross",
};

function midPrice(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

/** SMI black crosses below red signal (same definition as RuleSUNPHARMA1). */
export function isSmiBlackDownCrossRed(
  prevSmi: number,
  prevSignal: number,
  curSmi: number,
  curSignal: number,
): boolean {
  return prevSmi >= prevSignal && curSmi < curSignal;
}

/** SMI black crosses above red signal (mirror of down-cross). */
export function isSmiBlackUpCrossRed(
  prevSmi: number,
  prevSignal: number,
  curSmi: number,
  curSignal: number,
): boolean {
  return prevSmi <= prevSignal && curSmi > curSignal;
}

/**
 * Square-off when favourable mid move from entry reaches squareOffPct.
 * SELL → drop %; BUY → rise %.
 */
export function simulateRulePnb1SquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryIndex: number,
  side: "BUY" | "SELL",
  entryMid: number,
  squareOffPct: number,
): RulePnb1Exit | null {
  const { sessionStart, sessionEnd } = config.rulePnb1;

  for (let i = entryIndex + 1; i < snapshots.length; i++) {
    const snap = snapshots[i];
    if (!isWithinIstSessionWindow(snap.timestamp, sessionStart, sessionEnd)) {
      continue;
    }
    const parts = getIstTimeParts(snap.timestamp);
    if (parts.dateKey !== dateKey) {
      break;
    }

    const exitMid = midPrice(snap);
    const movePct =
      side === "SELL"
        ? ((entryMid - exitMid) / entryMid) * 100
        : ((exitMid - entryMid) / entryMid) * 100;

    if (movePct >= squareOffPct) {
      return {
        timeIst: formatIstTime(snap.timestamp),
        price: exitMid,
        targetHit: true,
        profitPct: movePct,
        squareOffPct,
      };
    }
  }

  return null;
}

/**
 * Evaluate RulePNB1 for one IST trade day.
 * Same logic as RuleSUNPHARMA1, locked to PNB config — not mixed with RulePNB.
 */
export function evaluateRulePnb1Day(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): RulePnb1ScanResult {
  const { sessionStart, sessionEnd, smi: smiCfg, squareOffPct } = config.rulePnb1;

  const smiSeries = computeStochasticMomentum(
    snapshots.map((s) => s.high),
    snapshots.map((s) => s.low),
    snapshots.map((s) => s.close),
    smiCfg.lengthK,
    smiCfg.lengthD,
    smiCfg.lengthEma,
  );

  const signals: RulePnb1Signal[] = [];

  for (let i = 1; i < snapshots.length; i++) {
    const snap = snapshots[i];
    if (!isWithinIstSessionWindow(snap.timestamp, sessionStart, sessionEnd)) {
      continue;
    }
    const parts = getIstTimeParts(snap.timestamp);
    if (parts.dateKey !== dateKey) {
      continue;
    }

    const prev = smiSeries[i - 1];
    const cur = smiSeries[i];
    if (
      ![prev.smi, prev.signal, cur.smi, cur.signal].every(Number.isFinite)
    ) {
      continue;
    }

    const down = isSmiBlackDownCrossRed(
      prev.smi,
      prev.signal,
      cur.smi,
      cur.signal,
    );
    const up = isSmiBlackUpCrossRed(
      prev.smi,
      prev.signal,
      cur.smi,
      cur.signal,
    );
    if (!down && !up) {
      continue;
    }

    const side: "BUY" | "SELL" = down ? "SELL" : "BUY";
    const scenarioKey: RulePnb1ScenarioKey = down
      ? "sell_smi_down_cross"
      : "buy_smi_up_cross";
    const entryMid = midPrice(snap);
    const exit = simulateRulePnb1SquareOff(
      snapshots,
      dateKey,
      i,
      side,
      entryMid,
      squareOffPct,
    );

    const reasons = [
      down
        ? `RulePNB1 SELL: SMI black crossed below red signal (${prev.smi.toFixed(2)}→${cur.smi.toFixed(2)} vs ${prev.signal.toFixed(2)}→${cur.signal.toFixed(2)})`
        : `RulePNB1 BUY: SMI black crossed above red signal (${prev.smi.toFixed(2)}→${cur.smi.toFixed(2)} vs ${prev.signal.toFixed(2)}→${cur.signal.toFixed(2)})`,
      exit
        ? `Square-off hit ${exit.profitPct.toFixed(2)}% at ${exit.timeIst} (target ${squareOffPct}%)`
        : `No same-day square-off at ${squareOffPct}%`,
    ];

    signals.push({
      side,
      rule: "rulePnb1",
      dateKey,
      timeIst: formatIstTime(snap.timestamp),
      scenarioKey,
      price: entryMid,
      smi: cur.smi,
      signal: cur.signal,
      prevSmi: prev.smi,
      prevSignal: prev.signal,
      rsi: snap.rsi,
      squareOffPct,
      exit,
      reasons,
    });
  }

  return {
    dateKey,
    rule: "rulePnb1",
    sessionStart,
    sessionEnd,
    signals,
  };
}

/** Map RulePNB1 signal into shared trade-signal shape (for backtest/day-scan payloads). */
export function rulePnb1SignalToTradeSignal(
  signal: RulePnb1Signal,
): DeepakTradeSignal {
  const exit = signal.exit
    ? {
        timeIst: signal.exit.timeIst,
        price: signal.exit.price,
        targetHit: signal.exit.targetHit,
        profit: signal.exit.profitPct,
        profitTarget: signal.squareOffPct,
      }
    : null;

  return {
    side: signal.side,
    scenarioKey: SCENARIO_LABEL[signal.scenarioKey],
    scenarioNumber: SCENARIO_NUMBER[signal.scenarioKey],
    timeIst: signal.timeIst,
    price: signal.price,
    bbMatchType: "close" as DeepakBbMatchType,
    profitTarget: signal.squareOffPct,
    exit,
  };
}

export const __rulePnb1Testables = {
  isSmiBlackDownCrossRed,
  isSmiBlackUpCrossRed,
  simulateRulePnb1SquareOff,
  midPrice,
};
