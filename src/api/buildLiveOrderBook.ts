import { resolveDashboardSymbol } from "../config.js";
import { fetchPnbQuote } from "../data/quoteFeed.js";
import {
  buildOrderBookSnapshot,
  type OrderBookSnapshot,
} from "../studies/pnbOrderBookSnapshot.js";

export async function buildLiveOrderBook(
  symbolInput?: string,
): Promise<OrderBookSnapshot> {
  const dashboardSymbol = resolveDashboardSymbol(symbolInput);
  const quote = await fetchPnbQuote(dashboardSymbol.symbol);

  if (!quote) {
    throw new Error(`No live Kite quote for ${dashboardSymbol.symbol}.`);
  }

  return buildOrderBookSnapshot(dashboardSymbol.symbol, quote);
}
