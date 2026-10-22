import type { DepthLevel } from "../types.js";
import type { KiteQuote } from "../data/quoteFeed.js";

export interface OrderBookSideRow {
  price: number;
  orders: number;
  quantity: number;
}

export interface PairedDepthRow {
  bid: OrderBookSideRow | null;
  offer: OrderBookSideRow | null;
}

export interface OrderBookSnapshot {
  symbol: string;
  lastPrice: number;
  buyQuantity: number;
  sellQuantity: number;
  bidOrders: number;
  offerOrders: number;
  bids: OrderBookSideRow[];
  offers: OrderBookSideRow[];
  rows: PairedDepthRow[];
}

export function formatIndianQty(value: number): string {
  return value.toLocaleString("en-IN");
}

export function toOrderBookRows(levels: DepthLevel[]): OrderBookSideRow[] {
  return levels.map((level) => ({
    price: level.price,
    orders: level.orders,
    quantity: level.quantity,
  }));
}

export function pairDepthRows(
  bids: OrderBookSideRow[],
  offers: OrderBookSideRow[],
): PairedDepthRow[] {
  const length = Math.max(bids.length, offers.length);
  const rows: PairedDepthRow[] = [];
  for (let i = 0; i < length; i++) {
    rows.push({
      bid: bids[i] ?? null,
      offer: offers[i] ?? null,
    });
  }
  return rows;
}

export function buildOrderBookSnapshot(
  symbol: string,
  quote: KiteQuote,
): OrderBookSnapshot {
  const bids = toOrderBookRows(quote.bids);
  const offers = toOrderBookRows(quote.asks);
  return {
    symbol,
    lastPrice: quote.lastPrice,
    buyQuantity: quote.buyQuantity,
    sellQuantity: quote.sellQuantity,
    bidOrders: bids.reduce((sum, level) => sum + level.orders, 0),
    offerOrders: offers.reduce((sum, level) => sum + level.orders, 0),
    bids,
    offers,
    rows: pairDepthRows(bids, offers),
  };
}

function sideCells(row: OrderBookSideRow | null): string {
  if (!row) {
    return "— | — | —";
  }
  return `${row.price.toFixed(2)} | ${row.orders} | ${formatIndianQty(row.quantity)}`;
}

export function formatOrderBookMarkdown(snapshot: OrderBookSnapshot): string {
  const header =
    "| Bid ₹ | Bid orders | Bid qty | Offer ₹ | Offer orders | Offer qty |";
  const align = "|------:|----------:|--------:|--------:|-------------:|----------:|";
  const body = snapshot.rows.map(
    (row) => `| ${sideCells(row.bid)} | ${sideCells(row.offer)} |`,
  );
  const totals = `| **Total** | **${snapshot.bidOrders}** | **${formatIndianQty(snapshot.buyQuantity)}** | **Total** | **${snapshot.offerOrders}** | **${formatIndianQty(snapshot.sellQuantity)}** |`;
  return [header, align, ...body, totals].join("\n");
}
