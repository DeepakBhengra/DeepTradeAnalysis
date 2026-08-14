/**
 * Equity intraday (MIS) brokerage & statutory charges — named `brokerage-charges`.
 *
 * Rates match common discount-broker intraday schedules used by the Day Order
 * Trade Simulator (₹20/order cap, STT on sell, stamp on buy, SEBI + exchange on
 * turnover, GST 18% on brokerage + exchange only).
 */

export const BROKERAGE_PER_ORDER = 20;
/** Cap as fraction of order value (0.03%). */
export const BROKERAGE_PCT_CAP = 0.0003;
/** STT on sell turnover (intraday). */
export const STT_SELL_PCT = 0.00025;
/** Exchange transaction charge on total turnover. */
export const EXCHANGE_TXN_PCT = 0.0000297;
/** SEBI charges on total turnover (₹10 / crore). */
export const SEBI_PCT = 0.000001;
/** Stamp duty on buy turnover. */
export const STAMP_DUTY_BUY_PCT = 0.00003;
/** GST on (brokerage + exchange txn charges). */
export const GST_PCT = 0.18;

export interface BrokerageChargesInput {
  /** Buy-side fill price (entry for long, cover for short). */
  buyPrice: number;
  /** Sell-side fill price (exit for long, entry for short). */
  sellPrice: number;
  quantity: number;
}

export interface BrokerageChargesBreakdown {
  buyValue: number;
  sellValue: number;
  turnover: number;
  brokerage: number;
  stt: number;
  exchangeTxnCharges: number;
  sebiCharges: number;
  stampDuty: number;
  gst: number;
  totalCharges: number;
  /** Gross P&L before charges: sellValue − buyValue. */
  grossProfit: number;
  /** Net P&L after all charges. */
  netProfit: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** STT is rounded to the nearest rupee. */
function roundStt(value: number): number {
  return Math.round(value);
}

function brokerageForOrder(orderValue: number): number {
  if (!(orderValue > 0)) {
    return 0;
  }
  return Math.min(BROKERAGE_PER_ORDER, roundMoney(orderValue * BROKERAGE_PCT_CAP));
}

/**
 * Compute equity intraday `brokerage-charges` for a completed round-trip.
 */
export function brokerageCharges(
  input: BrokerageChargesInput,
): BrokerageChargesBreakdown {
  const quantity = Number.isFinite(input.quantity) ? input.quantity : 0;
  const buyPrice = Number.isFinite(input.buyPrice) ? input.buyPrice : 0;
  const sellPrice = Number.isFinite(input.sellPrice) ? input.sellPrice : 0;

  const buyValue = roundMoney(buyPrice * quantity);
  const sellValue = roundMoney(sellPrice * quantity);
  const turnover = roundMoney(buyValue + sellValue);

  const brokerage = roundMoney(
    brokerageForOrder(buyValue) + brokerageForOrder(sellValue),
  );
  const stt = roundStt(sellValue * STT_SELL_PCT);
  const exchangeTxnCharges = roundMoney(turnover * EXCHANGE_TXN_PCT);
  const sebiCharges = roundMoney(turnover * SEBI_PCT);
  const stampDuty = roundMoney(buyValue * STAMP_DUTY_BUY_PCT);
  const gst = roundMoney((brokerage + exchangeTxnCharges) * GST_PCT);

  const totalCharges = roundMoney(
    brokerage + stt + exchangeTxnCharges + sebiCharges + stampDuty + gst,
  );
  const grossProfit = roundMoney(sellValue - buyValue);
  const netProfit = roundMoney(grossProfit - totalCharges);

  return {
    buyValue,
    sellValue,
    turnover,
    brokerage,
    stt,
    exchangeTxnCharges,
    sebiCharges,
    stampDuty,
    gst,
    totalCharges,
    grossProfit,
    netProfit,
  };
}

/**
 * Net realized P&L after `brokerage-charges` for a Day Order round-trip.
 * Long: buy at entry, sell at exit. Short: sell at entry, buy (cover) at exit.
 */
export function netRealizedPnLAfterBrokerageCharges(
  side: "BUY" | "SELL",
  entryPrice: number,
  exitPrice: number,
  quantity: number,
): number {
  if (side === "BUY") {
    return brokerageCharges({
      buyPrice: entryPrice,
      sellPrice: exitPrice,
      quantity,
    }).netProfit;
  }
  return brokerageCharges({
    buyPrice: exitPrice,
    sellPrice: entryPrice,
    quantity,
  }).netProfit;
}
