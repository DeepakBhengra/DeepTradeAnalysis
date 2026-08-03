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
      | "rulePnbDecision"
      | "ruleSunpharmaDecision"
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
    rulePnbDecision: null,
    ruleSunpharmaDecision: null,
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
    expect(postMortemVariantForDayScan("rulePnb")).toBe("rulePnb");
    expect(postMortemVariantForDayScan("ruleSunpharma")).toBe("ruleSunpharma");
  });

  it("picks the matching dashboard decision", () => {
    const deepak = { dateKey: "2026-06-29", decision: "BUY" as const };
    const deepak2 = { dateKey: "2026-06-29", decision: "SELL" as const };
    const deeppro = { dateKey: "2026-06-29", decision: "SELL" as const };
    const rulePnb = { dateKey: "2026-06-29", decision: "BUY" as const };
    const ruleSunpharma = { dateKey: "2026-06-29", decision: "SELL" as const };
    const payload = stubPayload({
      deepakDecision: deepak as never,
      deepak2Decision: deepak2 as never,
      deepproDecision: deeppro as never,
      rulePnbDecision: rulePnb as never,
      ruleSunpharmaDecision: ruleSunpharma as never,
    });

    expect(decisionForDayScanVariant(payload, "deepak")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "deepak3")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "watchParty")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "deepak2")?.decision).toBe("SELL");
    expect(decisionForDayScanVariant(payload, "deeppro")?.decision).toBe("SELL");
    expect(decisionForDayScanVariant(payload, "rulePnb")?.decision).toBe("BUY");
    expect(decisionForDayScanVariant(payload, "ruleSunpharma")?.decision).toBe(
      "SELL",
    );
  });
});
