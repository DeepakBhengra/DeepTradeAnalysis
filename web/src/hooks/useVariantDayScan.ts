import { useCallback } from "react";

import {
  fetchDeepak2DayScan,
  fetchDeepak3DayScan,
  fetchDeepakDayScan,
  fetchDeepakWatchPartyDayScan,
  fetchDeepproDayScan,
  fetchRulePnbDayScan,
} from "../api/client";
import type {
  DeepakDayScanPayload,
  DeepakWatchPartyDayScanPayload,
} from "../types/backtest";
import { useCancellableDayScan } from "./useCancellableDayScan";

export type DayScanRuleVariant =
  | "deepak"
  | "deepak2"
  | "deepak3"
  | "watchParty"
  | "deeppro"
  | "rulePnb";

export type VariantDayScanPayload = DeepakDayScanPayload | DeepakWatchPartyDayScanPayload;

export const DAY_SCAN_RULE_VARIANT_OPTIONS: ReadonlyArray<{
  value: DayScanRuleVariant;
  label: string;
}> = [
  { value: "deepak", label: "Deepak" },
  { value: "deepak2", label: "Deepak-2" },
  { value: "deepak3", label: "Deepak-3" },
  { value: "watchParty", label: "Watch Party" },
  { value: "deeppro", label: "Deeppro" },
  { value: "rulePnb", label: "RulePNB" },
];

export const DAY_SCAN_RULE_VARIANT_LABEL: Record<DayScanRuleVariant, string> = {
  deepak: "Deepak",
  deepak2: "Deepak-2",
  deepak3: "Deepak-3",
  watchParty: "Watch Party",
  deeppro: "Deeppro",
  rulePnb: "RulePNB",
};

export function isDayScanRuleVariant(
  value: string | null | undefined,
): value is DayScanRuleVariant {
  return (
    value === "deepak" ||
    value === "deepak2" ||
    value === "deepak3" ||
    value === "watchParty" ||
    value === "deeppro" ||
    value === "rulePnb"
  );
}

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
    case "rulePnb":
      return fetchRulePnbDayScan(date, signal);
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
