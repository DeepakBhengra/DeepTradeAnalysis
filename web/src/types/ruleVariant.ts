/** Rule engines selectable in Deepak Day Scan. */
export type DayScanRuleVariant =
  | "deepak"
  | "deepak2"
  | "deepak3"
  | "watchParty"
  | "deeppro";

/** Rule engines selectable in Deepak Post-Mortem. */
export type PostMortemRuleVariant = "deepak" | "deepak2" | "deeppro";

export const DAY_SCAN_RULE_VARIANT_OPTIONS: ReadonlyArray<{
  value: DayScanRuleVariant;
  label: string;
}> = [
  { value: "deepak", label: "Deepak" },
  { value: "deepak2", label: "Deepak-2" },
  { value: "deepak3", label: "Deepak-3" },
  { value: "watchParty", label: "Watch Party" },
  { value: "deeppro", label: "Deeppro" },
];

export const POST_MORTEM_RULE_VARIANT_OPTIONS: ReadonlyArray<{
  value: PostMortemRuleVariant;
  label: string;
}> = [
  { value: "deepak", label: "Deepak" },
  { value: "deepak2", label: "Deepak-2" },
  { value: "deeppro", label: "Deeppro" },
];

export const DAY_SCAN_RULE_VARIANT_LABEL: Record<DayScanRuleVariant, string> = {
  deepak: "Deepak",
  deepak2: "Deepak-2",
  deepak3: "Deepak-3",
  watchParty: "Watch Party",
  deeppro: "Deeppro",
};

export const POST_MORTEM_RULE_VARIANT_LABEL: Record<PostMortemRuleVariant, string> = {
  deepak: "Deepak",
  deepak2: "Deepak-2",
  deeppro: "Deeppro",
};

export function isDayScanRuleVariant(value: string | null | undefined): value is DayScanRuleVariant {
  return (
    value === "deepak" ||
    value === "deepak2" ||
    value === "deepak3" ||
    value === "watchParty" ||
    value === "deeppro"
  );
}

export function isPostMortemRuleVariant(
  value: string | null | undefined,
): value is PostMortemRuleVariant {
  return value === "deepak" || value === "deepak2" || value === "deeppro";
}
