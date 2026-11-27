import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrderBookSnapshot } from "../types/orderBook";
import { useOrderBookTouchReport } from "./useOrderBookTouchReport";

const snapshot: OrderBookSnapshot = {
  symbol: "NSE:PNB",
  lastPrice: 147.74,
  buyQuantity: 18_482,
  sellQuantity: 2_663_647,
  bidOrders: 23,
  offerOrders: 22,
  bids: [
    { price: 147.71, orders: 4, quantity: 1194 },
    { price: 147.7, orders: 7, quantity: 4563 },
    { price: 147.69, orders: 4, quantity: 8336 },
    { price: 147.68, orders: 4, quantity: 1462 },
    { price: 147.67, orders: 4, quantity: 900 },
  ],
  offers: [
    { price: 147.74, orders: 3, quantity: 23 },
    { price: 147.75, orders: 12, quantity: 11210 },
    { price: 147.76, orders: 1, quantity: 12 },
    { price: 147.77, orders: 3, quantity: 472 },
    { price: 147.78, orders: 3, quantity: 100 },
  ],
  rows: [],
};

describe("useOrderBookTouchReport", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accumulates live touch instances without Start recording", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T07:16:41.000Z"));

    const { result, rerender } = renderHook(
      ({ book }: { book: OrderBookSnapshot | null }) =>
        useOrderBookTouchReport(book, "PNB"),
      { initialProps: { book: snapshot } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.events).toHaveLength(0);

    rerender({ book: { ...snapshot, lastPrice: 147.69 } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]?.touched).toBe("highest_bid");
    expect(result.current.events[0]?.stockPrice).toBe(147.69);
  });

  it("clears the report when the symbol changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T07:16:41.000Z"));

    const { result, rerender } = renderHook(
      ({
        book,
        symbol,
      }: {
        book: OrderBookSnapshot;
        symbol: string | null;
      }) => useOrderBookTouchReport(book, symbol),
      { initialProps: { book: { ...snapshot, lastPrice: 147.75 }, symbol: "PNB" } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.events).toHaveLength(1);

    rerender({ book: snapshot, symbol: "TCS" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.events).toHaveLength(0);
  });
});
