import { describe, expect, it } from "vitest";

import type { DayScanSimulationPayload } from "../../src/types.js";
import {
  applyStopLossExitsToTrades,
  applyStopLossToDayScanSimulationPayload,
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

  it("adds stop-loss exits to a Day Scan Simulator frame via marks", () => {
    const payload: DayScanSimulationPayload = {
      date: "2026-06-09",
      simulation: {
        sessionIndex: 2,
        sessionCandleCount: 10,
        simulatedTimeIst: "10:15",
      },
      entries: [
        {
          date: "2026-06-09",
          strategy: "deeppro1",
          side: "BUY",
          scenarioNumber: 1,
          scenarioKey: "buy-1",
          tradingSymbol: "PNB",
          symbol: "Punjab National Bank",
          sector: "Bank",
          entryTimeIst: "10:00",
          entryPrice: 100,
          exitTimeIst: null,
          exitPrice: null,
          targetHit: false,
          profit: null,
          profitTarget: 0.45,
          bbMatchType: "crossed",
          exitReason: null,
          stopLossHit: false,
        },
      ],
      exits: [],
      marks: [{ tradingSymbol: "PNB", price: 99.8, timeIst: "10:15" }],
      errors: [],
      summary: {
        stocksScanned: 1,
        stocksWithSignals: 1,
        entryCount: 1,
        exitCount: 0,
        openPositions: 1,
        buyCount: 1,
        sellCount: 0,
        targetsHit: 0,
        stopsHit: 0,
        avgProfit: null,
        errorCount: 0,
      },
    };

    const next = applyStopLossToDayScanSimulationPayload(payload, 0.15);
    expect(next.exits).toHaveLength(1);
    expect(next.exits[0].exitReason).toBe("stop_loss");
    expect(next.exits[0].stopLossHit).toBe(true);
    expect(next.exits[0].exitPrice).toBe(99.8);
    expect(next.summary.stopsHit).toBe(1);
    expect(next.summary.openPositions).toBe(0);
    // Cached payload must not be mutated.
    expect(payload.exits).toHaveLength(0);
  });
});
