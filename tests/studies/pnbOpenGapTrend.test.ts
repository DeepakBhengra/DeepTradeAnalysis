import { describe, expect, it } from "vitest";
import {
  buildPnbOpenGapRows,
  classifyCandleColor,
  classifyDayTrend,
  classifyGap,
  sessionHighLow,
} from "../../src/studies/pnbOpenGapTrend.js";

describe("pnbOpenGapTrend", () => {
  it("classifies a 09:15 gap vs previous close", () => {
    expect(classifyGap(100, 101)).toBe("lower");
    expect(classifyGap(102, 101)).toBe("upper");
    expect(classifyGap(101, 101)).toBe("unchanged");
  });

  it("classifies the 09:15 candle color from open vs close", () => {
    expect(classifyCandleColor(100, 101)).toBe("green");
    expect(classifyCandleColor(100, 99)).toBe("red");
    expect(classifyCandleColor(100, 100)).toBe("doji");
  });

  it("classifies the day trend from 09:15 to session close", () => {
    expect(classifyDayTrend(99, 100)).toBe("downtrend");
    expect(classifyDayTrend(101, 100)).toBe("uptrend");
    expect(classifyDayTrend(100, 100)).toBe("flat");
  });

  it("records the first 15m bar that printed the session high and low", () => {
    expect(
      sessionHighLow([
        { timeIst: "09:15", high: 101, low: 99 },
        { timeIst: "11:00", high: 104, low: 100 },
        { timeIst: "14:30", high: 103, low: 97.5 },
        { timeIst: "15:15", high: 104, low: 98 },
      ]),
    ).toEqual({
      high: 104,
      highTimeIst: "11:00",
      low: 97.5,
      lowTimeIst: "14:30",
    });
  });

  it("flags gap-down + downtrend and gap-up + uptrend days", () => {
    const rows = buildPnbOpenGapRows([
      {
        dateKey: "2026-09-01",
        open0915: 110,
        close0915: 109,
        high0915: 110.5,
        low0915: 108.5,
        close: 108,
        high: 111,
        highTimeIst: "10:00",
        low: 107,
        lowTimeIst: "14:15",
      },
      {
        dateKey: "2026-09-02",
        open0915: 106,
        close0915: 105,
        high0915: 108.2,
        low0915: 105.4,
        close: 104,
        high: 106.5,
        highTimeIst: "09:15",
        low: 103,
        lowTimeIst: "13:00",
      },
      {
        dateKey: "2026-09-03",
        open0915: 107,
        close0915: 108.5,
        high0915: 108.8,
        low0915: 103.5,
        close: 110,
        high: 111,
        highTimeIst: "14:45",
        low: 106.8,
        lowTimeIst: "09:30",
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-09-02",
      previousDayClose: 108,
      nextDay0915Price: 106,
      openedVsPreviousClose: "lower",
      dayTrend: "downtrend",
      matchesGapDownAndDowntrend: true,
      matchesGapUpAndUptrend: false,
      nextDayHigh: 106.5,
      nextDayHighTimeIst: "09:15",
      nextDayLow: 103,
      nextDayLowTimeIst: "13:00",
      candle0915Color: "red",
      candle0915High: 108.2,
      candle0915Low: 105.4,
      candle0915HighCrossedPrevCloseUp: true,
      candle0915LowCrossedPrevCloseDown: true,
    });
    expect(rows[1]).toMatchObject({
      date: "2026-09-03",
      previousDayClose: 104,
      nextDay0915Price: 107,
      openedVsPreviousClose: "upper",
      dayTrend: "uptrend",
      matchesGapDownAndDowntrend: false,
      matchesGapUpAndUptrend: true,
      nextDayHigh: 111,
      nextDayHighTimeIst: "14:45",
      nextDayLow: 106.8,
      nextDayLowTimeIst: "09:30",
      candle0915Color: "green",
      candle0915High: 108.8,
      candle0915Low: 103.5,
      candle0915HighCrossedPrevCloseUp: true,
      candle0915LowCrossedPrevCloseDown: true,
    });
  });
});
