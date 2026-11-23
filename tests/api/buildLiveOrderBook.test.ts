import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchPnbQuote = vi.fn();

vi.mock("../../src/data/quoteFeed.js", () => ({
  fetchPnbQuote: (...args: unknown[]) => fetchPnbQuote(...args),
}));

describe("buildLiveOrderBook", () => {
  beforeEach(() => {
    fetchPnbQuote.mockReset();
  });

  it("maps a Kite quote into paired bid/offer rows for the dashboard symbol", async () => {
    fetchPnbQuote.mockResolvedValue({
      lastPrice: 150.95,
      buyQuantity: 2013775,
      sellQuantity: 2676374,
      bids: [{ price: 150.92, orders: 1, quantity: 474 }],
      asks: [{ price: 150.95, orders: 2, quantity: 295 }],
    });

    const { buildLiveOrderBook } = await import("../../src/api/buildLiveOrderBook.js");
    const snapshot = await buildLiveOrderBook("TCS");

    expect(fetchPnbQuote).toHaveBeenCalledWith("NSE:TCS");
    expect(snapshot.symbol).toBe("NSE:TCS");
    expect(snapshot.lastPrice).toBe(150.95);
    expect(snapshot.rows[0]).toEqual({
      bid: { price: 150.92, orders: 1, quantity: 474 },
      offer: { price: 150.95, orders: 2, quantity: 295 },
    });
    expect(snapshot.buyQuantity).toBe(2013775);
    expect(snapshot.sellQuantity).toBe(2676374);
    expect(snapshot.liveLevelCount).toBe(1);
    expect(snapshot.requestedLevels).toBe(20);
    expect(snapshot.rows).toHaveLength(20);
  });

  it("throws when Kite returns no quote", async () => {
    fetchPnbQuote.mockResolvedValue(null);
    const { buildLiveOrderBook } = await import("../../src/api/buildLiveOrderBook.js");
    await expect(buildLiveOrderBook("PNB")).rejects.toThrow(/No live Kite quote/);
  });
});
