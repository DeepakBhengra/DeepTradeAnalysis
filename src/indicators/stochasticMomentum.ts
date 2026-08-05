export interface StochasticMomentumValues {
  smi: number;
  signal: number;
}

/** How relative-close / relative-range are double-smoothed before SMI. */
export type StochasticMomentumSmooth = "ema" | "rma";

export interface StochasticMomentumOptions {
  /**
   * Double-smooth method for Blau SMI.
   * - `ema`: classic EMA (Deeppro / RulePNB default)
   * - `rma`: Wilder RMA / SMMA — matches Kite Stch Mtm crosses more closely for (10,3,3)
   */
  doubleSmooth?: StochasticMomentumSmooth;
}

function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[0]);
      continue;
    }
    result.push((values[i] - result[i - 1]) * multiplier + result[i - 1]);
  }

  return result;
}

/**
 * Wilder RMA (TradingView `ta.rma` / SMMA). Skips non-finite inputs; seeds with SMA
 * of the first `period` finite values.
 */
function rma(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  let prev = Number.NaN;
  let count = 0;
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!Number.isFinite(value)) {
      continue;
    }

    if (count < period) {
      sum += value;
      count += 1;
      if (count === period) {
        prev = sum / period;
        result[i] = prev;
      }
      continue;
    }

    prev = (prev * (period - 1) + value) / period;
    result[i] = prev;
  }

  return result;
}

/** EMA that skips non-finite inputs (for RMA-path signal line). */
function emaSparse(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(Number.NaN);
  const multiplier = 2 / (period + 1);
  let prev = Number.NaN;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!Number.isFinite(value)) {
      continue;
    }
    if (!Number.isFinite(prev)) {
      prev = value;
      result[i] = prev;
      continue;
    }
    prev = (value - prev) * multiplier + prev;
    result[i] = prev;
  }

  return result;
}

/**
 * William Blau Stochastic Momentum Index (SMI), matching Kite "Stch Mtm".
 * Defaults: K=10, D=3 (double smooth), signal EMA=10 (Kite %D).
 *
 * Deeppro1 / RuleSUNPHARMA1 pass `doubleSmooth: "rma"` so black/red crosses
 * align with Kite charts (EMA double-smooth false-fires on tangled bars).
 */
export function computeStochasticMomentum(
  highs: number[],
  lows: number[],
  closes: number[],
  lengthK = 10,
  lengthD = 3,
  lengthEma = 10,
  options?: StochasticMomentumOptions,
): StochasticMomentumValues[] {
  const length = closes.length;
  const doubleSmooth = options?.doubleSmooth ?? "ema";
  const relativeClose: number[] = [];
  const relativeRange: number[] = [];

  for (let i = 0; i < length; i++) {
    if (i + 1 < lengthK) {
      relativeClose.push(NaN);
      relativeRange.push(NaN);
      continue;
    }

    const sliceHigh = highs.slice(i + 1 - lengthK, i + 1);
    const sliceLow = lows.slice(i + 1 - lengthK, i + 1);
    const highest = Math.max(...sliceHigh);
    const lowest = Math.min(...sliceLow);
    relativeClose.push(closes[i] - (highest + lowest) / 2);
    relativeRange.push(highest - lowest);
  }

  let avgRel: number[];
  let avgRange: number[];
  let smi: number[];
  let signal: number[];

  if (doubleSmooth === "rma") {
    avgRel = rma(rma(relativeClose, lengthD), lengthD);
    avgRange = rma(rma(relativeRange, lengthD), lengthD);
    smi = avgRel.map((value, index) => {
      if (index + 1 < lengthK || !Number.isFinite(value)) {
        return NaN;
      }
      const range = avgRange[index];
      if (!Number.isFinite(range) || range === 0) {
        return 0;
      }
      return (200 * value) / range;
    });
    signal = emaSparse(smi, lengthEma).map((value, index) =>
      index + 1 < lengthK ? NaN : value,
    );
  } else {
    // Seed NaNs with 0 so EMA can warm up; early bars stay NaN on output.
    const seededClose = relativeClose.map((value) =>
      Number.isFinite(value) ? value : 0,
    );
    const seededRange = relativeRange.map((value) =>
      Number.isFinite(value) ? value : 0,
    );

    avgRel = ema(ema(seededClose, lengthD), lengthD);
    avgRange = ema(ema(seededRange, lengthD), lengthD);

    smi = avgRel.map((value, index) => {
      if (index + 1 < lengthK) {
        return NaN;
      }
      const range = avgRange[index];
      if (!Number.isFinite(range) || range === 0) {
        return 0;
      }
      return (200 * value) / range;
    });

    const signalSeed = smi.map((value) => (Number.isFinite(value) ? value : 0));
    signal = ema(signalSeed, lengthEma).map((value, index) =>
      index + 1 < lengthK ? NaN : value,
    );
  }

  return smi.map((value, index) => ({
    smi: value,
    signal: signal[index],
  }));
}
