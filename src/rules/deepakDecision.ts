import { config } from "../config.js";
import type {
  DeepakDecisionResult,
  DeepakDecisionScan,
  IndicatorSnapshot,
} from "../types.js";
import {
  analyzeDayWithVariant,
  candleMidPrice,
  createDeepakScenarios,
  filterSessionCandlesForVariant,
  resolveDateKey,
  type DeepakScenarios,
  type DeepakStrategyVariant,
} from "./deepakCore.js";

export type { DeepakScenarios, DeepakStrategyVariant } from "./deepakCore.js";
export { candleMidPrice, createDeepakScenarios } from "./deepakCore.js";

export function filterSessionCandles(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): IndicatorSnapshot[] {
  return filterSessionCandlesForVariant(snapshots, dateKey, DEEPAK_VARIANT);
}

export const DEEPAK_VARIANT: DeepakStrategyVariant = {
  id: "deepak",
  namePrefix: "deepak",
  config: config.deepakDecision,
};

export const DEEPAK2_VARIANT: DeepakStrategyVariant = {
  id: "deepak2",
  namePrefix: "deepak-2",
  config: config.deepakDecision2,
};

export const DEEPAK_SCENARIOS = createDeepakScenarios(DEEPAK_VARIANT.namePrefix);
export const DEEPAK2_SCENARIOS = createDeepakScenarios(DEEPAK2_VARIANT.namePrefix);

export function scanDeepakDecisions(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): DeepakDecisionScan {
  const { sessionStart, sessionEnd } = DEEPAK_VARIANT.config;
  const result = analyzeDayWithVariant(snapshots, dateKey, DEEPAK_VARIANT);

  return {
    dateKey,
    sessionStart,
    sessionEnd,
    results: result ? [result] : [],
  };
}

export function scanDeepak2Decisions(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): DeepakDecisionScan {
  const { sessionStart, sessionEnd } = DEEPAK2_VARIANT.config;
  const result = analyzeDayWithVariant(snapshots, dateKey, DEEPAK2_VARIANT);

  return {
    dateKey,
    sessionStart,
    sessionEnd,
    results: result ? [result] : [],
  };
}

export function evaluateDeepakDecision(
  snapshots: IndicatorSnapshot[],
  dateKey?: string,
): DeepakDecisionResult | null {
  const resolvedDateKey = resolveDateKey(snapshots, dateKey);
  if (!resolvedDateKey) {
    return null;
  }

  return analyzeDayWithVariant(snapshots, resolvedDateKey, DEEPAK_VARIANT);
}

export function evaluateDeepak2Decision(
  snapshots: IndicatorSnapshot[],
  dateKey?: string,
): DeepakDecisionResult | null {
  const resolvedDateKey = resolveDateKey(snapshots, dateKey);
  if (!resolvedDateKey) {
    return null;
  }

  return analyzeDayWithVariant(snapshots, resolvedDateKey, DEEPAK2_VARIANT);
}
