import { describe, expect, it } from "vitest";
import type { KiteQuote } from "../../src/data/quoteFeed.js";
import {
  buildOrderBookSnapshot,
  formatIndianQty,
  formatOrderBookMarkdown,
  pairDepthRows,
} from "../../src/studies/pnbOrderBookSnapshot.js";

const screenshotQuote: KiteQuote = {
  lastPrice: 121.4,
  buyQuantity: 693779,
  sellQuantity: 815523,
  bids: [
    { price: 121.35, orders: 9, quantity: 35006 },
    { price: 121.3, orders: 16, quantity: 82885 },
    { price: 121.25, orders: 16, quantity: 105007 },
    { price: 121.2, orders: 14, quantity: 50130 },
    { price: 121.15, orders: 18, quantity: 46000 },
  ],
  asks: [
    { price: 121.45, orders: 1, quantity: 80 },
    { price: 121.5, orders: 10, quantity: 36668 },
    { price: 121.55, orders: 14, quantity: 82922 },
    { price: 121.6, orders: 17, quantity: 270010 },
    { price: 121.65, orders: 21, quantity: 760444 },
  ],
};

describe("pnbOrderBookSnapshot", () => {
  it("pairs bid and offer rows with price, orders, and qty", () => {
    const snapshot = buildOrderBookSnapshot("BSE:PNB", screenshotQuote);
    expect(snapshot.rows).toHaveLength(5);
    expect(snapshot.rows[0]).toEqual({
      bid: { price: 121.35, orders: 9, quantity: 35006 },
      offer: { price: 121.45, orders: 1, quantity: 80 },
    });
    expect(snapshot.buyQuantity).toBe(693779);
    expect(snapshot.sellQuantity).toBe(815523);
    expect(snapshot.bidOrders).toBe(73);
    expect(snapshot.offerOrders).toBe(63);
  });

  it("formats Indian quantity and a buy/sell markdown table", () => {
    expect(formatIndianQty(693779)).toBe("6,93,779");
    expect(formatIndianQty(815523)).toBe("8,15,523");
    const markdown = formatOrderBookMarkdown(
      buildOrderBookSnapshot("BSE:PNB", screenshotQuote),
    );
    expect(markdown).toContain("121.35 | 9 | 35,006");
    expect(markdown).toContain("121.45 | 1 | 80");
    expect(markdown).toContain("**6,93,779**");
    expect(markdown).toContain("**8,15,523**");
  });

  it("keeps an unmatched extra bid or offer row", () => {
    expect(
      pairDepthRows(
        [{ price: 1, orders: 1, quantity: 10 }],
        [
          { price: 2, orders: 1, quantity: 5 },
          { price: 3, orders: 2, quantity: 7 },
        ],
      ),
    ).toEqual([
      {
        bid: { price: 1, orders: 1, quantity: 10 },
        offer: { price: 2, orders: 1, quantity: 5 },
      },
      {
        bid: null,
        offer: { price: 3, orders: 2, quantity: 7 },
      },
    ]);
  });
});
