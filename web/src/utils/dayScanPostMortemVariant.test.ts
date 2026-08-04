import { describe, expect, it } from "vitest";

import type { DashboardPayload } from "../types/dashboard";
import {
  decisionForDayScanVariant,
  postMortemVariantForDayScan,
} from "./dayScanPostMortemVariant";

function stubPayload(
  overrides: Partial<
    Pick<
      DashboardPayload,
      | "deepakDecision"
      | "deepak2Decision"
      | "deepproDecision"
      | "deeppro1Decision"
      | "rulePnbDecision"
      | "ruleSunpharmaDecision"
      | "favourableSymbolDecision"
      | "favourableSymbolRuleId"
    >
  >,
): DashboardPayload {
  return {
    symbol: "NSE:TEST",
    tradingSymbol: "TEST",
    mode: "historical",
    analysisDate: "2026-06-29",
    updatedAt: new Date().toISOString(),
    decision: "HOLD",
    deepakDecision: null,
    deepak2Decision: null,
    deepproDecision: null,
    deeppro1Decision: null,
    rulePnbDecision: null,
    ruleSunpharmaDecision: null,
    favourableSymbolDecision: null,
    favourableSymbolRuleId: null,
    series: [],
    reasons: [],
    ...overrides,
  } as unknown as DashboardPayload;
}

describe("dayScanPostMortemVariant", () => {
  it("maps day-scan variants onto post-mortem path graders", () => {
    expect(postMortemVariantForDayScan("deepak")).toBe("deepak");
    expect(postMortemVariantForDayScan("deepak3")).toBe("deepak");
    expect(postMortemVariantForDayScan("watchParty")).toBe("deepak");
    expect(postMortemVariantForDayScan("deepak2")).toBe("deepak2");
    expect(postMortemVariantForDayScan("deeppro")).toBe("deeppro");
    expect(postMortemVariantForDayScan("deeppro1")).toBe("deeppro1");
    expect(postMortemVariantForDayScan("rulePnb")).toBe("rulePnb");
    expect(postMortemVariantForDayScan("ruleSunpharma")).toBe("ruleSunpharma");
    expect(postMortemVariantForDayScan("ruleLtm")).toBe("ruleLtm");
    expect(postMortemVariantForDayScan("ruleIcicigi")).toBe("ruleIcicigi");
    expect(postMortemVariantForDayScan("ruleTechm")).toBe("ruleTechm");
    expect(postMortemVariantForDayScan("ruleTvsmotor")).toBe("ruleTvsmotor");
    expect(postMortemVariantForDayScan("rulePolicybzr")).toBe("rulePolicybzr");
  });

  it("picks the matching dashboard decision", () => {
    const deepak = { dateKey: "2026-06-29", decision: "BUY" as const };
    const deepak2 = { dateKey: "2026-06-29", decision: "SELL" as const };
    const deeppro = { dateKey: "2026-06-29", decision: "SELL" as const };
    const deeppro1 = { dateKey: "2026-06-29", decision: "BUY" as const };
    const rulePnb = { dateKey: "2026-06-29", decision: "BUY" as const };
    const ruleSunpharma = { dateKey: "2026-06-29", decision: "SELL" as const };
    const favourable = { dateKey: "2026-06-29", decision: "BUY" as const };
    const payload = stubPayload({
      deepakDecision: deepak as never,
      deepak2Decision: deepak2 as never,
      deepproDecision: deeppro as never,
      deeppro1Decision: deeppro1 as never,
      rulePnbDecision: rulePnb as never,
      ruleSunpharmaDecision: ruleSunpharma as never,
      favourableSymbolDecision: favourable as never,
      favourableSymbolRuleId: "ruleLtm",
    });

    expect(decisionForDayScanVariant(payload, "deepak")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "deepak3")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "watchParty")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "deepak2")?.decision).toBe("SELL");
    expect(decisionForDayScanVariant(payload, "deeppro")?.decision).toBe("SELL");
    expect(decisionForDayScanVariant(payload, "deeppro1")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "rulePnb")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "ruleSunpharma")?.decision).toBe(
      "SELL",
    );
    expect(decisionForDayScanVariant(payload, "ruleLtm")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "rulePolicybzr")?.decision).toBe(
      "BUY",
    );
  });
});
