import { describe, expect, it } from "vitest";

import type { OrderBookRecordingSample, OrderBookSnapshot } from "../types/orderBook";
import {
  buildOrderBookRecordingFilename,
  buildOrderBookRecordingSample,
  buildOrderBookRecordingWorkbookXml,
  formatOrderBookRecordedAtIst,
  orderBookChangeFingerprint,
} from "./orderBookRecording";

const snapshot: OrderBookSnapshot = {
  symbol: "NSE:PNB",
  lastPrice: 150.43,
  buyQuantity: 1773231,
  sellQuantity: 2920024,
  bidOrders: 35,
  offerOrders: 9,
  bids: [
    { price: 150.43, orders: 7, quantity: 2057 },
    { price: 150.42, orders: 1, quantity: 195 },
    { price: 150.41, orders: 7, quantity: 3162 },
    { price: 150.40, orders: 11, quantity: 9805 },
    { price: 150.39, orders: 9, quantity: 12231 },
  ],
  offers: [
    { price: 150.45, orders: 1, quantity: 422 },
    { price: 150.46, orders: 1, quantity: 19 },
    { price: 150.47, orders: 2, quantity: 573 },
    { price: 150.48, orders: 1, quantity: 404 },
    { price: 150.49, orders: 4, quantity: 850 },
  ],
  rows: [],
};

describe("orderBookRecording", () => {
  it("formats recorded-at as IST YYYY-MM-DD HH:mm:ss", () => {
    expect(formatOrderBookRecordedAtIst(new Date("2026-11-23T07:46:00.000Z"))).toBe(
      "2026-11-23 13:16:00",
    );
  });

  it("fingerprints bid/offer/totals and stock price changes", () => {
    const same = orderBookChangeFingerprint(snapshot);
    expect(orderBookChangeFingerprint({ ...snapshot, rows: [] })).toBe(same);
    expect(
      orderBookChangeFingerprint({ ...snapshot, lastPrice: 150.44 }),
    ).not.toBe(same);
    expect(
      orderBookChangeFingerprint({
        ...snapshot,
        bids: snapshot.bids.map((row, index) =>
          index === 0 ? { ...row, quantity: 2100 } : row,
        ),
      }),
    ).not.toBe(same);
    expect(
      orderBookChangeFingerprint({ ...snapshot, buyQuantity: 1_800_000 }),
    ).not.toBe(same);
  });

  it("builds an Excel workbook with Kite bid/offer columns, totals, and stock price", () => {
    const first: OrderBookRecordingSample = buildOrderBookRecordingSample(
      snapshot,
      "5m",
      new Date("2026-11-23T07:46:00.000Z"),
    );
    const second: OrderBookRecordingSample = buildOrderBookRecordingSample(
      { ...snapshot, lastPrice: 150.44, buyQuantity: 1_773_500 },
      "5m",
      new Date("2026-11-23T07:46:01.000Z"),
    );
    const xml = buildOrderBookRecordingWorkbookXml([first, second]);

    expect(xml).toContain("Excel.Sheet");
    expect(xml).toContain("ss:Name=\"Changes\"");
    expect(xml).toContain("ss:Name=\"Kite view\"");
    expect(xml).toContain("Stock price");
    expect(xml).toContain("BID 1");
    expect(xml).toContain("OFFER 5 Qty");
    expect(xml).toContain("Total Bid Qty");
    expect(xml).toContain("NSE:PNB");
    expect(xml).toContain("150.43");
    expect(xml).toContain("150.44");
    expect(xml).toContain("1773231");
    expect(xml).toContain("1773500");
    expect(xml).toContain(">BID</Data>");
    expect(xml).toContain(">OFFER</Data>");
    expect(xml).toContain("5m");
    expect(buildOrderBookRecordingFilename([first], new Date("2026-11-23T07:46:00.000Z"))).toBe(
      "order-book_NSE-PNB_5m_2026-11-23.xls",
    );
  });
});
