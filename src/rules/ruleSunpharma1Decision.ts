import { config } from "../config.js";
import { computeStochasticMomentum } from "../indicators/stochasticMomentum.js";
import type {
  DeepakBbMatchType,
  DeepakTradeSignal,
  IndicatorSnapshot,
  RuleSunpharma1Exit,
  RuleSunpharma1ScanResult,
  RuleSunpharma1ScenarioKey,
  RuleSunpharma1Signal,
} from "../types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
} from "../utils/marketTime.js";

/** Normalize NSE:SUNPHARMA / sunpharma → SUNPHARMA for the exclusive-symbol guard. */
export function normalizeRuleSunpharma1TradingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/^NSE:/, "");
}

/** True only for the exclusive RuleSUNPHARMA1 symbol (SUNPHARMA). */
export function isRuleSunpharma1Symbol(symbol: string | null | undefined): boolean {
  if (!symbol) {
    return false;
  }
  return (
    normalizeRuleSunpharma1TradingSymbol(symbol) ===
    config.ruleSunpharma1.tradingSymbol
  );
}

/** Throws when a caller tries to run RuleSUNPHARMA1 on a non-SUNPHARMA symbol. */
export function assertRuleSunpharma1Symbol(symbol: string): void {
  if (!isRuleSunpharma1Symbol(symbol)) {
    throw new Error(
      `RuleSUNPHARMA1 is SUNPHARMA-only and cannot run on ${normalizeRuleSunpharma1TradingSymbol(symbol) || "(empty)"}. Use trading symbol SUNPHARMA.`,
    );
  }
}

const SCENARIO_NUMBER: Record<RuleSunpharma1ScenarioKey, number> = {
  sell_smi_down_cross: 1,
  buy_smi_up_cross: 1,
};

const SCENARIO_LABEL: Record<RuleSunpharma1ScenarioKey, string> = {
  sell_smi_down_cross: "ruleSunpharma1 sell SMI down-cross",
  buy_smi_up_cross: "ruleSunpharma1 buy SMI up-cross",
};

function midPrice(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

/** SMI black crosses below red signal (study-aligned: prev ≥ signal, cur < signal). */
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
export function simulateRuleSunpharma1SquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryIndex: number,
  side: "BUY" | "SELL",
  entryMid: number,
  squareOffPct: number,
): RuleSunpharma1Exit | null {
  const { sessionStart, sessionEnd } = config.ruleSunpharma1;

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
 * Evaluate RuleSUNPHARMA1 for one IST trade day.
 * Emits every SMI black↔red cross in session; attaches 0.45% square-off when hit same day.
 * Does not share logic with RuleSUNPHARMA / Deepak / Deeppro.
 */
export function evaluateRuleSunpharma1Day(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): RuleSunpharma1ScanResult {
  const { sessionStart, sessionEnd, smi: smiCfg, squareOffPct } =
    config.ruleSunpharma1;

  const smiSeries = computeStochasticMomentum(
    snapshots.map((s) => s.high),
    snapshots.map((s) => s.low),
    snapshots.map((s) => s.close),
    smiCfg.lengthK,
    smiCfg.lengthD,
    smiCfg.lengthEma,
  );

  const signals: RuleSunpharma1Signal[] = [];

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
    const scenarioKey: RuleSunpharma1ScenarioKey = down
      ? "sell_smi_down_cross"
      : "buy_smi_up_cross";
    const entryMid = midPrice(snap);
    const exit = simulateRuleSunpharma1SquareOff(
      snapshots,
      dateKey,
      i,
      side,
      entryMid,
      squareOffPct,
    );

    const reasons = [
      down
        ? `RuleSUNPHARMA1 SELL: SMI black crossed below red signal (${prev.smi.toFixed(2)}→${cur.smi.toFixed(2)} vs ${prev.signal.toFixed(2)}→${cur.signal.toFixed(2)})`
        : `RuleSUNPHARMA1 BUY: SMI black crossed above red signal (${prev.smi.toFixed(2)}→${cur.smi.toFixed(2)} vs ${prev.signal.toFixed(2)}→${cur.signal.toFixed(2)})`,
      exit
        ? `Square-off hit ${exit.profitPct.toFixed(2)}% at ${exit.timeIst} (target ${squareOffPct}%)`
        : `No same-day square-off at ${squareOffPct}%`,
    ];

    signals.push({
      side,
      rule: "ruleSunpharma1",
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
    rule: "ruleSunpharma1",
    sessionStart,
    sessionEnd,
    signals,
  };
}

/** Map RuleSUNPHARMA1 signal into shared trade-signal shape (for backtest/day-scan payloads). */
export function ruleSunpharma1SignalToTradeSignal(
  signal: RuleSunpharma1Signal,
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

export const __ruleSunpharma1Testables = {
  isSmiBlackDownCrossRed,
  isSmiBlackUpCrossRed,
  simulateRuleSunpharma1SquareOff,
  midPrice,
};
