import { describe, expect, it } from "vitest";

import type { OrderBookRecordingSample, OrderBookSnapshot } from "../types/orderBook";
import { buildOrderBookRecordingSample } from "./orderBookRecording";
import {
  buildOrderBookGraphPoints,
  highestQuantityBid,
  highestQuantityOffer,
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
  it("picks the 5-level bid and offer with the largest quantity, not the best price", () => {
    expect(highestQuantityBid(kiteViewSnapshot)).toMatchObject({
      price: 150.52,
      orders: 4,
      quantity: 3686,
      level: 2,
    });
    expect(highestQuantityOffer(kiteViewSnapshot)).toMatchObject({
      price: 150.59,
      orders: 9,
      quantity: 6758,
      level: 5,
    });
  });

  it("does not use the best bid when a deeper of the 5 levels has more qty", () => {
    const snapshot: OrderBookSnapshot = {
      ...kiteViewSnapshot,
      lastPrice: 150.8,
      bids: [
        { price: 150.8, orders: 2, quantity: 500 },
        { price: 150.75, orders: 4, quantity: 19032 },
        { price: 150.74, orders: 1, quantity: 2000 },
        { price: 150.73, orders: 1, quantity: 1000 },
        { price: 150.72, orders: 1, quantity: 800 },
      ],
      offers: [
        { price: 150.85, orders: 2, quantity: 400 },
        { price: 150.86, orders: 1, quantity: 900 },
        { price: 150.87, orders: 3, quantity: 11264 },
        { price: 150.88, orders: 1, quantity: 700 },
        { price: 150.89, orders: 1, quantity: 600 },
      ],
      rows: [
        {
          bid: { price: 150.8, orders: 2, quantity: 500 },
          offer: { price: 150.85, orders: 2, quantity: 400 },
        },
        {
          bid: { price: 150.75, orders: 4, quantity: 19032 },
          offer: { price: 150.86, orders: 1, quantity: 900 },
        },
        {
          bid: { price: 150.74, orders: 1, quantity: 2000 },
          offer: { price: 150.87, orders: 3, quantity: 11264 },
        },
        {
          bid: { price: 150.73, orders: 1, quantity: 1000 },
          offer: { price: 150.88, orders: 1, quantity: 700 },
        },
        {
          bid: { price: 150.72, orders: 1, quantity: 800 },
          offer: { price: 150.89, orders: 1, quantity: 600 },
        },
      ],
    };

    expect(highestQuantityBid(snapshot)).toMatchObject({
      price: 150.75,
      quantity: 19032,
      level: 2,
    });
    expect(highestQuantityOffer(snapshot)).toMatchObject({
      price: 150.87,
      quantity: 11264,
      level: 3,
    });
  });

  it("compares quantities as numbers even if JSON left them as strings", () => {
    const snapshot: OrderBookSnapshot = {
      ...kiteViewSnapshot,
      bids: [
        { price: 150.8, orders: 1, quantity: "3902" as unknown as number },
        { price: 150.75, orders: 1, quantity: "19032" as unknown as number },
      ],
      rows: [],
    };
    expect(highestQuantityBid(snapshot)).toMatchObject({
      price: 150.75,
      quantity: 19032,
      level: 2,
    });
  });

  it("keeps the nearer price when two of the 5 levels share the highest quantity", () => {
    const snapshot: OrderBookSnapshot = {
      ...kiteViewSnapshot,
      bids: [
        { price: 150.53, orders: 1, quantity: 1000 },
        { price: 150.52, orders: 1, quantity: 1000 },
      ],
    };
    expect(highestQuantityBid(snapshot)?.price).toBe(150.53);
    expect(highestQuantityBid(snapshot)?.level).toBe(1);
  });

  it("builds time-ordered graph points with stock price and highest-qty of 5", () => {
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
    expect(points[0]?.highestBidQty?.price).toBe(150.52);
    expect(points[0]?.highestBidQty?.quantity).toBe(3686);
    expect(points[0]?.highestOfferQty?.price).toBe(150.59);
    expect(points[0]?.highestOfferQty?.quantity).toBe(6758);
    expect(points[1]?.time).toBeGreaterThan(points[0]!.time);
    expect(points[1]?.stockPrice).toBe(150.54);
  });
});
