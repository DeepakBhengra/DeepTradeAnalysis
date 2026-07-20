export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "SL";

export interface CandleOHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PendingOrder {
  id: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price: number;
  placedAtSessionIndex: number;
}

export interface Position {
  quantity: number;
  avgPrice: number;
}

export interface FillRecord {
  id: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price: number;
  sessionIndex: number;
}

export interface PortfolioState {
  cash: number;
  position: Position;
  pendingOrders: PendingOrder[];
  fills: FillRecord[];
}

export interface PnLSummary {
  cash: number;
  equity: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  returnPct: number;
}

export interface PlaceOrderInput {
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  price?: number;
}

export interface PlaceOrderResult {
  success: boolean;
  error?: string;
  portfolio: PortfolioState;
}

export const INITIAL_CASH = 1_000_000;
