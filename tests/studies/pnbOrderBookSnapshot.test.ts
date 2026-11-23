import { describe, expect, it } from "vitest";
import type { KiteQuote } from "../../src/data/quoteFeed.js";
import type { DepthLevel } from "../../src/types.js";
import {
  ORDER_BOOK_DEPTH_LEVELS,
  buildOrderBookSnapshot,
  formatIndianQty,
  formatOrderBookMarkdown,
  pairDepthRows,
} from "../../src/studies/pnbOrderBookSnapshot.js";

function makeLevels(count: number, start: number, step: number): DepthLevel[] {
  return Array.from({ length: count }, (_, i) => ({
    price: Number((start + i * step).toFixed(2)),
    orders: i + 1,
    quantity: (i + 1) * 100,
  }));
}

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
    expect(snapshot.rows).toHaveLength(ORDER_BOOK_DEPTH_LEVELS);
    expect(snapshot.liveLevelCount).toBe(5);
    expect(snapshot.requestedLevels).toBe(20);
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

  it("keeps 20 live bid/offer levels and drops empty placeholders", () => {
    const quote: KiteQuote = {
      lastPrice: 150.95,
      buyQuantity: 2013775,
      sellQuantity: 2676374,
      bids: [
        ...makeLevels(20, 150.92, -0.01),
        { price: 0, orders: 0, quantity: 0 },
      ],
      asks: [
        ...makeLevels(25, 150.95, 0.01),
        { price: 0, orders: 0, quantity: 0 },
      ],
    };

    const snapshot = buildOrderBookSnapshot("NSE:PNB", quote);
    expect(snapshot.liveLevelCount).toBe(20);
    expect(snapshot.rows).toHaveLength(20);
    expect(snapshot.rows[0]?.bid?.price).toBe(150.92);
    expect(snapshot.rows[19]?.bid?.price).toBe(150.73);
    expect(snapshot.rows[19]?.offer?.price).toBe(151.14);
    expect(snapshot.bids).toHaveLength(20);
    expect(snapshot.offers).toHaveLength(20);
  });
});
