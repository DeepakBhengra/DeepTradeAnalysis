import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOrderBookRecorder } from "./useOrderBookRecorder";
import type { OrderBookSnapshot } from "../types/orderBook";

const snapshot: OrderBookSnapshot = {
  symbol: "NSE:PNB",
  lastPrice: 150.43,
  buyQuantity: 1773231,
  sellQuantity: 2920024,
  bidOrders: 35,
  offerOrders: 9,
  bids: [{ price: 150.43, orders: 7, quantity: 2057 }],
  offers: [{ price: 150.45, orders: 1, quantity: 422 }],
  rows: [],
};

describe("useOrderBookRecorder", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not record until Start recording even when a live snapshot is present", () => {
    const { result } = renderHook(() => useOrderBookRecorder("PNB", snapshot));

    expect(result.current.recording).toBe(false);
    expect(result.current.samples).toHaveLength(0);
  });

  it("writes a row on start, skips unchanged books, appends on bid/offer change, then stops", async () => {
    const { result, rerender } = renderHook(
      ({ book }: { book: OrderBookSnapshot | null }) => useOrderBookRecorder("PNB", book),
      { initialProps: { book: snapshot } },
    );

    act(() => {
      result.current.start();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.recording).toBe(true);
    expect(result.current.samples).toHaveLength(1);

    rerender({ book: snapshot });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.samples).toHaveLength(1);

    rerender({
      book: {
        ...snapshot,
        lastPrice: 150.44,
        bids: [{ price: 150.43, orders: 8, quantity: 2100 }],
        buyQuantity: 1_773_500,
      },
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.samples).toHaveLength(2);
    expect(result.current.samples[1]?.snapshot.lastPrice).toBe(150.44);

    act(() => {
      result.current.stop();
    });
    rerender({
      book: { ...snapshot, lastPrice: 150.5 },
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.recording).toBe(false);
    expect(result.current.samples).toHaveLength(2);
  });

  it("auto-stops when the selected time range elapses", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOrderBookRecorder("PNB", snapshot));

    act(() => {
      result.current.start();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.recording).toBe(true);
    expect(result.current.samples).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(result.current.recording).toBe(false);
    expect(result.current.samples).toHaveLength(1);
  });
});
