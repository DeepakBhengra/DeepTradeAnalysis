/** Blank, zero, NaN, or negative → stop-loss disabled. */
export function normalizeStopLossPct(
  value: number | null | undefined,
): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

/**
 * Adverse move % vs entry (loss direction for the side).
 * BUY: price fell; SELL: price rose.
 */
export function adverseMovePct(
  side: "BUY" | "SELL",
  entryPrice: number,
  markPrice: number,
): number {
  if (
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(markPrice) ||
    entryPrice === 0
  ) {
    return 0;
  }
  if (side === "BUY") {
    return ((entryPrice - markPrice) / entryPrice) * 100;
  }
  return ((markPrice - entryPrice) / entryPrice) * 100;
}

export function isStopLossHit(
  side: "BUY" | "SELL",
  entryPrice: number,
  markPrice: number,
  stopLossPct: number | null | undefined,
): boolean {
  const threshold = normalizeStopLossPct(stopLossPct);
  if (threshold == null) {
    return false;
  }
  return adverseMovePct(side, entryPrice, markPrice) >= threshold;
}

export function oppositeSide(side: "BUY" | "SELL"): "BUY" | "SELL" {
  return side === "BUY" ? "SELL" : "BUY";
}
