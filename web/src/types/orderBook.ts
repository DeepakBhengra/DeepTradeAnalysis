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

export const ORDER_BOOK_RECORD_INTERVALS = ["1m", "5m", "15m", "30m"] as const;

export type OrderBookRecordInterval = (typeof ORDER_BOOK_RECORD_INTERVALS)[number];

export interface OrderBookRecordingSample {
  recordedAtIso: string;
  recordedAtIst: string;
  interval: OrderBookRecordInterval;
  snapshot: OrderBookSnapshot;
}
