import type { SamcoStrategy } from "./signalKeys.js";

/** Rule variants Samco can trade across the sector watchlist. */
export type SamcoRuleVariant =
  | "deepak+deepak2"
  | "deepak"
  | "deepak2"
  | "deepak3"
  | "watchParty"
  | "deeppro"
  | "deeppro1";

export const DEFAULT_SAMCO_RULE_VARIANT: SamcoRuleVariant = "deepak+deepak2";

export const SAMCO_RULE_VARIANT_VALUES: readonly SamcoRuleVariant[] = [
  "deepak+deepak2",
  "deepak",
  "deepak2",
  "deepak3",
  "watchParty",
  "deeppro",
  "deeppro1",
] as const;

export const SAMCO_RULE_VARIANT_LABEL: Record<SamcoRuleVariant, string> = {
  "deepak+deepak2": "Deepak + Deepak-2",
  deepak: "Deepak",
  deepak2: "Deepak-2",
  deepak3: "Deepak-3",
  watchParty: "Watch Party",
  deeppro: "Deeppro",
  deeppro1: "Deeppro1",
};

export const SAMCO_RULE_VARIANT_OPTIONS: ReadonlyArray<{
  value: SamcoRuleVariant;
  label: string;
}> = SAMCO_RULE_VARIANT_VALUES.map((value) => ({
  value,
  label: SAMCO_RULE_VARIANT_LABEL[value],
}));

export function isSamcoRuleVariant(
  value: string | null | undefined,
): value is SamcoRuleVariant {
  return (
    typeof value === "string" &&
    (SAMCO_RULE_VARIANT_VALUES as readonly string[]).includes(value)
  );
}

export function parseSamcoRuleVariant(
  value: string | null | undefined,
): SamcoRuleVariant {
  return isSamcoRuleVariant(value) ? value : DEFAULT_SAMCO_RULE_VARIANT;
}

/** Strategies the live loop should evaluate/process for a variant. */
export function strategiesForSamcoRuleVariant(
  variant: SamcoRuleVariant,
): SamcoStrategy[] {
  switch (variant) {
    case "deepak+deepak2":
      return ["deepak", "deepak2"];
    case "deepak":
      return ["deepak"];
    case "deepak2":
      return ["deepak2"];
    case "deepak3":
      return ["deepak3"];
    case "watchParty":
      return ["watchParty"];
    case "deeppro":
      return ["deeppro"];
    case "deeppro1":
      return ["deeppro1"];
  }
}
