/** Rule engines selectable in Deepak Day Scan. */
export type DayScanRuleVariant = "deepak" | "deepak2" | "deepak3" | "watchParty";

/** Rule engines selectable in Deepak Post-Mortem (dashboard-backed). */
export type PostMortemRuleVariant = "deepak" | "deepak2";

export const DAY_SCAN_RULE_VARIANT_OPTIONS: ReadonlyArray<{
  value: DayScanRuleVariant;
  label: string;
}> = [
  { value: "deepak", label: "Deepak" },
  { value: "deepak2", label: "Deepak-2" },
  { value: "deepak3", label: "Deepak-3" },
  { value: "watchParty", label: "Watch Party" },
];

export const POST_MORTEM_RULE_VARIANT_OPTIONS: ReadonlyArray<{
  value: PostMortemRuleVariant;
  label: string;
}> = [
  { value: "deepak", label: "Deepak" },
  { value: "deepak2", label: "Deepak-2" },
];

export const DAY_SCAN_RULE_VARIANT_LABEL: Record<DayScanRuleVariant, string> = {
  deepak: "Deepak",
  deepak2: "Deepak-2",
  deepak3: "Deepak-3",
  watchParty: "Watch Party",
};

export function isDayScanRuleVariant(value: string | null | undefined): value is DayScanRuleVariant {
  return (
    value === "deepak" ||
    value === "deepak2" ||
    value === "deepak3" ||
    value === "watchParty"
  );
}

export function isPostMortemRuleVariant(
  value: string | null | undefined,
): value is PostMortemRuleVariant {
  return value === "deepak" || value === "deepak2";
}
