import {
  DAY_SCAN_RULE_VARIANT_LABEL,
  DAY_SCAN_RULE_VARIANT_OPTIONS,
  type DayScanRuleVariant,
} from "../hooks/useVariantDayScan";

/**
 * Simulator variant selector values.
 * `all` keeps the classic Deepak + Deepak-2 + Watch Party combined replay.
 */
export type DayScanSimulationVariant = "all" | DayScanRuleVariant;

export const DAY_SCAN_SIMULATION_VARIANT_OPTIONS: ReadonlyArray<{
  value: DayScanSimulationVariant;
  label: string;
}> = [
  { value: "all", label: "Deepak + Deepak-2 + Watch Party" },
  ...DAY_SCAN_RULE_VARIANT_OPTIONS,
];

export const DAY_SCAN_SIMULATION_VARIANT_LABEL: Record<
  DayScanSimulationVariant,
  string
> = {
  all: "Deepak + Deepak-2 + Watch Party",
  ...DAY_SCAN_RULE_VARIANT_LABEL,
};

export function isDayScanSimulationVariant(
  value: string | null | undefined,
): value is DayScanSimulationVariant {
  return (
    value === "all" ||
    DAY_SCAN_RULE_VARIANT_OPTIONS.some((option) => option.value === value)
  );
}

export function parseDayScanSimulationVariant(
  value: string | null | undefined,
): DayScanSimulationVariant {
  return isDayScanSimulationVariant(value) ? value : "all";
}
