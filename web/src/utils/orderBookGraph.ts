import type {
  OrderBookRecordingSample,
  OrderBookSideRow,
  OrderBookSnapshot,
} from "../types/orderBook";

export interface OrderBookGraphPoint {
  time: number;
  recordedAtIst: string;
  stockPrice: number;
  maxBid: OrderBookSideRow | null;
  maxOffer: OrderBookSideRow | null;
}

/** Level with the largest quantity among the 5-level side; ties keep the nearer (first) price. */
export function maxQuantityLevel(
  levels: OrderBookSideRow[] | undefined,
): OrderBookSideRow | null {
  if (!levels || levels.length === 0) {
    return null;
  }

  let best: OrderBookSideRow | null = null;
  for (const row of levels) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
      continue;
    }
    if (!best || row.quantity > best.quantity) {
      best = row;
    }
  }
  return best;
}

export function maxQuantityBid(snapshot: OrderBookSnapshot): OrderBookSideRow | null {
  return maxQuantityLevel(snapshot.bids);
}

export function maxQuantityOffer(snapshot: OrderBookSnapshot): OrderBookSideRow | null {
  return maxQuantityLevel(snapshot.offers);
}

function unixSeconds(iso: string): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return 0;
  }
  return Math.floor(ms / 1000);
}

/** One graph point per recorded snapshot: stock price vs time, plus max-qty bid/offer. */
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
      maxBid: maxQuantityBid(snapshot),
      maxOffer: maxQuantityOffer(snapshot),
    });
  }

  return points;
}
