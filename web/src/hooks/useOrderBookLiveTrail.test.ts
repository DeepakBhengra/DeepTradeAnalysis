import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrderBookSnapshot } from "../types/orderBook";
import { useOrderBookLiveTrail } from "./useOrderBookLiveTrail";

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

describe("useOrderBookLiveTrail", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("appends live ticks without Start recording and rolls off the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T06:00:00.000Z"));

    const { result, rerender } = renderHook(
      ({ book }: { book: OrderBookSnapshot | null }) =>
        useOrderBookLiveTrail(book, "1m", "PNB"),
      { initialProps: { book: snapshot } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.snapshot.lastPrice).toBe(150.43);

    vi.setSystemTime(new Date("2026-11-25T06:00:01.000Z"));
    rerender({ book: { ...snapshot, lastPrice: 150.44 } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toHaveLength(2);

    vi.setSystemTime(new Date("2026-11-25T06:01:05.000Z"));
    rerender({ book: { ...snapshot, lastPrice: 150.5 } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.snapshot.lastPrice).toBe(150.5);
  });

  it("clears the trail when the symbol changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T06:00:00.000Z"));

    const { result, rerender } = renderHook(
      ({ symbol }: { symbol: string | null }) =>
        useOrderBookLiveTrail(snapshot, "5m", symbol),
      { initialProps: { symbol: "PNB" } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toHaveLength(1);

    rerender({ symbol: "TCS" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.recordedAtIso).toBe("2026-11-25T06:00:00.000Z");
  });
});
