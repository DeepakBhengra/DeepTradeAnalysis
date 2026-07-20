import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDeepakDayScanPayload,
  validateDayScanDate,
} from "../../src/api/buildDeepakDayScanPayload.js";
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

describe("validateDayScanDate", () => {
  it("rejects invalid date formats", () => {
    expect(validateDayScanDate("2026-13-01")).toMatch(/Invalid date format/);
  });

  it("accepts a valid date", () => {
    expect(validateDayScanDate("2026-06-09")).toBeNull();
  });
});

describe("buildDeepakDayScanPayload", () => {
  beforeEach(() => {
    fetchPnbCandlesMock.mockReset();
  });

  it(
    "aggregates trades with symbol and sector metadata",
    async () => {
      fetchPnbCandlesMock.mockImplementation(async (options: { symbol: string }) => {
        if (options.symbol === "PNB") {
          throw new Error("PNB not in watchlist");
        }
        if (options.symbol === "TCS") {
          return makeCandles("2026-06-09", [100, 100, 100, 100, 99]);
        }
        return makeCandles("2026-06-09", [100, 100, 100, 100, 100]);
      });

      const payload = await buildDeepakDayScanPayload({ date: "2026-06-09" });

      expect(payload.date).toBe("2026-06-09");
      expect(payload.summary.stocksScanned).toBe(SECTOR_WATCHLIST.length);
      expect(payload.runAt).toBeTypeOf("string");
      expect(fetchPnbCandlesMock).toHaveBeenCalledTimes(SECTOR_WATCHLIST.length);

      if (payload.trades.length > 0) {
        expect(payload.trades[0]).toEqual(
          expect.objectContaining({
            symbol: expect.stringMatching(/^NSE:/),
            tradingSymbol: expect.any(String),
            sector: expect.any(String),
            profitTarget: expect.any(Number),
          }),
        );
      }
    },
    20_000,
  );

  it(
    "stops early after repeated Kite auth failures",
    async () => {
      fetchPnbCandlesMock.mockRejectedValue(
        new Error(
          "Kite access_token expired or invalid. Generate a new token and update KITE_ACCESS_TOKEN in .env.",
        ),
      );

      const payload = await buildDeepakDayScanPayload({ date: "2026-06-09" });

      expect(fetchPnbCandlesMock.mock.calls.length).toBeLessThan(SECTOR_WATCHLIST.length);
      expect(payload.errors).toHaveLength(SECTOR_WATCHLIST.length);
      expect(payload.summary.errorCount).toBe(SECTOR_WATCHLIST.length);
      expect(payload.trades).toHaveLength(0);
      expect(payload.errors[0]?.error).toMatch(/Kite access_token expired/);
      expect(payload.errors.at(-1)?.error).toMatch(/scan stopped early/);
    },
    20_000,
  );

  it("throws on invalid date", async () => {
    await expect(buildDeepakDayScanPayload({ date: "bad-date" })).rejects.toThrow(
      /Invalid date format/,
    );
  });
});
