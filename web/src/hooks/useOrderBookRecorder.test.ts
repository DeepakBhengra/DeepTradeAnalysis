import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOrderBookRecorder } from "./useOrderBookRecorder";

vi.mock("../api/client", () => ({
  fetchLiveOrderBook: vi.fn(),
}));

import { fetchLiveOrderBook } from "../api/client";

const fetchLiveOrderBookMock = vi.mocked(fetchLiveOrderBook);

const snapshot = {
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

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useOrderBookRecorder", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("does not fetch until Start recording", async () => {
    const { result } = renderHook(() => useOrderBookRecorder("PNB"));

    await flush();

    expect(fetchLiveOrderBookMock).not.toHaveBeenCalled();
    expect(result.current.recording).toBe(false);
    expect(result.current.samples).toHaveLength(0);
  });

  it("writes a row on start, skips unchanged books, appends on bid/offer change, then stops", async () => {
    vi.useFakeTimers();
    fetchLiveOrderBookMock.mockResolvedValue(snapshot);

    const { result } = renderHook(() => useOrderBookRecorder("PNB"));

    act(() => {
      result.current.start();
    });
    await flush();

    expect(result.current.recording).toBe(true);
    expect(result.current.samples).toHaveLength(1);
    expect(fetchLiveOrderBookMock).toHaveBeenCalledWith("PNB");

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.samples).toHaveLength(1);

    fetchLiveOrderBookMock.mockResolvedValue({
      ...snapshot,
      lastPrice: 150.44,
      bids: [{ price: 150.43, orders: 8, quantity: 2100 }],
      buyQuantity: 1_773_500,
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.samples).toHaveLength(2);
    expect(result.current.samples[1]?.snapshot.lastPrice).toBe(150.44);

    act(() => {
      result.current.stop();
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.recording).toBe(false);
    expect(result.current.samples).toHaveLength(2);
  });

  it("auto-stops when the selected time range elapses", async () => {
    vi.useFakeTimers();
    fetchLiveOrderBookMock.mockResolvedValue(snapshot);

    const { result } = renderHook(() => useOrderBookRecorder("PNB"));

    act(() => {
      result.current.start();
    });
    await flush();
    expect(result.current.recording).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.recording).toBe(false);
    expect(result.current.samples.length).toBeGreaterThanOrEqual(1);
  });
});
