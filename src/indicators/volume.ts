import { config } from "../config.js";
import type { Candle, VolumeDirection, VolumeSnapshot } from "../types.js";

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

export function computeVolumeSma(
  volumes: number[],
  period = config.volume.smaPeriod,
): number[] {
  return sma(volumes, period);
}

export function computeRelativeVolume(currentVol: number, volumeSma: number): number {
  if (!Number.isFinite(volumeSma) || volumeSma <= 0) {
    return NaN;
  }
  return currentVol / volumeSma;
}

export function computeVolumeDirection(
  candles: Candle[],
  lookback = config.volume.directionLookback,
): VolumeDirection {
  if (candles.length < lookback) {
    return "neutral";
  }

  const slice = candles.slice(-lookback);
  let bullishVolume = 0;
  let bearishVolume = 0;

  for (const candle of slice) {
    if (candle.close > candle.open) {
      bullishVolume += candle.volume;
    } else if (candle.close < candle.open) {
      bearishVolume += candle.volume;
    }
  }

  if (bullishVolume === 0 && bearishVolume === 0) {
    return "neutral";
  }

  const ratio = bullishVolume / (bearishVolume || 1);
  if (ratio >= 1.25) {
    return "bullish";
  }
  if (ratio <= 0.8) {
    return "bearish";
  }
  return "neutral";
}

export function buildVolumeSnapshots(candles: Candle[]): VolumeSnapshot[] {
  const volumes = candles.map((candle) => candle.volume);
  const volumeSmas = computeVolumeSma(volumes);

  return candles.map((candle, index) => {
    const volumeSma = volumeSmas[index];
    const history = candles.slice(0, index + 1);
    return {
      rvol: computeRelativeVolume(candle.volume, volumeSma),
      volumeSma,
      direction: computeVolumeDirection(history),
    };
  });
}
