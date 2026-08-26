import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEEPPRO1_PROFIT_PCT,
  normalizeProfitPct,
} from "./profitPct";

describe("normalizeProfitPct (web)", () => {
  it("keeps valid values and falls back otherwise", () => {
    expect(normalizeProfitPct(0.75)).toBe(0.75);
    expect(normalizeProfitPct(0)).toBe(DEFAULT_DEEPPRO1_PROFIT_PCT);
    expect(normalizeProfitPct(null)).toBe(DEFAULT_DEEPPRO1_PROFIT_PCT);
  });
});
