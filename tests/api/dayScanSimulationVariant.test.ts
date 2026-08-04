import { describe, expect, it } from "vitest";
import {
  dayScanStrategyForVariant,
  lockedTradingSymbolForSimulationVariant,
  parseDayScanSimulationVariant,
  watchlistForSimulationVariant,
} from "../../src/api/dayScanSimulationVariant.js";
import { SECTOR_WATCHLIST } from "../../src/symbols/sectorWatchlist.js";

describe("dayScanSimulationVariant", () => {
  it("defaults unknown values to all", () => {
    expect(parseDayScanSimulationVariant(undefined)).toBe("all");
    expect(parseDayScanSimulationVariant("nope")).toBe("all");
    expect(parseDayScanSimulationVariant("deeppro1")).toBe("deeppro1");
  });

  it("maps rule variants onto simulation strategy ids", () => {
    expect(dayScanStrategyForVariant("deepak")).toBe("deepak");
    expect(dayScanStrategyForVariant("deepak2")).toBe("deepak-2");
    expect(dayScanStrategyForVariant("watchParty")).toBe("deepak-watch-party");
    expect(dayScanStrategyForVariant("deeppro1")).toBe("deeppro1");
  });

  it("locks single-symbol rules and keeps full watchlist for Deeppro1", () => {
    expect(lockedTradingSymbolForSimulationVariant("rulePnb")).toBe("PNB");
    expect(lockedTradingSymbolForSimulationVariant("deeppro1")).toBeNull();
    expect(watchlistForSimulationVariant("deeppro1")).toHaveLength(
      SECTOR_WATCHLIST.length,
    );
    expect(watchlistForSimulationVariant("rulePnb")).toEqual([
      expect.objectContaining({ tradingSymbol: "PNB" }),
    ]);
  });
});
