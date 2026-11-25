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
  const lastPrice = Number((147.9 + (tick % 11) * 0.01).toFixed(2));
  const fatBidQty = 18_000 + (tick % 6) * 250;
  const fatOfferQty = 6_000 + (tick % 5) * 180;
  const bids = [
    { price: lastPrice - 0.05, orders: 1, quantity: 500 + tick },
    { price: lastPrice - 0.1, orders: 4, quantity: fatBidQty },
    { price: lastPrice - 0.11, orders: 1, quantity: 2_000 },
    { price: lastPrice - 0.12, orders: 3, quantity: 756 },
    { price: lastPrice - 0.13, orders: 2, quantity: 607 },
  ];
  const offers = [
    { price: lastPrice + 0.05, orders: 3, quantity: 233 },
    { price: lastPrice + 0.06, orders: 6, quantity: 1_472 },
    { price: lastPrice + 0.07, orders: 8, quantity: fatOfferQty },
    { price: lastPrice + 0.08, orders: 8, quantity: 2_967 },
    { price: lastPrice + 0.09, orders: 12, quantity: 1_330 },
  ];
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
