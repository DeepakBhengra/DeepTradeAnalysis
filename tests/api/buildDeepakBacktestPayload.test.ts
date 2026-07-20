import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDeepakBacktestPayload,
  validateDeepakBacktestDates,
} from "../../src/api/buildDeepakBacktestPayload.js";
import type { Candle } from "../../src/types.js";

const { fetchPnbCandlesMock } = vi.hoisted(() => ({
  fetchPnbCandlesMock: vi.fn(),
}));

vi.mock("../../src/data/pnbFeed.js", () => ({
  fetchPnbCandles: fetchPnbCandlesMock,
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

describe("validateDeepakBacktestDates", () => {
  it("rejects invalid date formats", () => {
    expect(validateDeepakBacktestDates("2026-13-01", "2026-06-19")).toMatch(
      /Invalid date format/,
    );
  });

  it("rejects when from is after to", () => {
    expect(validateDeepakBacktestDates("2026-06-20", "2026-06-19")).toMatch(
      /from date must be on or before to date/,
    );
  });

  it("rejects ranges longer than 90 calendar days", () => {
    expect(validateDeepakBacktestDates("2026-01-01", "2026-06-19")).toMatch(
      /cannot exceed 90 calendar days/,
    );
  });

  it("accepts a valid range", () => {
    expect(validateDeepakBacktestDates("2026-05-01", "2026-06-19")).toBeNull();
  });
});

describe("buildDeepakBacktestPayload", () => {
  beforeEach(() => {
    fetchPnbCandlesMock.mockReset();
  });

  it("builds payload with symbol, dates, trades, and summary", async () => {
    fetchPnbCandlesMock.mockResolvedValue(
      makeCandles("2026-06-09", [100, 100, 100, 100, 99]),
    );

    const payload = await buildDeepakBacktestPayload({
      symbol: "pnb",
      fromDate: "2026-06-09",
      toDate: "2026-06-09",
    });

    expect(payload.symbol).toBe("NSE:PNB");
    expect(payload.tradingSymbol).toBe("PNB");
    expect(payload.fromDate).toBe("2026-06-09");
    expect(payload.toDate).toBe("2026-06-09");
    expect(payload.runAt).toBeTypeOf("string");
    expect(payload.summary.tradingDaysScanned).toBe(1);
    expect(payload.summary.totalSignals).toBeGreaterThanOrEqual(0);
    expect(fetchPnbCandlesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "PNB",
        fromDate: "2026-06-09",
        toDate: "2026-06-09",
      }),
    );
  });

  it("throws on invalid date range", async () => {
    await expect(
      buildDeepakBacktestPayload({
        symbol: "RELIANCE",
        fromDate: "2026-06-20",
        toDate: "2026-06-19",
      }),
    ).rejects.toThrow(/from date must be on or before to date/);
  });
});
