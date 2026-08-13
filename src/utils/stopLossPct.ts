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

export function stopLossReverseSignalKey(signalKey: string): string {
  return `${signalKey}-sl-rev`;
}

/**
 * Inclusive IST deadline for opening a reverse entry after stop-loss.
 * Aligns with Deeppro1: SL still exits after this time, but no flip entry.
 */
export const STOP_LOSS_REVERSE_ENTRY_DEADLINE_IST = "11:45";

function parseHmToMinutes(timeIst: string): number {
  const [hourText, minuteText] = timeIst.split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

/** True when a stop-loss reverse entry is allowed at this IST time (≤ 11:45). */
export function canOpenStopLossReverseEntry(
  timeIst: string,
  deadlineIst: string = STOP_LOSS_REVERSE_ENTRY_DEADLINE_IST,
): boolean {
  if (!timeIst || !deadlineIst) {
    return false;
  }
  return parseHmToMinutes(timeIst) <= parseHmToMinutes(deadlineIst);
}
