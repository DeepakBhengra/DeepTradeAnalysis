import { config } from "../config.js";
import {
  deepproCrossSignalToTradeSignal,
  evaluateDeepproCrossDay,
  evaluateDeepproCrossDecision,
  type DeepproCrossEvaluateOptions,
} from "./deepproCrossDecision.js";
import type {
  DeepakDecisionResult,
  Deeppro1ScanResult,
  Deeppro1Signal,
  IndicatorSnapshot,
} from "../types.js";

export type Deeppro2EvaluateOptions = DeepproCrossEvaluateOptions;

export function evaluateDeeppro2Day(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  options?: Deeppro2EvaluateOptions,
): Deeppro1ScanResult {
  return evaluateDeepproCrossDay(snapshots, dateKey, "deeppro2", config.deeppro2, options);
}

export function deeppro2SignalToTradeSignal(signal: Deeppro1Signal): ReturnType<
  typeof deepproCrossSignalToTradeSignal
> {
  return deepproCrossSignalToTradeSignal(signal);
}

export function evaluateDeeppro2Decision(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  options?: Deeppro2EvaluateOptions,
): DeepakDecisionResult | null {
  return evaluateDeepproCrossDecision(
    snapshots,
    dateKey,
    "deeppro2",
    config.deeppro2,
    options,
  );
}
