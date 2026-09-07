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

export type DeepproCrossRuleId = "deeppro1" | "deeppro2";

export interface DeepproCrossRuleConfig {
  sessionStart: string;
  sessionEnd: string;
  entryDeadlineIst: string;
  forceExitIst: string;
  smi: {
    lengthK: number;
    lengthD: number;
    lengthEma: number;
  };
  squareOffPct: number;
  breakevenArmPct: number;
}

export interface DeepproCrossEvaluateOptions {
  /** Override squareOffPct (mid-price favourable move %). */
  squareOffPct?: number;
}

const SCENARIO_NUMBER: Record<Deeppro1ScenarioKey, number> = {
  sell_smi_down_cross: 1,
  buy_smi_up_cross: 1,
};

function scenarioLabel(
  ruleId: DeepproCrossRuleId,
  scenarioKey: Deeppro1ScenarioKey,
): string {
  const label = ruleId === "deeppro2" ? "Deeppro2" : "Deeppro1";
  return scenarioKey === "sell_smi_down_cross"
    ? `${ruleId} sell SMI down-cross`
    : `${ruleId} buy SMI up-cross`;
}

function ruleDisplayName(ruleId: DeepproCrossRuleId): string {
  return ruleId === "deeppro2" ? "Deeppro2" : "Deeppro1";
}

function midPrice(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

function parseHmToMinutes(timeIst: string): number {
  const [hourText, minuteText] = timeIst.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

export function isAtOrBeforeEntryDeadline(
  timeIst: string,
  deadlineIst: string,
): boolean {
  return parseHmToMinutes(timeIst) <= parseHmToMinutes(deadlineIst);
}

export function isAtOrAfterForceExit(
  timeIst: string,
  forceExitIst: string,
): boolean {
  return parseHmToMinutes(timeIst) >= parseHmToMinutes(forceExitIst);
}

export function isSmiBlackDownCrossRed(
  prevSmi: number,
  prevSignal: number,
  curSmi: number,
  curSignal: number,
): boolean {
  return prevSmi > prevSignal && curSmi <= curSignal;
}

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

export function simulateDeepproCrossSquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryIndex: number,
  side: "BUY" | "SELL",
  entryMid: number,
  squareOffPct: number,
  ruleConfig: DeepproCrossRuleConfig,
): Deeppro1Exit | null {
  const { sessionStart, sessionEnd, breakevenArmPct } = ruleConfig;
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

type OpenDeepproCross = {
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
  open: OpenDeepproCross,
  ruleId: DeepproCrossRuleId,
  dateKey: string,
  squareOffPct: number,
  exit: Deeppro1Exit | null,
  breakevenArmPct: number,
): Deeppro1Signal {
  return {
    side: open.side,
    rule: ruleId,
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
    reasons: exit
      ? [...open.entryReasons, exitReasonText(exit, squareOffPct, breakevenArmPct)]
      : [...open.entryReasons],
  };
}

function openFromCross(
  ruleId: DeepproCrossRuleId,
  params: {
    side: "BUY" | "SELL";
    timeIst: string;
    price: number;
    smi: number;
    signal: number;
    prevSmi: number;
    prevSignal: number;
    rsi: number;
  },
): OpenDeepproCross {
  const scenarioKey: Deeppro1ScenarioKey =
    params.side === "SELL" ? "sell_smi_down_cross" : "buy_smi_up_cross";
  const label = ruleDisplayName(ruleId);
  const entryReasons = [
    params.side === "SELL"
      ? `${label} SELL: SMI black crossed below red signal (${params.prevSmi.toFixed(2)}→${params.smi.toFixed(2)} vs ${params.prevSignal.toFixed(2)}→${params.signal.toFixed(2)})`
      : `${label} BUY: SMI black crossed above red signal (${params.prevSmi.toFixed(2)}→${params.smi.toFixed(2)} vs ${params.prevSignal.toFixed(2)}→${params.signal.toFixed(2)})`,
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

export function evaluateDeepproCrossDay(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  ruleId: DeepproCrossRuleId,
  ruleConfig: DeepproCrossRuleConfig,
  options?: DeepproCrossEvaluateOptions,
): Deeppro1ScanResult {
  const {
    sessionStart,
    sessionEnd,
    entryDeadlineIst,
    forceExitIst,
    smi: smiCfg,
    squareOffPct: configSquareOffPct,
    breakevenArmPct,
  } = ruleConfig;
  const squareOffPct =
    options?.squareOffPct != null &&
    Number.isFinite(options.squareOffPct) &&
    options.squareOffPct > 0
      ? options.squareOffPct
      : configSquareOffPct;

  const smiSeries = computeStochasticMomentum(
    snapshots.map((s) => s.high),
    snapshots.map((s) => s.low),
    snapshots.map((s) => s.close),
    smiCfg.lengthK,
    smiCfg.lengthD,
    smiCfg.lengthEma,
    { doubleSmooth: "rma" },
  );

  const signals: Deeppro1Signal[] = [];
  let open: OpenDeepproCross | null = null;

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
          finalizeSignal(open, ruleId, dateKey, squareOffPct, exit, breakevenArmPct),
        );
        open = null;

        if (wasFlip && crossSide != null && canEnter && crossReady) {
          open = openFromCross(ruleId, {
            side: crossSide,
            timeIst,
            price: mid,
            smi: cur.smi,
            signal: cur.signal,
            prevSmi: prev.smi,
            prevSignal: prev.signal,
            rsi: snap.rsi,
          });
        } else if (!wasFlip && crossSide != null && canEnter && crossReady) {
          open = openFromCross(ruleId, {
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
      open = openFromCross(ruleId, {
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
      if (isAtOrAfterForceExit(timeIst, forceExitIst)) {
        const mid = midPrice(snap);
        const movePct = favourableMovePct(open.side, open.price, mid);
        const exit = buildExit(timeIst, mid, movePct, squareOffPct, "eod");
        signals.push(
          finalizeSignal(open, ruleId, dateKey, squareOffPct, exit, breakevenArmPct),
        );
      } else {
        signals.push(
          finalizeSignal(open, ruleId, dateKey, squareOffPct, null, breakevenArmPct),
        );
      }
      open = null;
      break;
    }
  }

  return {
    dateKey,
    rule: ruleId,
    sessionStart,
    sessionEnd,
    signals,
  };
}

export function deepproCrossSignalToTradeSignal(
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
    scenarioKey: scenarioLabel(signal.rule, signal.scenarioKey),
    scenarioNumber: SCENARIO_NUMBER[signal.scenarioKey],
    timeIst: signal.timeIst,
    price: signal.price,
    bbMatchType: "close" as DeepakBbMatchType,
    profitTarget: signal.squareOffPct,
    exit,
  };
}

export function evaluateDeepproCrossDecision(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  ruleId: DeepproCrossRuleId,
  ruleConfig: DeepproCrossRuleConfig,
  options?: DeepproCrossEvaluateOptions,
): DeepakDecisionResult | null {
  const day = evaluateDeepproCrossDay(snapshots, dateKey, ruleId, ruleConfig, options);
  if (day.signals.length === 0) {
    return null;
  }

  const tradeSignals = day.signals.map(deepproCrossSignalToTradeSignal);
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

export const __deepproCrossTestables = {
  isSmiBlackDownCrossRed,
  isSmiBlackUpCrossRed,
  simulateDeepproCrossSquareOff,
  isBackToEntryPrice,
  isAtOrBeforeEntryDeadline,
  isAtOrAfterForceExit,
  midPrice,
};
