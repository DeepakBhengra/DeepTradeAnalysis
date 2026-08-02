import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDeepproDayScanPayload } from "../../src/api/buildDeepproDayScanPayload.js";
import { SECTOR_WATCHLIST } from "../../src/symbols/sectorWatchlist.js";
import type { Candle } from "../../src/types.js";

const { fetchPnbCandlesMock, warmKiteExchangeInstrumentsMock } = vi.hoisted(() => ({
  fetchPnbCandlesMock: vi.fn(),
  warmKiteExchangeInstrumentsMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/data/pnbFeed.js", () => ({
  fetchPnbCandles: fetchPnbCandlesMock,
  warmKiteExchangeInstruments: warmKiteExchangeInstrumentsMock,
}));

function makeCandles(sessionDate: string, closes: number[]): Candle[] {
  return closes.map((close, index) => {
    const totalMinutes = 9 * 60 + 15 + index * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    return {
      timestamp: new Date(
        `${sessionDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
      ),
      open: close - 0.2,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 1000 + index,
    };
  });
}

describe("buildDeepproDayScanPayload", () => {
  beforeEach(() => {
    fetchPnbCandlesMock.mockReset();
    warmKiteExchangeInstrumentsMock.mockReset();
    warmKiteExchangeInstrumentsMock.mockResolvedValue(undefined);
  });

  it("returns a standard day-scan payload shape without throwing", async () => {
    fetchPnbCandlesMock.mockImplementation(async () =>
      makeCandles(
        "2026-05-11",
        Array.from({ length: 25 }, (_, index) => 100 + (index % 5)),
      ),
    );

    const payload = await buildDeepproDayScanPayload({ date: "2026-05-11" });

    expect(warmKiteExchangeInstrumentsMock).toHaveBeenCalled();
    expect(payload.date).toBe("2026-05-11");
    expect(payload.summary.stocksScanned).toBe(SECTOR_WATCHLIST.length);
    expect(payload.summary.errorCount).toBe(0);
    expect(Array.isArray(payload.trades)).toBe(true);
    expect(payload.runAt).toBeTypeOf("string");
  });

  it("captures per-symbol fetch errors instead of failing the whole scan", async () => {
    fetchPnbCandlesMock.mockImplementation(async (options: { symbol: string }) => {
      if (options.symbol === "TCS") {
        throw new Error("TCS feed failed");
      }
      return makeCandles("2026-05-11", [100, 101, 102, 103, 104]);
    });

    const payload = await buildDeepproDayScanPayload({ date: "2026-05-11" });
    expect(payload.summary.errorCount).toBeGreaterThan(0);
    expect(payload.errors.some((entry) => entry.tradingSymbol === "TCS")).toBe(true);
  });
});
