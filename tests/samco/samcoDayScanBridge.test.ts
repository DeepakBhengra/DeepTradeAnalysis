import { describe, expect, it } from "vitest";

import {
  dayScanVariantToSamcoStrategy,
  ingestDayScanTrades,
  latestClosedSessionCandleIst,
  loadSamcoDayScanSignalSnapshot,
} from "../../src/samco/samcoDayScanBridge.js";
import { buildSamcoOrdersFromLedger } from "../../src/samco/samcoOrders.js";
import type { PositionLedger } from "../../src/samco/positionLedger.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

describe("latestClosedSessionCandleIst", () => {
  it("returns null before the first candle can close", () => {
    expect(latestClosedSessionCandleIst(new Date("2026-06-29T09:20:00+05:30"))).toBeNull();
  });

  it("returns 09:15 after 09:30", () => {
    expect(latestClosedSessionCandleIst(new Date("2026-06-29T09:30:01+05:30"))).toBe(
      "09:15",
    );
  });

  it("returns 10:00 at 10:22", () => {
    expect(latestClosedSessionCandleIst(new Date("2026-06-29T10:22:00+05:30"))).toBe(
      "10:00",
    );
  });
});

describe("buildSamcoOrdersFromLedger", () => {
  it("buckets open, executed, and rejected orders", () => {
    const ledger: PositionLedger = {
      version: 1,
      updatedAt: "2026-06-29T10:00:00.000Z",
      entries: [
        {
          signalKey: "deeppro1-TCS-10:15-1",
          strategy: "deeppro1",
          tradingSymbol: "TCS",
          stockName: "Tata Consultancy",
          exchange: "NSE",
          side: "BUY",
          quantity: 10,
          entryPrice: 3500,
          limitPrice: 3500,
          entryTimeIst: "10:15",
          orderNumber: null,
          status: "open",
        },
        {
          signalKey: "deepak-RELIANCE-09:30-1",
          strategy: "deepak",
          tradingSymbol: "RELIANCE",
          stockName: "Reliance",
          exchange: "NSE",
          side: "SELL",
          quantity: 5,
          entryPrice: 1400,
          limitPrice: 1400,
          entryTimeIst: "09:30",
          orderNumber: null,
          status: "closed",
          exitTimeIst: "10:00",
          exitPrice: 1390,
          exitLimitPrice: 1390,
          exitSide: "BUY",
          closedAt: "2026-06-29T04:30:00.000Z",
        },
        {
          signalKey: "deepak-INFY-10:15-1",
          strategy: "deepak",
          tradingSymbol: "INFY",
          stockName: "Infosys",
          exchange: "NSE",
          side: "BUY",
          quantity: 10,
          entryPrice: 5000,
          limitPrice: 5000,
          entryTimeIst: "10:15",
          orderNumber: null,
          status: "failed",
          rejectedReason: "outside price range",
        },
      ],
    };

    const buckets = buildSamcoOrdersFromLedger(ledger);
    expect(buckets.open).toHaveLength(1);
    expect(buckets.open[0]?.stockName).toBe("Tata Consultancy");
    expect(buckets.open[0]?.limitPrice).toBe(3500);
    expect(buckets.executed).toHaveLength(2);
    expect(buckets.executed.map((row) => row.kind).sort()).toEqual(["entry", "exit"]);
    expect(buckets.rejected).toHaveLength(1);
    expect(buckets.rejected[0]?.reason).toMatch(/price range/);
  });
});

describe("ingestDayScanTrades", () => {
  let tempDir = "";
  let originalCwd = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "samco-dayscan-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("maps Day Scan variants and persists snapshot", () => {
    expect(dayScanVariantToSamcoStrategy("deeppro1")).toBe("deeppro1");
    const snapshot = ingestDayScanTrades({
      date: "2026-06-29",
      variant: "deeppro1",
      trades: [
        {
          tradingSymbol: "TCS",
          symbol: "Tata Consultancy",
          sector: "IT",
          side: "BUY",
          scenarioNumber: 1,
          scenarioKey: "deeppro1 buy",
          entryTimeIst: "10:15",
          entryPrice: 3500,
          exitTimeIst: null,
          exitPrice: null,
          targetHit: false,
        },
      ],
    });
    expect(snapshot.strategy).toBe("deeppro1");
    expect(loadSamcoDayScanSignalSnapshot()?.trades).toHaveLength(1);
  });

  it("summarizes historical Day Scan feeds (not only today)", async () => {
    ingestDayScanTrades({
      date: "2026-08-04",
      variant: "deeppro1",
      trades: [
        {
          tradingSymbol: "TCS",
          side: "BUY",
          entryTimeIst: "10:15",
          entryPrice: 3500,
        },
      ],
    });
    const { getDayScanSignalSourceSummary } = await import(
      "../../src/samco/samcoDayScanBridge.js"
    );
    const summary = getDayScanSignalSourceSummary(
      new Date("2026-08-11T22:00:00+05:30"),
    );
    expect(summary.date).toBe("2026-08-04");
    expect(summary.tradeCount).toBe(1);
    expect(summary.isToday).toBe(false);
  });

  it("rejects unsupported Day Scan variants", () => {
    expect(() =>
      ingestDayScanTrades({ date: "2026-06-29", variant: "rulePnb", trades: [] }),
    ).toThrow(/not supported by Samco/);
  });
});
