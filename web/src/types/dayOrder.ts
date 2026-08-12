import type { DayScanStrategy } from "./backtest";
import type { OrderSide } from "./paperTrading";

/** Paper capital for Day Order Simulator (₹1 crore). */
export const DAY_ORDER_INITIAL_CASH = 10_000_000;
/** Default qty per fill for a date run (overridable in the Order Simulator UI). */
export const ORDER_QUANTITY = 100;
/** Default max entry price filter (overridable in the Order Simulator UI). */
export const MAX_ENTRY_PRICE = 1900;
/** Default min entry price filter (overridable in the Order Simulator UI). */
export const MIN_ENTRY_PRICE = 0;

/** Per-date-run paper-trading knobs for Day Order Simulator. */
export interface DayOrderRunSettings {
  quantity: number;
  minEntryPrice: number;
  maxEntryPrice: number;
  /**
   * Adverse move % vs entry that forces an exit + reverse.
   * null / 0 / blank = disabled.
   */
  stopLossPct: number | null;
}

export const DEFAULT_DAY_ORDER_RUN_SETTINGS: DayOrderRunSettings = {
  quantity: ORDER_QUANTITY,
  minEntryPrice: MIN_ENTRY_PRICE,
  maxEntryPrice: MAX_ENTRY_PRICE,
  stopLossPct: null,
};

export type DayOrderFillKind = "entry" | "exit";

export interface DayOrderOpenPosition {
  signalKey: string;
  tradingSymbol: string;
  symbol: string;
  strategy: DayScanStrategy;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  entryTimeIst: string;
}

export interface DayOrderFill {
  id: string;
  kind: DayOrderFillKind;
  signalKey: string;
  tradingSymbol: string;
  symbol: string;
  strategy: DayScanStrategy;
  side: OrderSide;
  quantity: number;
  price: number;
  timeIst: string;
  sessionIndex: number;
  realizedPnL: number | null;
}

export interface DayOrderPortfolio {
  cash: number;
  openPositions: DayOrderOpenPosition[];
  fills: DayOrderFill[];
  realizedPnL: number;
  skippedEntryKeys: string[];
}

export interface DayOrderPnLSummary {
  cash: number;
  deployedCapital: number;
  equity: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  returnPct: number;
}

export type DayOrderSimStatus = "idle" | "running" | "complete";
