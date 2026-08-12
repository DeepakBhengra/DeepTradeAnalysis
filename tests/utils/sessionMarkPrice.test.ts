import { describe, expect, it } from "vitest";

import {
  candleMidPrice,
  lastSameDaySessionMark,
  withOpenTradeMarkPrices,
} from "../../src/utils/sessionMarkPrice.js";

describe("sessionMarkPrice", () => {
  it("computes candle mid", () => {
    expect(candleMidPrice({ high: 110, low: 100 })).toBe(105);
  });

  it("picks last same-day session mark", () => {
    const mark = lastSameDaySessionMark(
      [
        {
          timestamp: new Date("2026-06-09T03:45:00.000Z"), // 09:15 IST
          high: 100,
          low: 90,
        },
        {
          timestamp: new Date("2026-06-09T04:00:00.000Z"), // 09:30 IST
          high: 120,
          low: 100,
        },
        {
          timestamp: new Date("2026-06-10T04:00:00.000Z"), // next day
          high: 200,
          low: 180,
        },
      ],
      "2026-06-09",
    );
    expect(mark?.price).toBe(110);
    expect(mark?.timeIst).toBe("09:30");
  });

  it("attaches mark only to open trades", () => {
    const trades = withOpenTradeMarkPrices(
      [
        { exitTimeIst: null as string | null, id: "open" },
        { exitTimeIst: "11:00", id: "closed" },
      ],
      [
        {
          timestamp: new Date("2026-06-09T04:00:00.000Z"),
          high: 120,
          low: 100,
        },
      ],
      "2026-06-09",
    );
    expect(trades[0].markPrice).toBe(110);
    expect(trades[1].markPrice).toBeNull();
  });
});
