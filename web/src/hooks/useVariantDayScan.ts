import { useCallback } from "react";

import {
  fetchDeepak2DayScan,
  fetchDeepak3DayScan,
  fetchDeepakDayScan,
  fetchDeepakWatchPartyDayScan,
  fetchDeepproDayScan,
} from "../api/client";
import type {
  DeepakDayScanPayload,
  DeepakWatchPartyDayScanPayload,
} from "../types/backtest";
import type { DayScanRuleVariant } from "../types/ruleVariant";
import { useCancellableDayScan } from "./useCancellableDayScan";

export type VariantDayScanPayload = DeepakDayScanPayload | DeepakWatchPartyDayScanPayload;

function fetchByVariant(
  variant: DayScanRuleVariant,
  date: string,
  signal: AbortSignal,
): Promise<VariantDayScanPayload> {
  switch (variant) {
    case "deepak2":
      return fetchDeepak2DayScan(date, signal);
    case "deepak3":
      return fetchDeepak3DayScan(date, signal);
    case "watchParty":
      return fetchDeepakWatchPartyDayScan(date, signal);
    case "deeppro":
      return fetchDeepproDayScan(date, signal);
    case "deepak":
    default:
      return fetchDeepakDayScan(date, signal);
  }
}

export function useVariantDayScan(variant: DayScanRuleVariant) {
  const fetchScan = useCallback(
    (date: string, signal: AbortSignal) => fetchByVariant(variant, date, signal),
    [variant],
  );

  return useCancellableDayScan(fetchScan);
}
