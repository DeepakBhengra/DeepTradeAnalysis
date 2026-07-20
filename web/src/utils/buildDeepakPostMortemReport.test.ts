import { describe, expect, it } from "vitest";

import type { DashboardSeriesPoint, DeepakDecisionResult } from "../types/dashboard";
import {
  buildDeepakPostMortemReport,
  candleMid,
} from "./buildDeepakPostMortemReport";

/** Unix seconds for 2026-07-20 IST session bars (approx). */
function istBar(hour: number, minute: number): number {
  // 2026-07-20 00:00 UTC = previous evening IST; IST = UTC+5:30
  const utcHour = hour - 5;
  const utcMinute = minute - 30;
  let h = utcHour;
  let m = utcMinute;
  if (m < 0) {
    m += 60;
    h -= 1;
  }
  return Math.floor(Date.UTC(2026, 6, 20, h, m, 0) / 1000);
}

function point(
  hour: number,
  minute: number,
  high: number,
  low: number,
  close?: number,
): DashboardSeriesPoint {
  const mid = (high + low) / 2;
  const c = close ?? mid;
  return {
    time: istBar(hour, minute),
    open: mid,
    high,
    low,
    close: c,
    volume: 1000,
    relVolume: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    rsi: 50,
    macd: null,
    signal: null,
    histogram: null,
  };
}

describe("buildDeepakPostMortemReport", () => {
  it("grades RIGHT when target is hit", () => {
    const series = [
      point(10, 45, 1580, 1576), // entry mid 1578
      point(11, 0, 1585, 1580), // mid 1582.5 — hits +0.7 target
      point(15, 0, 1584, 1582),
    ];

    const decision: DeepakDecisionResult = {
      dateKey: "2026-07-20",
      decision: "BUY",
      activeScenario: "strong direction switch - up",
      scenarioTrail: [],
      reasons: [],
      signals: [
        {
          side: "BUY",
          scenarioKey: "Deepak strong direction switch - up",
          scenarioNumber: 1,
          timeIst: "10:45",
          price: candleMid(series[0]),
          bbMatchType: "close",
          profitTarget: 0.7,
          exit: {
            timeIst: "11:00",
            price: candleMid(series[1]),
            targetHit: true,
            profit: candleMid(series[1]) - candleMid(series[0]),
            profitTarget: 0.7,
          },
        },
      ],
    };

    const report = buildDeepakPostMortemReport(decision, series, "deepak");
    expect(report).not.toBeNull();
    expect(report!.signals[0].grade).toBe("RIGHT");
    expect(report!.rightCount).toBe(1);
  });

  it("grades WRONG when sell never follows through", () => {
    const series = [
      point(11, 15, 1574, 1570), // mid 1572
      point(11, 30, 1578, 1572),
      point(12, 0, 1590, 1580),
      point(15, 0, 1585, 1582),
    ];

    const decision: DeepakDecisionResult = {
      dateKey: "2026-07-20",
      decision: "SELL",
      activeScenario: null,
      scenarioTrail: [],
      reasons: [],
      signals: [
        {
          side: "SELL",
          scenarioKey: "Deepak continue downward direction - 4",
          scenarioNumber: 3,
          timeIst: "11:15",
          price: 1572.25,
          bbMatchType: "close",
          profitTarget: 0.7,
          exit: null,
        },
      ],
    };

    const report = buildDeepakPostMortemReport(decision, series, "deepak");
    expect(report!.signals[0].grade).toBe("WRONG");
    expect(report!.wrongCount).toBe(1);
    expect(report!.headline?.scenarioNumber).toBe(3);
  });

  it("grades MIXED when eventual win has large adverse excursion", () => {
    const series = [
      point(10, 45, 1579, 1577), // mid 1578
      point(11, 0, 1575, 1568), // dump MAE
      point(12, 0, 1590, 1580), // recover MFE
      point(15, 0, 1585, 1582),
    ];

    const decision: DeepakDecisionResult = {
      dateKey: "2026-07-20",
      decision: "BUY",
      activeScenario: null,
      scenarioTrail: [],
      reasons: [],
      signals: [
        {
          side: "BUY",
          scenarioKey: "Deepak strong direction switch - up",
          scenarioNumber: 1,
          timeIst: "10:45",
          price: 1578.1,
          bbMatchType: "close",
          profitTarget: 0.7,
          exit: null,
        },
      ],
    };

    const report = buildDeepakPostMortemReport(decision, series, "deepak");
    expect(report!.signals[0].grade).toBe("MIXED");
    expect(report!.mixedCount).toBe(1);
  });

  it("emits P0 race tip when wrong continue-4 follows strong switch", () => {
    const series = [
      point(10, 45, 1579, 1577, 1578),
      point(11, 15, 1574.2, 1570.3, 1573.5), // green recovery sell entry
      point(12, 0, 1590, 1580),
      point(15, 0, 1585, 1582),
    ];

    const decision: DeepakDecisionResult = {
      dateKey: "2026-07-20",
      decision: "BUY",
      activeScenario: null,
      scenarioTrail: [],
      reasons: [],
      signals: [
        {
          side: "BUY",
          scenarioKey: "Deepak strong direction switch - up",
          scenarioNumber: 1,
          timeIst: "10:45",
          price: 1578.1,
          bbMatchType: "close",
          profitTarget: 0.7,
          exit: null,
        },
        {
          side: "SELL",
          scenarioKey: "Deepak continue downward direction - 4",
          scenarioNumber: 3,
          timeIst: "11:15",
          price: 1572.25,
          bbMatchType: "close",
          profitTarget: 0.7,
          exit: null,
        },
      ],
    };

    const report = buildDeepakPostMortemReport(decision, series, "deepak");
    expect(report!.tips.some((t) => t.priority === "P0" && /Race post-switch/i.test(t.title))).toBe(
      true,
    );
    expect(
      report!.tips.some((t) => t.priority === "P1" && /recovery filter/i.test(t.title)),
    ).toBe(true);
  });

  it("grades RIGHT on meaningful follow-through even when adaptive target is huge", () => {
    // Mirrors POLICYBZR #6: MFE +5.6, slight EOD fade, adaptive target ~51 pts
    const series = [
      point(12, 30, 1588, 1582.2), // mid 1585.1
      point(13, 0, 1591.8, 1585), // mid 1588.4
      point(13, 15, 1593.2, 1588.1), // mid 1590.65 — MFE ~+5.6
      point(14, 0, 1584, 1580), // adverse
      point(15, 0, 1585, 1582.8), // close-ish mid ~1583.9 → slight EOD fade
    ];

    const decision: DeepakDecisionResult = {
      dateKey: "2026-07-20",
      decision: "BUY",
      activeScenario: null,
      scenarioTrail: [],
      reasons: [],
      signals: [
        {
          side: "BUY",
          scenarioKey: "Deepak deferred upper resolve - 3",
          scenarioNumber: 6,
          timeIst: "12:30",
          price: 1585.1,
          bbMatchType: "crossed",
          profitTarget: 50.97,
          exit: null,
        },
      ],
    };

    const report = buildDeepakPostMortemReport(decision, series, "deepak");
    expect(report!.signals[0].grade).toBe("RIGHT");
    expect(report!.signals[0].mfe).toBeGreaterThan(5);
  });

  it("builds a net read when wrong continue-4 follows strong switch", () => {
    const series = [
      point(10, 45, 1579, 1577, 1578),
      point(11, 15, 1574.2, 1570.3, 1573.5),
      point(12, 0, 1590, 1580),
      point(12, 30, 1588, 1582),
      point(13, 15, 1593, 1588),
      point(15, 0, 1585, 1582),
    ];

    const decision: DeepakDecisionResult = {
      dateKey: "2026-07-20",
      decision: "BUY",
      activeScenario: null,
      scenarioTrail: [],
      reasons: [],
      signals: [
        {
          side: "BUY",
          scenarioKey: "Deepak strong direction switch - up",
          scenarioNumber: 1,
          timeIst: "10:45",
          price: 1578.1,
          bbMatchType: "close",
          profitTarget: 0.7,
          exit: null,
        },
        {
          side: "SELL",
          scenarioKey: "Deepak continue downward direction - 4",
          scenarioNumber: 3,
          timeIst: "11:15",
          price: 1572.25,
          bbMatchType: "close",
          profitTarget: 0.7,
          exit: null,
        },
        {
          side: "BUY",
          scenarioKey: "Deepak deferred upper resolve - 3",
          scenarioNumber: 6,
          timeIst: "12:30",
          price: 1585.1,
          bbMatchType: "crossed",
          profitTarget: 50.97,
          exit: null,
        },
      ],
    };

    const report = buildDeepakPostMortemReport(decision, series, "deepak");
    expect(report!.netRead).toMatch(/correctly detected the morning lower-band regime/i);
    expect(report!.netRead).toMatch(/afternoon upper-band trend \(BUY #6\)/i);
    expect(report!.netRead).toMatch(/continue-down-4/i);
    expect(report!.netRead).toMatch(/strong-switch BUY/i);
  });

  it("returns null when decision is missing", () => {
    expect(buildDeepakPostMortemReport(null, [], "deepak")).toBeNull();
  });
});
