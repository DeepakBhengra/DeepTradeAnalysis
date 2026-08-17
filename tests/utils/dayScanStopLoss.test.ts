import { describe, expect, it } from "vitest";

import {
  applyStopLossExitsToTrades,
  sessionMarkBarsFromSnapshots,
} from "../../src/utils/dayScanStopLoss.js";

describe("dayScanStopLoss", () => {
  const bars = [
    { timeIst: "10:00", price: 100 },
    { timeIst: "10:15", price: 99 },
    { timeIst: "10:30", price: 98.5 },
    { timeIst: "11:00", price: 102 },
  ];

  it("closes open BUY when adverse move hits stop-loss %", () => {
    const [trade] = applyStopLossExitsToTrades(
      [
        {
          side: "BUY" as const,
          entryTimeIst: "10:00",
          entryPrice: 100,
          exitTimeIst: null,
          exitPrice: null,
          targetHit: false,
          profit: null,
          exitReason: null,
        },
      ],
      bars,
      1,
    );
    expect(trade.stopLossHit).toBe(true);
    expect(trade.exitReason).toBe("stop_loss");
    expect(trade.exitTimeIst).toBe("10:15");
    expect(trade.exitPrice).toBe(99);
    expect(trade.profit).toBe(-1);
  });

  it("does not override an earlier strategy exit", () => {
    const [trade] = applyStopLossExitsToTrades(
      [
        {
          side: "BUY" as const,
          entryTimeIst: "10:00",
          entryPrice: 100,
          exitTimeIst: "10:15",
          exitPrice: 101,
          targetHit: true,
          profit: 1,
          exitReason: "target" as const,
        },
      ],
      bars,
      1,
    );
    expect(trade.stopLossHit).toBeUndefined();
    expect(trade.exitReason).toBe("target");
    expect(trade.exitTimeIst).toBe("10:15");
  });

  it("no-ops when stop-loss pct is disabled", () => {
    const input = [
      {
        side: "BUY" as const,
        entryTimeIst: "10:00",
        entryPrice: 100,
        exitTimeIst: null,
        exitPrice: null,
        targetHit: false,
        profit: null,
        exitReason: null,
      },
    ];
    expect(applyStopLossExitsToTrades(input, bars, null)).toBe(input);
  });

  it("builds session mark bars from snapshots", () => {
    const snapshots = [
      {
        timestamp: new Date("2026-06-09T04:45:00.000Z"), // 10:15 IST
        high: 101,
        low: 99,
      },
    ];
    const sessionBars = sessionMarkBarsFromSnapshots(snapshots, "2026-06-09");
    expect(sessionBars).toEqual([{ timeIst: "10:15", price: 100 }]);
  });
});
