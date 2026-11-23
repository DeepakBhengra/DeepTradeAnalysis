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

  it("keeps only 5 live bid/offer levels and drops empty placeholders", () => {
    const quote: KiteQuote = {
      lastPrice: 150.43,
      buyQuantity: 2013775,
      sellQuantity: 2676374,
      bids: [
        { price: 150.43, orders: 4, quantity: 1400 },
        { price: 150.42, orders: 2, quantity: 641 },
        { price: 150.41, orders: 6, quantity: 954 },
        { price: 150.4, orders: 37, quantity: 12635 },
        { price: 150.39, orders: 8, quantity: 2351 },
        { price: 150.38, orders: 8, quantity: 1985 },
        { price: 0, orders: 0, quantity: 0 },
      ],
      asks: [
        { price: 150.44, orders: 1, quantity: 393 },
        { price: 150.48, orders: 4, quantity: 843 },
        { price: 150.49, orders: 4, quantity: 1417 },
        { price: 150.5, orders: 8, quantity: 2279 },
        { price: 150.51, orders: 8, quantity: 2307 },
        { price: 150.52, orders: 9, quantity: 7987 },
        { price: 0, orders: 0, quantity: 0 },
      ],
    };

    const snapshot = buildOrderBookSnapshot("NSE:PNB", quote);
    expect(snapshot.rows).toHaveLength(5);
    expect(snapshot.bids).toHaveLength(5);
    expect(snapshot.offers).toHaveLength(5);
    expect(snapshot.rows[0]?.bid?.price).toBe(150.43);
    expect(snapshot.rows[4]?.bid?.price).toBe(150.39);
    expect(snapshot.rows[4]?.offer?.price).toBe(150.51);
  });
});
