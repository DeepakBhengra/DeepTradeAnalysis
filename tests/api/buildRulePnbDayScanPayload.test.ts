import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRulePnbDayScanPayload } from "../../src/api/buildRulePnbDayScanPayload.js";
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

describe("buildRulePnbDayScanPayload", () => {
  beforeEach(() => {
    fetchPnbCandlesMock.mockReset();
    warmKiteExchangeInstrumentsMock.mockReset();
    warmKiteExchangeInstrumentsMock.mockResolvedValue(undefined);
  });

  it("returns a PNB-only day-scan payload shape without throwing", async () => {
    fetchPnbCandlesMock.mockImplementation(async () =>
      makeCandles(
        "2026-05-11",
        Array.from({ length: 25 }, (_, index) => 100 + (index % 5)),
      ),
    );

    const payload = await buildRulePnbDayScanPayload({ date: "2026-05-11" });

    expect(payload.date).toBe("2026-05-11");
    expect(payload.summary.stocksScanned).toBe(1);
    expect(payload.summary.errorCount).toBe(0);
    expect(Array.isArray(payload.trades)).toBe(true);
    expect(payload.runAt).toBeTypeOf("string");
    expect(fetchPnbCandlesMock).toHaveBeenCalledTimes(1);
    expect(fetchPnbCandlesMock.mock.calls[0]?.[0]?.symbol).toBe("PNB");
    expect(
      payload.trades.every((trade) => trade.tradingSymbol === "PNB"),
    ).toBe(true);
  });

  it("captures a PNB fetch error without scanning other symbols", async () => {
    fetchPnbCandlesMock.mockImplementation(async () => {
      throw new Error("PNB feed failed");
    });

    const payload = await buildRulePnbDayScanPayload({ date: "2026-05-11" });
    expect(payload.summary.stocksScanned).toBe(1);
    expect(payload.summary.errorCount).toBe(1);
    expect(payload.errors.some((entry) => entry.tradingSymbol === "PNB")).toBe(true);
    expect(fetchPnbCandlesMock).toHaveBeenCalledTimes(1);
  });
});
