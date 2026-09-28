import { describe, expect, it } from "vitest";
import {
  buildDayFollowRows,
  buildSymbolMorningDays,
  classifyMorningTrend,
  countFollowAppearances,
  countFollowWins,
  filterRowsFollowingPeer,
  pickBestFollow,
  scoreFollow,
  barAtTime,
  type SymbolMorningDay,
  type TimedOhlcBar,
} from "../../src/studies/pnbBankMorningFollow.js";

function bar(
  dateKey: string,
  timeIst: string,
  open: number,
  high: number,
  low: number,
  close: number,
): TimedOhlcBar {
  return { dateKey, timeIst, open, high, low, close };
}

function morningDay(
  stock: string,
  gap: SymbolMorningDay["openedVsPreviousClose"],
  colors: Array<"green" | "red">,
  trend: SymbolMorningDay["morningTrend"],
): SymbolMorningDay {
  const times = ["09:15", "09:30", "09:45", "10:00", "10:15", "10:30"] as const;
  const open = 100;
  return {
    date: "2026-09-24",
    stock,
    previousDayClose: gap === "lower" ? 101 : gap === "upper" ? 99 : 100,
    openedVsPreviousClose: gap,
    morningTrend: trend,
    bars: times.map((time, index) => {
      const color = colors[index] ?? "green";
      const close = color === "green" ? open + 1 : open - 1;
      return {
        timeIst: time,
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
        color,
      };
    }),
  };
}

describe("pnbBankMorningFollow", () => {
  it("classifies the 09:15-to-10:30 morning trend", () => {
    expect(classifyMorningTrend(100, 101)).toBe("up");
    expect(classifyMorningTrend(100, 99)).toBe("down");
    expect(classifyMorningTrend(100, 100)).toBe("flat");
  });

  it("builds 09:15-10:30 bars and the gap versus previous close", () => {
    const days = buildSymbolMorningDays(
      [
        bar("2026-09-23", "15:15", 118, 118.2, 117.9, 118.3),
        bar("2026-09-24", "09:15", 117.25, 118.67, 117.25, 117.85),
        bar("2026-09-24", "09:30", 117.8, 118.1, 117.4, 117.5),
        bar("2026-09-24", "09:45", 117.5, 117.9, 117.3, 117.7),
        bar("2026-09-24", "10:00", 117.7, 118, 117.5, 117.6),
        bar("2026-09-24", "10:15", 117.6, 117.8, 117.2, 117.3),
        bar("2026-09-24", "10:30", 117.3, 117.5, 117.0, 117.1),
      ],
      "PNB",
    );

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "2026-09-24",
      stock: "PNB",
      previousDayClose: 118.3,
      openedVsPreviousClose: "lower",
      morningTrend: "down",
    });
    expect(days[0].bars.map((row) => [row.timeIst, row.color, row.close])).toEqual([
      ["09:15", "green", 117.85],
      ["09:30", "red", 117.5],
      ["09:45", "green", 117.7],
      ["10:00", "red", 117.6],
      ["10:15", "red", 117.3],
      ["10:30", "red", 117.1],
    ]);
  });

  it("scores the peer that matches PNB gap, colors, and morning trend highest", () => {
    const pnb = morningDay("PNB", "lower", ["green", "red", "green", "red", "red", "red"], "down");
    const hdfc = morningDay("HDFCBANK", "lower", ["green", "red", "green", "red", "red", "red"], "down");
    const icici = morningDay("ICICIBANK", "upper", ["red", "green", "red", "green", "green", "green"], "up");

    const hdfcScore = scoreFollow(pnb, hdfc);
    const iciciScore = scoreFollow(pnb, icici);
    expect(hdfcScore.score).toBeGreaterThan(iciciScore.score);
    expect(hdfcScore.gapMatch).toBe(true);
    expect(hdfcScore.colorMatches).toBe(6);
    expect(hdfcScore.morningTrendMatch).toBe(true);
    expect(pickBestFollow([hdfcScore, iciciScore]).map((row) => row.peer)).toEqual([
      "HDFCBANK",
    ]);
  });

  it("picks the stock PNB followed through 10:30 on each date", () => {
    const pnb = buildSymbolMorningDays(
      [
        bar("2026-09-23", "15:15", 100, 100, 100, 100),
        bar("2026-09-24", "09:15", 99, 101, 99, 100.5),
        bar("2026-09-24", "09:30", 100.5, 101, 100, 100.2),
        bar("2026-09-24", "09:45", 100.2, 100.8, 100, 100.6),
        bar("2026-09-24", "10:00", 100.6, 100.9, 100.3, 100.4),
        bar("2026-09-24", "10:15", 100.4, 100.7, 100.1, 100.2),
        bar("2026-09-24", "10:30", 100.2, 100.5, 99.8, 100.0),
      ],
      "PNB",
    );
    const hdfc = buildSymbolMorningDays(
      [
        bar("2026-09-23", "15:15", 1600, 1600, 1600, 1600),
        bar("2026-09-24", "09:15", 1590, 1610, 1590, 1605),
        bar("2026-09-24", "09:30", 1605, 1608, 1600, 1602),
        bar("2026-09-24", "09:45", 1602, 1607, 1600, 1606),
        bar("2026-09-24", "10:00", 1606, 1609, 1603, 1604),
        bar("2026-09-24", "10:15", 1604, 1607, 1601, 1602),
        bar("2026-09-24", "10:30", 1602, 1605, 1598, 1600),
      ],
      "HDFCBANK",
    );
    const kotak = buildSymbolMorningDays(
      [
        bar("2026-09-23", "15:15", 1700, 1700, 1700, 1690),
        bar("2026-09-24", "09:15", 1710, 1720, 1708, 1705),
        bar("2026-09-24", "09:30", 1705, 1715, 1704, 1712),
        bar("2026-09-24", "09:45", 1712, 1718, 1710, 1716),
        bar("2026-09-24", "10:00", 1716, 1722, 1715, 1720),
        bar("2026-09-24", "10:15", 1720, 1725, 1718, 1723),
        bar("2026-09-24", "10:30", 1723, 1730, 1722, 1728),
      ],
      "KOTAKBANK",
    );

    const rows = buildDayFollowRows({
      PNB: pnb,
      HDFCBANK: hdfc,
      KOTAKBANK: kotak,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].followed).toEqual(["HDFCBANK"]);
    expect(countFollowWins(rows).HDFCBANK).toBe(1);
    expect(countFollowAppearances(rows).HDFCBANK).toBe(1);
  });

  it("keeps only days where PNB followed NIFTY BANK", () => {
    const pnb = morningDay("PNB", "lower", ["green", "red", "green", "red", "red", "red"], "down");
    const nifty = morningDay("NIFTY BANK", "lower", ["green", "red", "green", "red", "red", "red"], "down");
    const hdfc = morningDay("HDFCBANK", "upper", ["red", "green", "red", "green", "green", "green"], "up");
    const laterPnb = { ...pnb, date: "2026-09-25" };
    const laterHdfc = { ...hdfc, date: "2026-09-25" };
    const rows = [
      {
        date: "2026-09-24",
        pnb,
        peers: [nifty, hdfc],
        scores: [scoreFollow(pnb, nifty), scoreFollow(pnb, hdfc)],
        followed: ["NIFTY BANK"],
      },
      {
        date: "2026-09-25",
        pnb: laterPnb,
        peers: [laterHdfc],
        scores: [scoreFollow(laterPnb, laterHdfc)],
        followed: ["HDFCBANK"],
      },
    ];
    const filtered = filterRowsFollowingPeer(rows, "NIFTY BANK");
    expect(filtered.map((row) => row.date)).toEqual(["2026-09-24"]);
    expect(barAtTime(filtered[0].pnb, "10:30")?.close).toBe(99);
  });
});
