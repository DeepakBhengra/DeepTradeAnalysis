import { describe, expect, it } from "vitest";

import type { DayOrderFill } from "../types/dayOrder";
import {
  buildDayOrderHistoryCsv,
  buildDayOrderHistoryCsvFilename,
} from "./dayOrderHistoryCsv";

function makeFill(overrides: Partial<DayOrderFill> = {}): DayOrderFill {
  return {
    id: "fill-1",
    kind: "entry",
    signalKey: "deeppro1-RELIANCE-09:15-1",
    tradingSymbol: "RELIANCE",
    symbol: "Reliance Industries",
    strategy: "deeppro1",
    side: "BUY",
    quantity: 100,
    price: 1290.45,
    timeIst: "09:15",
    sessionIndex: 0,
    realizedPnL: null,
    ...overrides,
  };
}

describe("buildDayOrderHistoryCsv", () => {
  it("emits header-only CSV when there are no fills", () => {
    expect(buildDayOrderHistoryCsv([])).toBe(
      "Type,Side,Qty,Stock,Price,Strategy,Exit Type,Time (IST),P&L\r\n",
    );
  });

  it("maps fill columns and leaves entry exit type and P&L blank", () => {
    const csv = buildDayOrderHistoryCsv([makeFill()]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "entry,BUY,100,RELIANCE,1290.45,Deeppro1,,09:15,",
    );
  });

  it("includes exit type and P&L for exit fills", () => {
    const csv = buildDayOrderHistoryCsv([
      makeFill({
        id: "fill-2",
        kind: "exit",
        side: "SELL",
        price: 1295.1,
        timeIst: "11:45",
        realizedPnL: 465,
        exitReason: "target",
        targetHit: true,
      }),
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[1]).toBe(
      "exit,SELL,100,RELIANCE,1295.10,Deeppro1,Target,11:45,465.00",
    );
  });

  it("labels stop-loss % exits", () => {
    const csv = buildDayOrderHistoryCsv([
      makeFill({
        kind: "exit",
        side: "SELL",
        exitReason: "stop_loss",
        realizedPnL: -100,
        timeIst: "10:15",
      }),
    ]);
    expect(csv).toContain(",Stop-loss %,10:15,");
  });

  it("keeps chronological order (oldest first)", () => {
    const csv = buildDayOrderHistoryCsv([
      makeFill({ id: "a", timeIst: "09:15" }),
      makeFill({
        id: "b",
        timeIst: "11:45",
        kind: "exit",
        side: "SELL",
        realizedPnL: 10,
        exitReason: "eod",
      }),
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[1]).toContain(",09:15,");
    expect(lines[2]).toContain(",11:45,");
  });
});

describe("buildDayOrderHistoryCsvFilename", () => {
  it("includes the analysis date", () => {
    expect(buildDayOrderHistoryCsvFilename("2026-08-05")).toBe(
      "day-order-history-2026-08-05.csv",
    );
  });
});
