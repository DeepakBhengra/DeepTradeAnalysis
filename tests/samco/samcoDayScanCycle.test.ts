import { describe, expect, it, vi } from "vitest";
import { SECTOR_WATCHLIST } from "../../src/symbols/sectorWatchlist.js";

vi.mock("../../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/config.js")>();
  return {
    ...actual,
    config: {
      ...actual.config,
      symbolBatchDelayMs: 0,
    },
  };
});

vi.mock("../../src/data/pnbFeed.js", () => ({
  fetchPnbCandles: vi.fn(),
  getLatestClosedCandle: vi.fn(),
}));

describe("runSamcoDayScanCycle", () => {
  it("scans every sector watchlist symbol", async () => {
    const feed = await import("../../src/data/pnbFeed.js");
    vi.mocked(feed.fetchPnbCandles).mockResolvedValue([]);
    vi.mocked(feed.getLatestClosedCandle).mockReturnValue(undefined);

    const { runSamcoDayScanCycle } = await import("../../src/engine/samcoDayScanCycle.js");
    const result = await runSamcoDayScanCycle("2026-06-27");

    expect(result.symbols).toHaveLength(SECTOR_WATCHLIST.length);
    expect(feed.fetchPnbCandles).toHaveBeenCalledTimes(SECTOR_WATCHLIST.length);
  });
});
