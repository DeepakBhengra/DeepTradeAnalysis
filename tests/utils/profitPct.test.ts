import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEEPPRO1_PROFIT_PCT,
  normalizeProfitPct,
} from "../../src/utils/profitPct.js";

describe("normalizeProfitPct", () => {
  it("keeps valid positive percentages", () => {
    expect(normalizeProfitPct(0.45)).toBe(0.45);
    expect(normalizeProfitPct(1)).toBe(1);
    expect(normalizeProfitPct(2)).toBe(2);
  });

  it("falls back for blank, zero, negative, or non-finite", () => {
    expect(normalizeProfitPct(null)).toBe(DEFAULT_DEEPPRO1_PROFIT_PCT);
    expect(normalizeProfitPct(undefined)).toBe(DEFAULT_DEEPPRO1_PROFIT_PCT);
    expect(normalizeProfitPct(0)).toBe(DEFAULT_DEEPPRO1_PROFIT_PCT);
    expect(normalizeProfitPct(-1)).toBe(DEFAULT_DEEPPRO1_PROFIT_PCT);
    expect(normalizeProfitPct(Number.NaN)).toBe(DEFAULT_DEEPPRO1_PROFIT_PCT);
  });

  it("uses a custom fallback when provided", () => {
    expect(normalizeProfitPct(null, 0.75)).toBe(0.75);
  });
});
