import { config } from "../config.js";
import { computeStochasticMomentum } from "../indicators/stochasticMomentum.js";
import type {
  DeepakBbMatchType,
  DeepakDecisionResult,
  DeepakTradeSignal,
  Deeppro1Exit,
  Deeppro1ScanResult,
  Deeppro1ScenarioKey,
  Deeppro1Signal,
  IndicatorSnapshot,
} from "../types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
} from "../utils/marketTime.js";

const SCENARIO_NUMBER: Record<Deeppro1ScenarioKey, number> = {
  sell_smi_down_cross: 1,
  buy_smi_up_cross: 1,
};

const SCENARIO_LABEL: Record<Deeppro1ScenarioKey, string> = {
  sell_smi_down_cross: "deeppro1 sell SMI down-cross",
  buy_smi_up_cross: "deeppro1 buy SMI up-cross",
};

function midPrice(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

function parseHmToMinutes(timeIst: string): number {
  const [hourText, minuteText] = timeIst.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

/** True when entry time is at or before the inclusive deadline (e.g. 13:30). */
export function isAtOrBeforeEntryDeadline(
  timeIst: string,
  deadlineIst: string,
): boolean {
  return parseHmToMinutes(timeIst) <= parseHmToMinutes(deadlineIst);
}

/**
 * SMI black crosses below red signal.
 * Requires a true prior separation (black strictly above red), then at-or-below.
 * Rejects equal/tangled bars that never visually crossed (Deeppro chart-aligned).
 */
export function isSmiBlackDownCrossRed(
  prevSmi: number,
  prevSignal: number,
  curSmi: number,
  curSignal: number,
): boolean {
  return prevSmi > prevSignal && curSmi <= curSignal;
}

/**
 * SMI black crosses above red signal (mirror of down-cross).
 * Requires black strictly below red on the prior bar, then at-or-above.
 */
export function isSmiBlackUpCrossRed(
  prevSmi: number,
  prevSignal: number,
  curSmi: number,
  curSignal: number,
): boolean {
  return prevSmi < prevSignal && curSmi >= curSignal;
}

/**
 * Square-off when favourable mid move from entry reaches squareOffPct.
 * SELL → drop %; BUY → rise %.
 */
export function simulateDeeppro1SquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryIndex: number,
  side: "BUY" | "SELL",
  entryMid: number,
  squareOffPct: number,
): Deeppro1Exit | null {
  const { sessionStart, sessionEnd } = config.deeppro1;

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
 * Evaluate Deeppro1 for one IST trade day (any symbol).
 * Emits SMI black↔red crosses at or before entryDeadlineIst (default 13:30);
 * attaches 0.45% square-off when hit same day (exits may print after the deadline).
 * Does not share logic with Deeppro exhaustion / Deepak / per-symbol favourable rules.
 */
export function evaluateDeeppro1Day(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): Deeppro1ScanResult {
  const {
    sessionStart,
    sessionEnd,
    entryDeadlineIst,
    smi: smiCfg,
    squareOffPct,
  } = config.deeppro1;

  const smiSeries = computeStochasticMomentum(
    snapshots.map((s) => s.high),
    snapshots.map((s) => s.low),
    snapshots.map((s) => s.close),
    smiCfg.lengthK,
    smiCfg.lengthD,
    smiCfg.lengthEma,
  );

  const signals: Deeppro1Signal[] = [];

  for (let i = 1; i < snapshots.length; i++) {
    const snap = snapshots[i];
    if (!isWithinIstSessionWindow(snap.timestamp, sessionStart, sessionEnd)) {
      continue;
    }
    const parts = getIstTimeParts(snap.timestamp);
    if (parts.dateKey !== dateKey) {
      continue;
    }

    const timeIst = formatIstTime(snap.timestamp);
    if (!isAtOrBeforeEntryDeadline(timeIst, entryDeadlineIst)) {
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
    const scenarioKey: Deeppro1ScenarioKey = down
      ? "sell_smi_down_cross"
      : "buy_smi_up_cross";
    const entryMid = midPrice(snap);
    const exit = simulateDeeppro1SquareOff(
      snapshots,
      dateKey,
      i,
      side,
      entryMid,
      squareOffPct,
    );

    const reasons = [
      down
        ? `Deeppro1 SELL: SMI black crossed below red signal (${prev.smi.toFixed(2)}→${cur.smi.toFixed(2)} vs ${prev.signal.toFixed(2)}→${cur.signal.toFixed(2)})`
        : `Deeppro1 BUY: SMI black crossed above red signal (${prev.smi.toFixed(2)}→${cur.smi.toFixed(2)} vs ${prev.signal.toFixed(2)}→${cur.signal.toFixed(2)})`,
      exit
        ? `Square-off hit ${exit.profitPct.toFixed(2)}% at ${exit.timeIst} (target ${squareOffPct}%)`
        : `No same-day square-off at ${squareOffPct}%`,
    ];

    signals.push({
      side,
      rule: "deeppro1",
      dateKey,
      timeIst,
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
    rule: "deeppro1",
    sessionStart,
    sessionEnd,
    signals,
  };
}

/** Map Deeppro1 signal into shared trade-signal shape (for backtest/day-scan/dashboard). */
export function deeppro1SignalToTradeSignal(
  signal: Deeppro1Signal,
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

/** Adapt Deeppro1 day signals into the Deepak decision shape used by dashboard/post-mortem. */
export function evaluateDeeppro1Decision(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): DeepakDecisionResult | null {
  const day = evaluateDeeppro1Day(snapshots, dateKey);
  if (day.signals.length === 0) {
    return null;
  }

  const tradeSignals = day.signals.map(deeppro1SignalToTradeSignal);
  const lastSignal = tradeSignals[tradeSignals.length - 1];
  const lastSnapshot =
    snapshots.find((snapshot) => {
      const parts = getIstTimeParts(snapshot.timestamp);
      return parts.dateKey === dateKey && formatIstTime(snapshot.timestamp) === lastSignal.timeIst;
    }) ??
    [...snapshots].reverse().find((snapshot) => {
      const parts = getIstTimeParts(snapshot.timestamp);
      return parts.dateKey === dateKey;
    });

  if (!lastSnapshot) {
    return null;
  }

  return {
    dateKey,
    decision: lastSignal.side,
    activeScenario: lastSignal.scenarioKey,
    scenarioTrail: tradeSignals.map((signal) => ({
      scenarioKey: signal.scenarioKey,
      timeIst: signal.timeIst,
      bbMatchType: signal.bbMatchType,
    })),
    signals: tradeSignals,
    reasons: day.signals.flatMap((signal) => signal.reasons),
    snapshot: lastSnapshot,
  };
}

export const __deeppro1Testables = {
  isSmiBlackDownCrossRed,
  isSmiBlackUpCrossRed,
  simulateDeeppro1SquareOff,
  isAtOrBeforeEntryDeadline,
  midPrice,
};
