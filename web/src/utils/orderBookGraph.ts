import type {
  OrderBookRecordingSample,
  OrderBookSideRow,
  OrderBookSnapshot,
} from "../types/orderBook";

export const ORDER_BOOK_DISPLAY_LEVELS = 5;

export interface HighestQuantityLevel extends OrderBookSideRow {
  /** 1-based index among the 5 displayed bid or offer rows. */
  level: number;
}

export interface OrderBookGraphPoint {
  time: number;
  recordedAtIst: string;
  stockPrice: number;
  highestBidQty: HighestQuantityLevel | null;
  highestOfferQty: HighestQuantityLevel | null;
}

function numericQty(value: unknown): number {
  const qty = typeof value === "number" ? value : Number(value);
  return Number.isFinite(qty) ? qty : 0;
}

function displayedSideLevels(
  snapshot: OrderBookSnapshot,
  side: "bid" | "offer",
): Array<{ row: OrderBookSideRow; level: number }> {
  if (snapshot.rows.length > 0) {
    return snapshot.rows.slice(0, ORDER_BOOK_DISPLAY_LEVELS).flatMap((paired, index) => {
      const row = paired[side];
      return row ? [{ row, level: index + 1 }] : [];
    });
  }

  const source = (side === "bid" ? snapshot.bids : snapshot.offers).slice(
    0,
    ORDER_BOOK_DISPLAY_LEVELS,
  );
  return source.map((row, index) => ({ row, level: index + 1 }));
}

/**
 * Among the 5 bid (or offer) rows on screen at this instant, the row with the
 * largest quantity — not the best price, and not a running max over time.
 */
export function highestQuantityAmongFive(
  snapshot: OrderBookSnapshot,
  side: "bid" | "offer",
): HighestQuantityLevel | null {
  let best: HighestQuantityLevel | null = null;
  for (const { row, level } of displayedSideLevels(snapshot, side)) {
    const quantity = numericQty(row.quantity);
    if (quantity <= 0) {
      continue;
    }
    if (!best || quantity > best.quantity) {
      best = {
        price: Number(row.price),
        orders: numericQty(row.orders),
        quantity,
        level,
      };
    }
  }
  return best;
}

export function highestQuantityBid(
  snapshot: OrderBookSnapshot,
): HighestQuantityLevel | null {
  return highestQuantityAmongFive(snapshot, "bid");
}

export function highestQuantityOffer(
  snapshot: OrderBookSnapshot,
): HighestQuantityLevel | null {
  return highestQuantityAmongFive(snapshot, "offer");
}

function unixSeconds(iso: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return 0;
  }
  return Math.floor(ms / 1000);
}

/** One graph point per snapshot: stock price vs time, plus highest-qty of 5 bids/offers. */
export function buildOrderBookGraphPoints(
  samples: OrderBookRecordingSample[],
): OrderBookGraphPoint[] {
  const points: OrderBookGraphPoint[] = [];
  let lastTime = 0;

  for (const sample of samples) {
    const snapshot = sample?.snapshot;
    if (!snapshot || !Number.isFinite(snapshot.lastPrice)) {
      continue;
    }

    let time = unixSeconds(sample.recordedAtIso);
    if (time <= 0) {
      continue;
    }
    if (time <= lastTime) {
      time = lastTime + 1;
    }
    lastTime = time;

    points.push({
      time,
      recordedAtIst: sample.recordedAtIst,
      stockPrice: snapshot.lastPrice,
      highestBidQty: highestQuantityBid(snapshot),
      highestOfferQty: highestQuantityOffer(snapshot),
    });
  }

  return points;
}
