import { describe, expect, it } from "vitest";

import {

  getSectorWatchlistSymbols,

  SECTOR_ORDER,

  SECTOR_WATCHLIST,

} from "../../src/symbols/sectorWatchlist.js";



describe("sectorWatchlist", () => {

  it("contains 50 symbols across 6 sectors", () => {

    expect(SECTOR_WATCHLIST).toHaveLength(50);

    expect(SECTOR_ORDER).toHaveLength(6);

    expect(new Set(SECTOR_ORDER).size).toBe(6);

  });



  it("has no duplicate trading symbols", () => {

    const symbols = getSectorWatchlistSymbols();

    expect(new Set(symbols).size).toBe(symbols.length);

  });



  it("maps each sector to 8 or 9 symbols", () => {

    for (const sector of SECTOR_ORDER) {

      const count = SECTOR_WATCHLIST.filter((entry) => entry.sector === sector).length;

      expect(count).toBeGreaterThanOrEqual(8);

      expect(count).toBeLessThanOrEqual(9);

    }

  });

});


