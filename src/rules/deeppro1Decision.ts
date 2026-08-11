import { config } from "../config.js";
import { computeStochasticMomentum } from "../indicators/stochasticMomentum.js";
import type {
  DeepakBbMatchType,
  DeepakDecisionResult,
  DeepakTradeSignal,
  Deeppro1Exit,
  Deeppro1ExitReason,
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

/** True when entry time is at or before the inclusive deadline (e.g. 11:45). */
export function isAtOrBeforeEntryDeadline(
  timeIst: string,
  deadlineIst: string,
): boolean {
  return parseHmToMinutes(timeIst) <= parseHmToMinutes(deadlineIst);
}

/** True when candle time is at or after the forced exit time (e.g. 15:00). */
export function isAtOrAfterForceExit(
  timeIst: string,
  forceExitIst: string,
): boolean {
  return parseHmToMinutes(timeIst) >= parseHmToMinutes(forceExitIst);
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

function favourableMovePct(
  side: "BUY" | "SELL",
  entryMid: number,
  exitMid: number,
): number {
  return side === "SELL"
    ? ((entryMid - exitMid) / entryMid) * 100
    : ((exitMid - entryMid) / entryMid) * 100;
}

/** True when mid has returned to (or through) the entry price against the open side. */
export function isBackToEntryPrice(
  side: "BUY" | "SELL",
  entryMid: number,
  exitMid: number,
): boolean {
  return side === "BUY" ? exitMid <= entryMid : exitMid >= entryMid;
}

function buildExit(
  timeIst: string,
  price: number,
  profitPct: number,
  squareOffPct: number,
  exitReason: Deeppro1ExitReason,
  breakevenArmPct?: number,
): Deeppro1Exit {
  return {
    timeIst,
    price,
    targetHit: exitReason === "target",
    profitPct,
    squareOffPct,
    exitReason,
    ...(exitReason === "breakeven" && breakevenArmPct != null
      ? { breakevenArmPct }
      : {}),
  };
}

function exitReasonText(
  exit: Deeppro1Exit,
  squareOffPct: number,
  breakevenArmPct: number,
): string {
  switch (exit.exitReason) {
    case "breakeven":
      return `Breakeven exit at ${exit.timeIst}: armed after ${breakevenArmPct}% then mid returned to entry (P&L ${exit.profitPct.toFixed(2)}%)`;
    case "flip":
      return `Flip exit at ${exit.timeIst}: opposite SMI cross closed the position (P&L ${exit.profitPct.toFixed(2)}%)`;
    case "eod":
      return `Forced exit at ${exit.timeIst}: still open at 15:00 (P&L ${exit.profitPct.toFixed(2)}%)`;
    case "target":
    default:
      return `Square-off hit ${exit.profitPct.toFixed(2)}% at ${exit.timeIst} (target ${squareOffPct}%)`;
  }
}

/**
 * Look-ahead square-off helper (target / breakeven only).
 * Full day evaluation also applies flip + 15:00 force-exit in evaluateDeeppro1Day.
 */
export function simulateDeeppro1SquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryIndex: number,
  side: "BUY" | "SELL",
  entryMid: number,
  squareOffPct: number,
  breakevenArmPct: number = config.deeppro1.breakevenArmPct,
): Deeppro1Exit | null {
  const { sessionStart, sessionEnd } = config.deeppro1;
  let armedForBreakeven = false;

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
    const movePct = favourableMovePct(side, entryMid, exitMid);

    if (movePct >= squareOffPct) {
      return buildExit(
        formatIstTime(snap.timestamp),
        exitMid,
        movePct,
        squareOffPct,
        "target",
      );
    }

    if (armedForBreakeven && isBackToEntryPrice(side, entryMid, exitMid)) {
      return buildExit(
        formatIstTime(snap.timestamp),
        exitMid,
        movePct,
        squareOffPct,
        "breakeven",
        breakevenArmPct,
      );
    }

    if (movePct >= breakevenArmPct) {
      armedForBreakeven = true;
    }
  }

  return null;
}

type OpenDeeppro1 = {
  side: "BUY" | "SELL";
  scenarioKey: Deeppro1ScenarioKey;
  timeIst: string;
  price: number;
  smi: number;
  signal: number;
  prevSmi: number;
  prevSignal: number;
  rsi: number;
  entryReasons: string[];
  armedForBreakeven: boolean;
};

function detectCrossSide(
  prevSmi: number,
  prevSignal: number,
  curSmi: number,
  curSignal: number,
): "BUY" | "SELL" | null {
  if (isSmiBlackDownCrossRed(prevSmi, prevSignal, curSmi, curSignal)) {
    return "SELL";
  }
  if (isSmiBlackUpCrossRed(prevSmi, prevSignal, curSmi, curSignal)) {
    return "BUY";
  }
  return null;
}

function finalizeSignal(
  open: OpenDeeppro1,
  dateKey: string,
  squareOffPct: number,
  exit: Deeppro1Exit,
  breakevenArmPct: number,
): Deeppro1Signal {
  return {
    side: open.side,
    rule: "deeppro1",
    dateKey,
    timeIst: open.timeIst,
    scenarioKey: open.scenarioKey,
    price: open.price,
    smi: open.smi,
    signal: open.signal,
    prevSmi: open.prevSmi,
    prevSignal: open.prevSignal,
    rsi: open.rsi,
    squareOffPct,
    exit,
    reasons: [...open.entryReasons, exitReasonText(exit, squareOffPct, breakevenArmPct)],
  };
}

function openFromCross(params: {
  side: "BUY" | "SELL";
  timeIst: string;
  price: number;
  smi: number;
  signal: number;
  prevSmi: number;
  prevSignal: number;
  rsi: number;
}): OpenDeeppro1 {
  const scenarioKey: Deeppro1ScenarioKey =
    params.side === "SELL" ? "sell_smi_down_cross" : "buy_smi_up_cross";
  const entryReasons = [
    params.side === "SELL"
      ? `Deeppro1 SELL: SMI black crossed below red signal (${params.prevSmi.toFixed(2)}→${params.smi.toFixed(2)} vs ${params.prevSignal.toFixed(2)}→${params.signal.toFixed(2)})`
      : `Deeppro1 BUY: SMI black crossed above red signal (${params.prevSmi.toFixed(2)}→${params.smi.toFixed(2)} vs ${params.prevSignal.toFixed(2)}→${params.signal.toFixed(2)})`,
  ];
  return {
    side: params.side,
    scenarioKey,
    timeIst: params.timeIst,
    price: params.price,
    smi: params.smi,
    signal: params.signal,
    prevSmi: params.prevSmi,
    prevSignal: params.prevSignal,
    rsi: params.rsi,
    entryReasons,
    armedForBreakeven: false,
  };
}

/**
 * Evaluate Deeppro1 for one IST trade day (any symbol).
 * One open position at a time. Entries only at/before entryDeadlineIst (11:45).
 * Exits: 0.45% target, 0.3%→breakeven, opposite-cross flip, or forced 15:00 exit.
 */
export function evaluateDeeppro1Day(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): Deeppro1ScanResult {
  const {
    sessionStart,
    sessionEnd,
    entryDeadlineIst,
    forceExitIst,
    smi: smiCfg,
    squareOffPct,
    breakevenArmPct,
  } = config.deeppro1;

  const smiSeries = computeStochasticMomentum(
    snapshots.map((s) => s.high),
    snapshots.map((s) => s.low),
    snapshots.map((s) => s.close),
    smiCfg.lengthK,
    smiCfg.lengthD,
    smiCfg.lengthEma,
    // Kite Stch Mtm (10,3,3) black/red crosses align with Wilder RMA double-smooth.
    { doubleSmooth: "rma" },
  );

  const signals: Deeppro1Signal[] = [];
  let open: OpenDeeppro1 | null = null;

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
    const mid = midPrice(snap);
    const prev = smiSeries[i - 1];
    const cur = smiSeries[i];
    const crossReady = [prev.smi, prev.signal, cur.smi, cur.signal].every(
      Number.isFinite,
    );
    const crossSide = crossReady
      ? detectCrossSide(prev.smi, prev.signal, cur.smi, cur.signal)
      : null;
    const canEnter = isAtOrBeforeEntryDeadline(timeIst, entryDeadlineIst);

    if (open) {
      const movePct = favourableMovePct(open.side, open.price, mid);
      let exit: Deeppro1Exit | null = null;

      if (movePct >= squareOffPct) {
        exit = buildExit(timeIst, mid, movePct, squareOffPct, "target");
      } else if (
        open.armedForBreakeven &&
        isBackToEntryPrice(open.side, open.price, mid)
      ) {
        exit = buildExit(
          timeIst,
          mid,
          movePct,
          squareOffPct,
          "breakeven",
          breakevenArmPct,
        );
      } else if (crossSide != null && crossSide !== open.side) {
        exit = buildExit(timeIst, mid, movePct, squareOffPct, "flip");
      } else if (isAtOrAfterForceExit(timeIst, forceExitIst)) {
        exit = buildExit(timeIst, mid, movePct, squareOffPct, "eod");
      }

      if (movePct >= breakevenArmPct) {
        open.armedForBreakeven = true;
      }

      if (exit) {
        const wasFlip = exit.exitReason === "flip";
        signals.push(
          finalizeSignal(open, dateKey, squareOffPct, exit, breakevenArmPct),
        );
        open = null;

        if (wasFlip && crossSide != null && canEnter && crossReady) {
          open = openFromCross({
            side: crossSide,
            timeIst,
            price: mid,
            smi: cur.smi,
            signal: cur.signal,
            prevSmi: prev.smi,
            prevSignal: prev.signal,
            rsi: snap.rsi,
          });
        } else if (
          !wasFlip &&
          crossSide != null &&
          canEnter &&
          crossReady
        ) {
          // Target/breakeven/eod closed this bar; same-bar cross may open a new side.
          open = openFromCross({
            side: crossSide,
            timeIst,
            price: mid,
            smi: cur.smi,
            signal: cur.signal,
            prevSmi: prev.smi,
            prevSignal: prev.signal,
            rsi: snap.rsi,
          });
        }
        continue;
      }
    }

    if (!open && crossSide != null && canEnter && crossReady) {
      open = openFromCross({
        side: crossSide,
        timeIst,
        price: mid,
        smi: cur.smi,
        signal: cur.signal,
        prevSmi: prev.smi,
        prevSignal: prev.signal,
        rsi: snap.rsi,
      });
    }
  }

  // Safety: still open with no 15:00 bar in the series — close on last same-day session bar.
  if (open) {
    for (let i = snapshots.length - 1; i >= 0; i--) {
      const snap = snapshots[i];
      if (!isWithinIstSessionWindow(snap.timestamp, sessionStart, sessionEnd)) {
        continue;
      }
      const parts = getIstTimeParts(snap.timestamp);
      if (parts.dateKey !== dateKey) {
        continue;
      }
      const timeIst = formatIstTime(snap.timestamp);
      const mid = midPrice(snap);
      const movePct = favourableMovePct(open.side, open.price, mid);
      const exit = buildExit(timeIst, mid, movePct, squareOffPct, "eod");
      signals.push(
        finalizeSignal(open, dateKey, squareOffPct, exit, breakevenArmPct),
      );
      open = null;
      break;
    }
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
        exitReason: signal.exit.exitReason,
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
      return (
        parts.dateKey === dateKey &&
        formatIstTime(snapshot.timestamp) === lastSignal.timeIst
      );
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
  isBackToEntryPrice,
  isAtOrBeforeEntryDeadline,
  isAtOrAfterForceExit,
  midPrice,
};
