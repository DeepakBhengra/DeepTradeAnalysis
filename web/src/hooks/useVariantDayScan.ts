import { useCallback } from "react";

import {
  fetchDeepak2DayScan,
  fetchDeepak3DayScan,
  fetchDeepakDayScan,
  fetchDeepakWatchPartyDayScan,
  fetchDeepproDayScan,
  fetchDeeppro1DayScan,
  fetchFavourableSymbolDayScan,
  fetchRulePnbDayScan,
  fetchRuleSunpharmaDayScan,
} from "../api/client";
import type {
  DeepakDayScanPayload,
  DeepakWatchPartyDayScanPayload,
} from "../types/backtest";
import {
  FAVOURABLE_RULE_LABEL,
  FAVOURABLE_RULE_SLUG,
  isFavourableSymbolRuleVariant,
} from "../utils/favourableSymbolRule";
import { useCancellableDayScan } from "./useCancellableDayScan";

export type DayScanRuleVariant =
  | "deepak"
  | "deepak2"
  | "deepak3"
  | "watchParty"
  | "deeppro"
  | "deeppro1"
  | "rulePnb"
  | "ruleSunpharma"
  | "ruleLtm"
  | "ruleIcicigi"
  | "ruleTechm"
  | "ruleTvsmotor"
  | "rulePolicybzr";

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
  { value: "deeppro1", label: "Deeppro1" },
  { value: "rulePnb", label: "RulePNB" },
  { value: "ruleSunpharma", label: "RuleSUNPHARMA" },
  { value: "ruleLtm", label: FAVOURABLE_RULE_LABEL.ruleLtm },
  { value: "ruleIcicigi", label: FAVOURABLE_RULE_LABEL.ruleIcicigi },
  { value: "ruleTechm", label: FAVOURABLE_RULE_LABEL.ruleTechm },
  { value: "ruleTvsmotor", label: FAVOURABLE_RULE_LABEL.ruleTvsmotor },
  { value: "rulePolicybzr", label: FAVOURABLE_RULE_LABEL.rulePolicybzr },
];

export const DAY_SCAN_RULE_VARIANT_LABEL: Record<DayScanRuleVariant, string> = {
  deepak: "Deepak",
  deepak2: "Deepak-2",
  deepak3: "Deepak-3",
  watchParty: "Watch Party",
  deeppro: "Deeppro",
  deeppro1: "Deeppro1",
  rulePnb: "RulePNB",
  ruleSunpharma: "RuleSUNPHARMA",
  ruleLtm: FAVOURABLE_RULE_LABEL.ruleLtm,
  ruleIcicigi: FAVOURABLE_RULE_LABEL.ruleIcicigi,
  ruleTechm: FAVOURABLE_RULE_LABEL.ruleTechm,
  ruleTvsmotor: FAVOURABLE_RULE_LABEL.ruleTvsmotor,
  rulePolicybzr: FAVOURABLE_RULE_LABEL.rulePolicybzr,
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
    value === "deeppro1" ||
    value === "rulePnb" ||
    value === "ruleSunpharma" ||
    isFavourableSymbolRuleVariant(value)
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
    case "deeppro1":
      return fetchDeeppro1DayScan(date, signal);
    case "rulePnb":
      return fetchRulePnbDayScan(date, signal);
    case "ruleSunpharma":
      return fetchRuleSunpharmaDayScan(date, signal);
    case "ruleLtm":
    case "ruleIcicigi":
    case "ruleTechm":
    case "ruleTvsmotor":
    case "rulePolicybzr":
      return fetchFavourableSymbolDayScan(FAVOURABLE_RULE_SLUG[variant], date, signal);
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
