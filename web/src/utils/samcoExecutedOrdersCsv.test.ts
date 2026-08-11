import { describe, expect, it } from "vitest";
import type { SamcoOrderView } from "../api/samco";
import { buildSamcoExecutedOrdersCsv } from "./samcoExecutedOrdersCsv";

function makeOrder(overrides: Partial<SamcoOrderView> = {}): SamcoOrderView {
  return {
    id: "deeppro1-ADANIPORTS-09:15-1:entry",
    bucket: "executed",
    kind: "entry",
    stockName: "ADANIPORTS",
    tradingSymbol: "NSE:ADANIPORTS",
    timing: "09:15",
    side: "BUY",
    limitPrice: 1510.45,
    quantity: 10,
    orderNumber: null,
    status: "closed",
    strategy: "deeppro1",
    signalKey: "deeppro1-ADANIPORTS-09:15-1",
    ...overrides,
  };
}

describe("buildSamcoExecutedOrdersCsv", () => {
  it("emits header-only CSV when there are no orders", () => {
    const csv = buildSamcoExecutedOrdersCsv([]);
    expect(csv).toBe(
      "Stock,Trading symbol,Timing,Buy/Sell,Kind,Limit price,Qty,Strategy,Status,Detail,Order number,Signal key\r\n\r\n",
    );
  });

  it("exports executed order rows matching the table", () => {
    const csv = buildSamcoExecutedOrdersCsv([
      makeOrder(),
      makeOrder({
        id: "deeppro1-BAJFINANCE-09:15-1:exit",
        kind: "exit",
        stockName: "BAJFINANCE",
        tradingSymbol: "NSE:BAJFINANCE",
        side: "SELL",
        limitPrice: 5723,
        reason: "target",
        orderNumber: "240522000162545",
      }),
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      "ADANIPORTS,NSE:ADANIPORTS,09:15,BUY,entry,1510.45,10,deeppro1,closed,,,deeppro1-ADANIPORTS-09:15-1",
    );
    expect(lines[2]).toContain("BAJFINANCE");
    expect(lines[2]).toContain("target");
    expect(lines[2]).toContain("240522000162545");
  });
});
