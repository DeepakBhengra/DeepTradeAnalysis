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
  liveLevelCount: number;
  requestedLevels: number;
  bids: OrderBookSideRow[];
  offers: OrderBookSideRow[];
  rows: PairedDepthRow[];
}
