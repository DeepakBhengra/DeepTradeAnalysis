/** Shared mappings for single-stock favourable symbol rule variants. */

export const FAVOURABLE_RULE_SLUG = {
  ruleLtm: "ltm",
  ruleIcicigi: "icicigi",
  ruleTechm: "techm",
  ruleTvsmotor: "tvsmotor",
  rulePolicybzr: "policybzr",
} as const;

export const FAVOURABLE_RULE_SYMBOL = {
  ruleLtm: "LTM",
  ruleIcicigi: "ICICIGI",
  ruleTechm: "TECHM",
  ruleTvsmotor: "TVSMOTOR",
  rulePolicybzr: "POLICYBZR",
} as const;

export const FAVOURABLE_RULE_LABEL = {
  ruleLtm: "RuleLTM",
  ruleIcicigi: "RuleICICIGI",
  ruleTechm: "RuleTECHM",
  ruleTvsmotor: "RuleTVSMOTOR",
  rulePolicybzr: "RulePOLICYBZR",
} as const;

export type FavourableSymbolRuleVariant = keyof typeof FAVOURABLE_RULE_SLUG;

export const FAVOURABLE_SYMBOL_RULE_VARIANTS = Object.keys(
  FAVOURABLE_RULE_SLUG,
) as FavourableSymbolRuleVariant[];

export function isFavourableSymbolRuleVariant(
  value: string | null | undefined,
): value is FavourableSymbolRuleVariant {
  return (
    value === "ruleLtm" ||
    value === "ruleIcicigi" ||
    value === "ruleTechm" ||
    value === "ruleTvsmotor" ||
    value === "rulePolicybzr"
  );
}
