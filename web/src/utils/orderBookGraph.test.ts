import { describe, expect, it } from "vitest";

import type { OrderBookRecordingSample, OrderBookSnapshot } from "../types/orderBook";
import { buildOrderBookRecordingSample } from "./orderBookRecording";
import {
  buildOrderBookGraphPoints,
  maxQuantityBid,
  maxQuantityOffer,
} from "./orderBookGraph";

const kiteViewSnapshot: OrderBookSnapshot = {
  symbol: "NSE:PNB",
  lastPrice: 150.53,
  buyQuantity: 1_871_083,
  sellQuantity: 2_946_003,
  bidOrders: 12,
  offerOrders: 29,
  bids: [
    { price: 150.53, orders: 1, quantity: 63 },
    { price: 150.52, orders: 4, quantity: 3686 },
    { price: 150.51, orders: 1, quantity: 57 },
    { price: 150.5, orders: 4, quantity: 693 },
    { price: 150.49, orders: 2, quantity: 265 },
  ],
  offers: [
    { price: 150.55, orders: 4, quantity: 1692 },
    { price: 150.56, orders: 3, quantity: 563 },
    { price: 150.57, orders: 4, quantity: 3942 },
    { price: 150.58, orders: 9, quantity: 2136 },
    { price: 150.59, orders: 9, quantity: 6758 },
  ],
  rows: [],
};

describe("orderBookGraph", () => {
  it("picks the 5-level bid and offer with the largest quantity", () => {
    expect(maxQuantityBid(kiteViewSnapshot)).toEqual({
      price: 150.52,
      orders: 4,
      quantity: 3686,
    });
    expect(maxQuantityOffer(kiteViewSnapshot)).toEqual({
      price: 150.59,
      orders: 9,
      quantity: 6758,
    });
  });

  it("keeps the nearer price when two levels share the max quantity", () => {
    const snapshot: OrderBookSnapshot = {
      ...kiteViewSnapshot,
      bids: [
        { price: 150.53, orders: 1, quantity: 1000 },
        { price: 150.52, orders: 1, quantity: 1000 },
      ],
    };
    expect(maxQuantityBid(snapshot)?.price).toBe(150.53);
  });

  it("builds time-ordered graph points with stock price and max-qty levels", () => {
    const first: OrderBookRecordingSample = buildOrderBookRecordingSample(
      kiteViewSnapshot,
      "5m",
      new Date("2026-11-23T08:40:00.000Z"),
    );
    const second: OrderBookRecordingSample = buildOrderBookRecordingSample(
      { ...kiteViewSnapshot, lastPrice: 150.54 },
      "5m",
      new Date("2026-11-23T08:40:01.000Z"),
    );

    const points = buildOrderBookGraphPoints([first, second, {} as OrderBookRecordingSample]);
    expect(points).toHaveLength(2);
    expect(points[0]?.stockPrice).toBe(150.53);
    expect(points[0]?.maxBid?.price).toBe(150.52);
    expect(points[0]?.maxBid?.quantity).toBe(3686);
    expect(points[0]?.maxOffer?.price).toBe(150.59);
    expect(points[0]?.maxOffer?.quantity).toBe(6758);
    expect(points[1]?.time).toBeGreaterThan(points[0]!.time);
    expect(points[1]?.stockPrice).toBe(150.54);
  });
});
