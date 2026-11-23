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
  lastPrice: 150.36,
  buyQuantity: 10,
  sellQuantity: 12,
  bidOrders: 1,
  offerOrders: 1,
  bids: [{ price: 150.32, orders: 3, quantity: 364 }],
  offers: [{ price: 150.37, orders: 3, quantity: 1367 }],
  rows: [],
};

describe("useOrderBookRecorder", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("does not fetch until Start recording", async () => {
    const { result } = renderHook(() => useOrderBookRecorder("PNB"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchLiveOrderBookMock).not.toHaveBeenCalled();
    expect(result.current.recording).toBe(false);
    expect(result.current.samples).toHaveLength(0);
  });

  it("captures immediately, again on the selected interval, then stops", async () => {
    vi.useFakeTimers();
    fetchLiveOrderBookMock.mockResolvedValue(snapshot);

    const { result } = renderHook(() => useOrderBookRecorder("PNB"));

    act(() => {
      result.current.start();
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.recording).toBe(true);
    expect(result.current.samples).toHaveLength(1);
    expect(fetchLiveOrderBookMock).toHaveBeenCalledWith("PNB");

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.samples).toHaveLength(2);

    act(() => {
      result.current.stop();
    });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.recording).toBe(false);
    expect(result.current.samples).toHaveLength(2);
  });
});
