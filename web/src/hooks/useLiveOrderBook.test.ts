import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLiveOrderBook } from "./useLiveOrderBook";

vi.mock("../api/client", () => ({
  fetchLiveOrderBook: vi.fn(),
}));

import { fetchLiveOrderBook } from "../api/client";

const fetchLiveOrderBookMock = vi.mocked(fetchLiveOrderBook);

describe("useLiveOrderBook", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads a snapshot for the given symbol", async () => {
    fetchLiveOrderBookMock.mockResolvedValue({
      symbol: "NSE:TCS",
      lastPrice: 2388,
      buyQuantity: 10,
      sellQuantity: 12,
      bidOrders: 1,
      offerOrders: 1,
      liveLevelCount: 1,
      requestedLevels: 20,
      bids: [{ price: 2387, orders: 1, quantity: 10 }],
      offers: [{ price: 2388, orders: 1, quantity: 12 }],
      rows: [
        {
          bid: { price: 2387, orders: 1, quantity: 10 },
          offer: { price: 2388, orders: 1, quantity: 12 },
        },
      ],
    });

    const { result } = renderHook(() => useLiveOrderBook("TCS", true));

    await waitFor(() => {
      expect(result.current.data?.symbol).toBe("NSE:TCS");
    });
    expect(fetchLiveOrderBookMock).toHaveBeenCalledWith("TCS");
    expect(result.current.error).toBeNull();
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(() => useLiveOrderBook("TCS", false));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchLiveOrderBookMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
