import { describe, expect, it } from "vitest";
import {
  buildPnbOpenGapRows,
  classifyDayTrend,
  classifyGap,
} from "../../src/studies/pnbOpenGapTrend.js";

describe("pnbOpenGapTrend", () => {
  it("classifies a 09:15 gap vs previous close", () => {
    expect(classifyGap(100, 101)).toBe("lower");
    expect(classifyGap(102, 101)).toBe("upper");
    expect(classifyGap(101, 101)).toBe("unchanged");
  });

  it("classifies the day trend from 09:15 to session close", () => {
    expect(classifyDayTrend(99, 100)).toBe("downtrend");
    expect(classifyDayTrend(101, 100)).toBe("uptrend");
    expect(classifyDayTrend(100, 100)).toBe("flat");
  });

  it("flags gap-down + downtrend and gap-up + uptrend days", () => {
    const rows = buildPnbOpenGapRows([
      { dateKey: "2026-09-01", open0915: 110, close: 108 },
      { dateKey: "2026-09-02", open0915: 106, close: 104 },
      { dateKey: "2026-09-03", open0915: 107, close: 110 },
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
    });
    expect(rows[1]).toMatchObject({
      date: "2026-09-03",
      previousDayClose: 104,
      nextDay0915Price: 107,
      openedVsPreviousClose: "upper",
      dayTrend: "uptrend",
      matchesGapDownAndDowntrend: false,
      matchesGapUpAndUptrend: true,
    });
  });
});
