import { describe, expect, it, vi } from "vitest";
import {
  isKiteAuthScanError,
  runBatchedSectorScan,
} from "../../src/api/runBatchedSectorScan.js";
import type { SectorWatchlistEntry } from "../../src/symbols/sectorWatchlist.js";

vi.mock("../../src/data/pnbFeed.js", () => ({
  warmKiteExchangeInstruments: vi.fn().mockResolvedValue(undefined),
}));

const entries: SectorWatchlistEntry[] = [
  { tradingSymbol: "AAA", sector: "Bank" },
  { tradingSymbol: "BBB", sector: "IT" },
  { tradingSymbol: "CCC", sector: "Metal" },
  { tradingSymbol: "DDD", sector: "Bank" },
];

describe("isKiteAuthScanError", () => {
  it("detects Kite auth messages", () => {
    expect(
      isKiteAuthScanError(
        "Kite access_token expired or invalid. Generate a new token and update KITE_ACCESS_TOKEN in .env.",
      ),
    ).toBe(true);
    expect(isKiteAuthScanError("PNB: timed out after 25s")).toBe(false);
  });
});

describe("runBatchedSectorScan", () => {
  it("aborts remaining symbols after repeated auth failures", async () => {
    const scan = vi.fn(async (entry: SectorWatchlistEntry) => ({
      tradingSymbol: entry.tradingSymbol,
      error:
        entry.tradingSymbol === "AAA" || entry.tradingSymbol === "BBB"
          ? "Kite access_token expired or invalid."
          : null,
    }));

    const result = await runBatchedSectorScan({
      entries,
      concurrency: 2,
      batchDelayMs: 0,
      scan,
      resolveError: (value) => value.error,
    });

    expect(scan).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
    expect(result.skippedEntries).toHaveLength(2);
    expect(result.abortedEarly).toBe(true);
    expect(result.abortReason).toMatch(/Kite access_token expired/);
  });

  it("scans all symbols when failures are not auth-related", async () => {
    const scan = vi.fn(async (entry: SectorWatchlistEntry) => ({
      tradingSymbol: entry.tradingSymbol,
      error: entry.tradingSymbol === "AAA" ? "Network timeout" : null,
    }));

    const result = await runBatchedSectorScan({
      entries,
      concurrency: 2,
      batchDelayMs: 0,
      scan,
      resolveError: (value) => value.error,
    });

    expect(scan).toHaveBeenCalledTimes(entries.length);
    expect(result.skippedEntries).toHaveLength(0);
    expect(result.abortedEarly).toBe(false);
  });
});
