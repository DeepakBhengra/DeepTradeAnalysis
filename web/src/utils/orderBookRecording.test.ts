import { describe, expect, it } from "vitest";

import type { OrderBookRecordingSample, OrderBookSnapshot } from "../types/orderBook";
import {
  buildOrderBookRecordingFilename,
  buildOrderBookRecordingSample,
  buildOrderBookRecordingWorkbookXml,
  formatOrderBookRecordedAtIst,
} from "./orderBookRecording";

const snapshot: OrderBookSnapshot = {
  symbol: "NSE:PNB",
  lastPrice: 150.36,
  buyQuantity: 1846708,
  sellQuantity: 2848826,
  bidOrders: 66,
  offerOrders: 38,
  bids: [
    { price: 150.32, orders: 3, quantity: 364 },
    { price: 150.31, orders: 2, quantity: 5498 },
  ],
  offers: [
    { price: 150.37, orders: 3, quantity: 1367 },
    { price: 150.38, orders: 8, quantity: 4120 },
  ],
  rows: [],
};

describe("orderBookRecording", () => {
  it("formats recorded-at as IST YYYY-MM-DD HH:mm:ss", () => {
    expect(formatOrderBookRecordedAtIst(new Date("2026-11-23T07:46:00.000Z"))).toBe(
      "2026-11-23 13:16:00",
    );
  });

  it("builds an Excel workbook with 5-level bid/offer columns", () => {
    const sample: OrderBookRecordingSample = buildOrderBookRecordingSample(
      snapshot,
      "5m",
      new Date("2026-11-23T07:46:00.000Z"),
    );
    const xml = buildOrderBookRecordingWorkbookXml([sample]);

    expect(xml).toContain("Excel.Sheet");
    expect(xml).toContain("Bid1 Price");
    expect(xml).toContain("Offer5 Qty");
    expect(xml).toContain("NSE:PNB");
    expect(xml).toContain("150.32");
    expect(xml).toContain("1846708");
    expect(xml).toContain("5m");
    expect(buildOrderBookRecordingFilename([sample], new Date("2026-11-23T07:46:00.000Z"))).toBe(
      "order-book_NSE-PNB_5m_2026-11-23.xls",
    );
  });
});
