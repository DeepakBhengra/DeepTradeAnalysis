export type SamcoRuleVariant =
  | "deepak+deepak2"
  | "deepak"
  | "deepak2"
  | "deepak3"
  | "watchParty"
  | "deeppro"
  | "deeppro1";

export const DEFAULT_SAMCO_RULE_VARIANT: SamcoRuleVariant = "deepak+deepak2";

export const SAMCO_RULE_VARIANT_OPTIONS: ReadonlyArray<{
  value: SamcoRuleVariant;
  label: string;
}> = [
  { value: "deepak+deepak2", label: "Deepak + Deepak-2" },
  { value: "deepak", label: "Deepak" },
  { value: "deepak2", label: "Deepak-2" },
  { value: "deepak3", label: "Deepak-3" },
  { value: "watchParty", label: "Watch Party" },
  { value: "deeppro", label: "Deeppro" },
  { value: "deeppro1", label: "Deeppro1" },
];

export const SAMCO_RULE_VARIANT_LABEL: Record<SamcoRuleVariant, string> = {
  "deepak+deepak2": "Deepak + Deepak-2",
  deepak: "Deepak",
  deepak2: "Deepak-2",
  deepak3: "Deepak-3",
  watchParty: "Watch Party",
  deeppro: "Deeppro",
  deeppro1: "Deeppro1",
};

export function isSamcoRuleVariant(
  value: string | null | undefined,
): value is SamcoRuleVariant {
  return SAMCO_RULE_VARIANT_OPTIONS.some((option) => option.value === value);
}
