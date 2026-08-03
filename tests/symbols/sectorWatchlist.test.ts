import { describe, expect, it } from "vitest";

import {
  getSectorWatchlistSymbols,
  SECTOR_ORDER,
  SECTOR_WATCHLIST,
} from "../../src/symbols/sectorWatchlist.js";

describe("sectorWatchlist", () => {
  it("contains 100 unique symbols across expanded sectors", () => {
    expect(SECTOR_WATCHLIST).toHaveLength(100);
    expect(SECTOR_ORDER.length).toBeGreaterThanOrEqual(6);
    expect(new Set(SECTOR_ORDER).size).toBe(SECTOR_ORDER.length);
    expect(new Set(getSectorWatchlistSymbols()).size).toBe(100);
  });

  it("maps every entry to a known sector", () => {
    for (const entry of SECTOR_WATCHLIST) {
      expect(SECTOR_ORDER).toContain(entry.sector);
    }
  });

  it("keeps core sectors populated", () => {
    for (const sector of [
      "Bank",
      "IT",
      "Metal",
      "Insurance",
      "Automobile",
      "Health",
    ] as const) {
      const count = SECTOR_WATCHLIST.filter((entry) => entry.sector === sector)
        .length;
      expect(count).toBeGreaterThanOrEqual(8);
    }
  });
});
