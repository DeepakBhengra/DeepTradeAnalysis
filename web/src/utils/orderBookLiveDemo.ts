import type { OrderBookSnapshot } from "../types/orderBook";

export function isLiveGraphDemoEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("liveGraphDemo") === "1";
}

/** Local preview ticks so the live graph can run without a Kite session. */
export function buildDemoOrderBookSnapshot(
  symbol: string,
  tick: number,
): OrderBookSnapshot {
  const mid = Number((147.9 + (tick % 11) * 0.01).toFixed(2));
  const fatBidQty = 18_000 + (tick % 6) * 250;
  const fatOfferQty = 6_000 + (tick % 5) * 180;
  const bids = [
    { price: Number((mid - 0.05).toFixed(2)), orders: 1, quantity: 500 + tick },
    { price: Number((mid - 0.1).toFixed(2)), orders: 4, quantity: fatBidQty },
    { price: Number((mid - 0.11).toFixed(2)), orders: 1, quantity: 2_000 },
    { price: Number((mid - 0.12).toFixed(2)), orders: 3, quantity: 756 },
    { price: Number((mid - 0.13).toFixed(2)), orders: 2, quantity: 607 },
  ];
  const offers = [
    { price: Number((mid + 0.05).toFixed(2)), orders: 3, quantity: 233 },
    { price: Number((mid + 0.06).toFixed(2)), orders: 6, quantity: 1_472 },
    { price: Number((mid + 0.07).toFixed(2)), orders: 8, quantity: fatOfferQty },
    { price: Number((mid + 0.08).toFixed(2)), orders: 8, quantity: 2_967 },
    { price: Number((mid + 0.09).toFixed(2)), orders: 12, quantity: 1_330 },
  ];
  const phase = tick % 10;
  const lastPrice =
    phase === 0
      ? bids[1].price
      : phase === 5
        ? offers[2].price
        : mid;
  return {
    symbol: symbol.includes(":") ? symbol : `NSE:${symbol}`,
    lastPrice,
    buyQuantity: 1_946_228,
    sellQuantity: 2_628_206,
    bidOrders: 11,
    offerOrders: 37,
    bids,
    offers,
    rows: bids.map((bid, index) => ({
      bid,
      offer: offers[index] ?? null,
    })),
  };
}
