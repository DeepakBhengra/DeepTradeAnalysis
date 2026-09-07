import { config } from "../config.js";
import type {
  DeepakDecisionResult,
  Deeppro1ScanResult,
  Deeppro1Signal,
  IndicatorSnapshot,
} from "../types.js";
import {
  __deepproCrossTestables,
  deepproCrossSignalToTradeSignal,
  evaluateDeepproCrossDay,
  evaluateDeepproCrossDecision,
  simulateDeepproCrossSquareOff,
  type DeepproCrossEvaluateOptions,
} from "./deepproCrossDecision.js";

export type Deeppro1EvaluateOptions = DeepproCrossEvaluateOptions;

export {
  isAtOrAfterForceExit,
  isAtOrBeforeEntryDeadline,
  isBackToEntryPrice,
  isSmiBlackDownCrossRed,
  isSmiBlackUpCrossRed,
} from "./deepproCrossDecision.js";

export function simulateDeeppro1SquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryIndex: number,
  side: "BUY" | "SELL",
  entryMid: number,
  squareOffPct: number,
  breakevenArmPct: number = config.deeppro1.breakevenArmPct,
) {
  return simulateDeepproCrossSquareOff(
    snapshots,
    dateKey,
    entryIndex,
    side,
    entryMid,
    squareOffPct,
    { ...config.deeppro1, breakevenArmPct },
  );
}

export function evaluateDeeppro1Day(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  options?: Deeppro1EvaluateOptions,
): Deeppro1ScanResult {
  return evaluateDeepproCrossDay(snapshots, dateKey, "deeppro1", config.deeppro1, options);
}

export function deeppro1SignalToTradeSignal(signal: Deeppro1Signal) {
  return deepproCrossSignalToTradeSignal(signal);
}

export function evaluateDeeppro1Decision(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  options?: Deeppro1EvaluateOptions,
): DeepakDecisionResult | null {
  return evaluateDeepproCrossDecision(
    snapshots,
    dateKey,
    "deeppro1",
    config.deeppro1,
    options,
  );
}

export const __deeppro1Testables = {
  ...__deepproCrossTestables,
  simulateDeeppro1SquareOff,
};
