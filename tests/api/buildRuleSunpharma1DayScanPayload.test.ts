import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/data/pnbFeed.js", () => ({
  fetchPnbCandles: vi.fn(async () => []),
}));

vi.mock("../../src/api/runBatchedSectorScan.js", () => ({
  withDayScanSymbolTimeout: vi.fn(async <T>(promise: Promise<T>) => promise),
}));

import { buildRuleSunpharma1DayScanPayload } from "../../src/api/buildRuleSunpharma1DayScanPayload.js";

describe("buildRuleSunpharma1DayScanPayload", () => {
  it("rejects invalid dates", async () => {
    await expect(
      buildRuleSunpharma1DayScanPayload({ date: "not-a-date" }),
    ).rejects.toThrow(/date/i);
  });

  it("scans SUNPHARMA only and returns a day-scan payload shape", async () => {
    const payload = await buildRuleSunpharma1DayScanPayload({
      date: "2026-03-10",
    });
    expect(payload.date).toBe("2026-03-10");
    expect(payload.summary.stocksScanned).toBe(1);
    expect(Array.isArray(payload.trades)).toBe(true);
    expect(Array.isArray(payload.errors)).toBe(true);
  });
});
