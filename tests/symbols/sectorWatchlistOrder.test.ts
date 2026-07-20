import { describe, expect, it } from "vitest";
import { SECTOR_WATCHLIST } from "../../src/symbols/sectorWatchlist.js";
import {
  buildSectorRandomizedWatchlist,
  shuffleArray,
} from "../../src/symbols/sectorWatchlistOrder.js";

describe("sectorWatchlistOrder", () => {
  it("returns every watchlist symbol exactly once", () => {
    const ordered = buildSectorRandomizedWatchlist(SECTOR_WATCHLIST, () => 0.5);
    expect(ordered).toHaveLength(SECTOR_WATCHLIST.length);
    expect(new Set(ordered.map((entry) => entry.tradingSymbol)).size).toBe(
      SECTOR_WATCHLIST.length,
    );
  });

  it("interleaves sectors instead of keeping the fixed watchlist block order", () => {
    let call = 0;
    const random = () => {
      call += 1;
      return call % 7 === 0 ? 0.01 : 0.99;
    };

    const ordered = buildSectorRandomizedWatchlist(SECTOR_WATCHLIST, random);
    const firstNineSectors = ordered.slice(0, 9).map((entry) => entry.sector);
    expect(new Set(firstNineSectors).size).toBeGreaterThan(1);
  });

  it("can differ from the default sequential watchlist order", () => {
    const ordered = buildSectorRandomizedWatchlist(
      SECTOR_WATCHLIST,
      () => 0.42,
    );
    const sequential = SECTOR_WATCHLIST.map((entry) => entry.tradingSymbol);
    const randomized = ordered.map((entry) => entry.tradingSymbol);
    expect(randomized).not.toEqual(sequential);
  });

  it("shuffleArray is deterministic and preserves all items", () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const input = [1, 2, 3, 4];
    const first = shuffleArray(input, random);
    seed = 1;
    const second = shuffleArray(input, random);

    expect(first).toEqual(second);
    expect(first).toHaveLength(input.length);
    expect([...first].sort()).toEqual([...input].sort());
  });
});
