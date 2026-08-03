export interface StochasticMomentumValues {
  smi: number;
  signal: number;
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
 * William Blau Stochastic Momentum Index (SMI), matching Kite "Stch Mtm".
 * Defaults: K=10, D=3 (double EMA), signal EMA=10 (Kite %D).
 */
export function computeStochasticMomentum(
  highs: number[],
  lows: number[],
  closes: number[],
  lengthK = 10,
  lengthD = 3,
  lengthEma = 10,
): StochasticMomentumValues[] {
  const length = closes.length;
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

  // Seed NaNs with 0 so EMA can warm up; early bars stay NaN on output.
  const seededClose = relativeClose.map((value) =>
    Number.isFinite(value) ? value : 0,
  );
  const seededRange = relativeRange.map((value) =>
    Number.isFinite(value) ? value : 0,
  );

  const avgRel = ema(ema(seededClose, lengthD), lengthD);
  const avgRange = ema(ema(seededRange, lengthD), lengthD);

  const smi = avgRel.map((value, index) => {
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
  const signal = ema(signalSeed, lengthEma).map((value, index) =>
    index + 1 < lengthK ? NaN : value,
  );

  return smi.map((value, index) => ({
    smi: value,
    signal: signal[index],
  }));
}
