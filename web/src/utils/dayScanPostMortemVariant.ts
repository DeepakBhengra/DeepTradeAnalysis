import type { DashboardPayload } from "../types/dashboard";
import type { PostMortemVariant } from "../types/postMortem";
import type { DayScanRuleVariant } from "../hooks/useVariantDayScan";

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
    case "rulePnb":
      return "rulePnb";
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
  if (postMortemVariant === "rulePnb") {
    return payload.rulePnbDecision;
  }
  return payload.deepakDecision;
}
