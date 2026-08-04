import type { DashboardPayload } from "../types/dashboard";
import type { PostMortemVariant } from "../types/postMortem";
import type { DayScanRuleVariant } from "../hooks/useVariantDayScan";
import { isFavourableSymbolRuleVariant } from "./favourableSymbolRule";

/**
 * Map Day Scan rule variants onto the dashboard decision / post-mortem grader.
 * Deepak-3 shares Deepak path grading; Watch Party entries are Deepak-timed.
 */
export function postMortemVariantForDayScan(
  variant: DayScanRuleVariant,
): PostMortemVariant {
  switch (variant) {
    case "deepak2":
      return "deepak2";
    case "deeppro":
      return "deeppro";
    case "deeppro1":
      return "deeppro1";
    case "rulePnb":
      return "rulePnb";
    case "ruleSunpharma":
      return "ruleSunpharma";
    case "ruleLtm":
    case "ruleIcicigi":
    case "ruleTechm":
    case "ruleTvsmotor":
    case "rulePolicybzr":
      return variant;
    case "watchParty":
      return "deepak";
    case "deepak3":
    case "deepak":
    default:
      return "deepak";
  }
}

export function decisionForDayScanVariant(
  payload: DashboardPayload,
  variant: DayScanRuleVariant,
) {
  const postMortemVariant = postMortemVariantForDayScan(variant);
  if (postMortemVariant === "deepak2") {
    return payload.deepak2Decision;
  }
  if (postMortemVariant === "deeppro") {
    return payload.deepproDecision;
  }
  if (postMortemVariant === "deeppro1") {
    return payload.deeppro1Decision;
  }
  if (postMortemVariant === "rulePnb") {
    return payload.rulePnbDecision;
  }
  if (postMortemVariant === "ruleSunpharma") {
    return payload.ruleSunpharmaDecision;
  }
  if (isFavourableSymbolRuleVariant(postMortemVariant)) {
    return payload.favourableSymbolDecision;
  }
  return payload.deepakDecision;
}
