import { config } from "../config.js";
import type {
  BollingerBands,
  Candle,
  IndicatorSnapshot,
  MacdValues,
} from "../types.js";

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      result.push(NaN);
      continue;
    }
    const slice = values.slice(i + 1 - period, i + 1);
    const avg = slice.reduce((sum, value) => sum + value, 0) / period;
    result.push(avg);
  }
  return result;
}

function stdDev(values: number[], period: number): number[] {
  const means = sma(values, period);
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      result.push(NaN);
      continue;
    }
    const slice = values.slice(i + 1 - period, i + 1);
    const mean = means[i];
    const variance =
      slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
    result.push(Math.sqrt(variance));
  }

  return result;
}

export function computeEma(values: number[], period: number): number[] {
  return ema(values, period);
}

function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[0]);
      continue;
    }

    const previous = result[i - 1];
    result.push((values[i] - previous) * multiplier + previous);
  }

  return result;
}

export function computeBollingerBands(
  closes: number[],
  length = config.bollinger.length,
  stdDevMultiplier = config.bollinger.stdDev,
): BollingerBands[] {
  const middle = sma(closes, length);
  const deviations = stdDev(closes, length);

  return closes.map((_, index) => ({
    middle: middle[index],
    upper: middle[index] + stdDevMultiplier * deviations[index],
    lower: middle[index] - stdDevMultiplier * deviations[index],
  }));
}

export function computeRsi(
  closes: number[],
  period = config.rsi.period,
): number[] {
  const result: number[] = [NaN];

  for (let i = 1; i < closes.length; i++) {
    if (i < period) {
      result.push(NaN);
      continue;
    }

    const slice = closes.slice(i - period + 1, i + 1);
    let gains = 0;
    let losses = 0;

    for (let j = 1; j < slice.length; j++) {
      const change = slice[j] - slice[j - 1];
      if (change >= 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
      result.push(100);
      continue;
    }

    const rs = avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

export function computeMacd(
  closes: number[],
  fastPeriod = config.macd.fastPeriod,
  slowPeriod = config.macd.slowPeriod,
  signalPeriod = config.macd.signalPeriod,
): MacdValues[] {
  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);
  const macdLine = closes.map((_, index) => fastEma[index] - slowEma[index]);
  const signalLine = ema(macdLine, signalPeriod);

  return closes.map((_, index) => ({
    macdLine: macdLine[index],
    signalLine: signalLine[index],
    histogram: macdLine[index] - signalLine[index],
  }));
}

function isValidNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function buildIndicatorSnapshots(candles: Candle[]): IndicatorSnapshot[] {
  const closes = candles.map((candle) => candle.close);
  const bollinger = computeBollingerBands(closes);
  const rsi = computeRsi(closes);
  const macd = computeMacd(closes);

  return candles.map((candle, index) => ({
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    bollinger: bollinger[index],
    rsi: rsi[index],
    macd: macd[index],
  }));
}

export function getUsableSnapshots(snapshots: IndicatorSnapshot[]): IndicatorSnapshot[] {
  return snapshots.filter((snapshot) => {
    const { upper, middle, lower } = snapshot.bollinger;
    const { macdLine, signalLine, histogram } = snapshot.macd;
    return (
      isValidNumber(upper) &&
      isValidNumber(middle) &&
      isValidNumber(lower) &&
      isValidNumber(snapshot.rsi) &&
      isValidNumber(macdLine) &&
      isValidNumber(signalLine) &&
      isValidNumber(histogram)
    );
  });
}

export function linearSlope(values: number[], lookback: number): number {
  if (values.length < lookback || lookback < 2) {
    return NaN;
  }

  const slice = values.slice(-lookback);
  const n = slice.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += slice[i];
    sumXY += i * slice[i];
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return 0;
  }

  return (n * sumXY - sumX * sumY) / denominator;
}

export function emaSlopeDegrees(
  values: number[],
  lookback: number,
): number {
  const slope = linearSlope(values, lookback);
  if (!Number.isFinite(slope)) {
    return NaN;
  }

  const lastValue = values[values.length - 1];
  if (!Number.isFinite(lastValue) || lastValue === 0) {
    return NaN;
  }

  const pctSlopePerBar = (slope / lastValue) * 100;
  return (Math.atan(pctSlopePerBar) * 180) / Math.PI;
}
