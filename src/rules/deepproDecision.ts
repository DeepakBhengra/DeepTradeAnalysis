import { config } from "../config.js";
import { computeStochasticMomentum } from "../indicators/stochasticMomentum.js";
import type {
  DeepproBbProximity,
  DeepproSignal,
  DeepproScanResult,
  IndicatorSnapshot,
} from "../types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
} from "../utils/marketTime.js";
import {
  bbMatchGapPct,
  classifyBbBottomMatch,
  classifyBbTopMatch,
  pctDistance,
} from "./bollingerUtils.js";

function buildBbUpperProximity(snapshot: IndicatorSnapshot): DeepproBbProximity {
  const matchType = classifyBbTopMatch(
    snapshot.bollinger.upper,
    snapshot.high,
    snapshot.close,
  );
  const gapPct = matchType
    ? bbMatchGapPct(
        matchType,
        "top",
        snapshot.bollinger.upper,
        snapshot.high,
        snapshot.close,
      )
    : pctDistance(snapshot.bollinger.upper, snapshot.high, snapshot.close);
  const signedGapPct =
    ((snapshot.high - snapshot.bollinger.upper) / snapshot.close) * 100;

  return {
    gapPct,
    signedGapPct,
    matchType,
    price: snapshot.high,
    bbLevel: snapshot.bollinger.upper,
  };
}

function buildBbLowerProximity(snapshot: IndicatorSnapshot): DeepproBbProximity {
  const matchType = classifyBbBottomMatch(
    snapshot.bollinger.lower,
    snapshot.low,
    snapshot.close,
  );
  const gapPct = matchType
    ? bbMatchGapPct(
        matchType,
        "bottom",
        snapshot.bollinger.lower,
        snapshot.low,
        snapshot.close,
      )
    : pctDistance(snapshot.bollinger.lower, snapshot.low, snapshot.close);
  const signedGapPct =
    ((snapshot.bollinger.lower - snapshot.low) / snapshot.close) * 100;

  return {
    gapPct,
    signedGapPct,
    matchType,
    price: snapshot.low,
    bbLevel: snapshot.bollinger.lower,
  };
}

function isUsableSnapshot(snapshot: IndicatorSnapshot): boolean {
  return (
    Number.isFinite(snapshot.bollinger.upper) &&
    Number.isFinite(snapshot.bollinger.lower) &&
    Number.isFinite(snapshot.rsi) &&
    Number.isFinite(snapshot.macd.macdLine) &&
    Number.isFinite(snapshot.macd.signalLine) &&
    Number.isFinite(snapshot.macd.histogram)
  );
}

function bodyToRangeRatio(snapshot: IndicatorSnapshot): number {
  const range = snapshot.high - snapshot.low;
  if (range <= 0) {
    return 0;
  }
  return Math.abs(snapshot.close - snapshot.open) / range;
}

function taggedUpperBand(
  snapshots: IndicatorSnapshot[],
  from: number,
  to: number,
): boolean {
  for (let i = from; i <= to; i++) {
    const snapshot = snapshots[i];
    if (!snapshot) {
      continue;
    }
    if (classifyBbTopMatch(snapshot.bollinger.upper, snapshot.high, snapshot.close)) {
      return true;
    }
  }
  return false;
}

function peakSmi(values: Array<{ smi: number }>, from: number, to: number): number {
  let peak = Number.NEGATIVE_INFINITY;
  for (let i = from; i <= to; i++) {
    const value = values[i]?.smi;
    if (Number.isFinite(value) && value > peak) {
      peak = value;
    }
  }
  return peak;
}

/**
 * deeppro — pink-circle pattern from Stch Mtm exhaustion reversals:
 *
 * 1. Stochastic Momentum (10,3,3) bearish cross while in/from overbought (SMI >= 40)
 * 2. Deep overbought peak in lookback (default peak SMI >= 70)
 * 3. Upper Bollinger Band tagged in the same lookback
 * 4. MACD histogram declining on the cross candle (momentum fade)
 *
 * Signal time = SMI bearish-cross candle (IST). Event time may also surface a
 * nearby stall/doji at highs or SMI exit from overbought (chart annotation).
 */
export function evaluateDeepproSignals(
  snapshots: IndicatorSnapshot[],
  dateKey?: string,
): DeepproScanResult {
  const {
    sessionStart,
    sessionEnd,
    lookbackBars,
    overboughtLevel,
    minPeakSmi,
    stallBodyRatioMax,
  } = config.deeppro;

  const resolvedDateKey =
    dateKey ??
    (snapshots.length > 0
      ? getIstTimeParts(snapshots[snapshots.length - 1].timestamp).dateKey
      : "");

  const dayIndexes: number[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    if (!isUsableSnapshot(snapshot)) {
      continue;
    }
    if (!isWithinIstSessionWindow(snapshot.timestamp, sessionStart, sessionEnd)) {
      continue;
    }
    const parts = getIstTimeParts(snapshot.timestamp);
    if (resolvedDateKey && parts.dateKey !== resolvedDateKey) {
      continue;
    }
    dayIndexes.push(i);
  }

  const highs = snapshots.map((snapshot) => snapshot.high);
  const lows = snapshots.map((snapshot) => snapshot.low);
  const closes = snapshots.map((snapshot) => snapshot.close);
  const smiSeries = computeStochasticMomentum(
    highs,
    lows,
    closes,
    config.deeppro.smi.lengthK,
    config.deeppro.smi.lengthD,
    config.deeppro.smi.lengthEma,
  );

  const signals: DeepproSignal[] = [];

  for (const index of dayIndexes) {
    if (index < 1) {
      continue;
    }

    const prev = smiSeries[index - 1];
    const cur = smiSeries[index];
    if (
      !Number.isFinite(prev.smi) ||
      !Number.isFinite(prev.signal) ||
      !Number.isFinite(cur.smi) ||
      !Number.isFinite(cur.signal)
    ) {
      continue;
    }

    const bearishCross = prev.smi >= prev.signal && cur.smi < cur.signal;
    if (!bearishCross) {
      continue;
    }

    const fromOverbought =
      cur.smi >= overboughtLevel || prev.smi >= overboughtLevel;
    if (!fromOverbought) {
      continue;
    }

    const lookbackFrom = Math.max(0, index - lookbackBars + 1);
    const peak = peakSmi(smiSeries, lookbackFrom, index);
    if (peak < minPeakSmi) {
      continue;
    }

    if (!taggedUpperBand(snapshots, lookbackFrom, index)) {
      continue;
    }

    const snapshot = snapshots[index];
    const prevSnapshot = snapshots[index - 1];
    const histDeclining =
      snapshot.macd.histogram < prevSnapshot.macd.histogram;
    if (!histDeclining) {
      continue;
    }

    let eventIndex = index;
    let eventKind: DeepproSignal["eventKind"] = "smi_cross";
    let bestStallRatio = Number.POSITIVE_INFINITY;
    let bestStallIndex: number | null = null;
    let swingHigh = Number.NEGATIVE_INFINITY;
    for (let i = lookbackFrom; i <= index; i++) {
      swingHigh = Math.max(swingHigh, snapshots[i].high);
    }

    for (let j = 1; j <= 3 && index + j < snapshots.length; j++) {
      const laterIndex = index + j;
      const later = snapshots[laterIndex];
      const laterSmi = smiSeries[laterIndex];
      const earlierSmi = smiSeries[laterIndex - 1];
      if (!later || !laterSmi || !earlierSmi) {
        break;
      }
      if (getIstTimeParts(later.timestamp).dateKey !== resolvedDateKey) {
        break;
      }
      if (!isWithinIstSessionWindow(later.timestamp, sessionStart, sessionEnd)) {
        break;
      }

      const ratio = bodyToRangeRatio(later);
      const nearSwing =
        (Math.abs(later.high - swingHigh) / later.close) * 100 <= 0.5;
      const stall =
        ratio <= stallBodyRatioMax &&
        Boolean(
          classifyBbTopMatch(later.bollinger.upper, later.high, later.close) ||
            later.high >= later.bollinger.upper * 0.998 ||
            nearSwing,
        );
      if (stall && ratio <= bestStallRatio) {
        bestStallRatio = ratio;
        bestStallIndex = laterIndex;
        eventIndex = laterIndex;
        eventKind = "stall_at_highs";
      }

      if (eventKind === "smi_cross") {
        const exitOb =
          earlierSmi.smi >= overboughtLevel && laterSmi.smi < overboughtLevel;
        if (exitOb && laterSmi.smi < laterSmi.signal) {
          eventIndex = laterIndex;
          eventKind = "smi_exit_overbought";
          continue;
        }

        const macdCross =
          snapshots[laterIndex - 1].macd.macdLine >=
            snapshots[laterIndex - 1].macd.signalLine &&
          later.macd.macdLine < later.macd.signalLine;
        if (macdCross) {
          eventIndex = laterIndex;
          eventKind = "macd_bear_cross";
        }
      }
    }

    // Prefer most doji-like stall near highs when present (chart pink annotation).
    if (bestStallIndex !== null) {
      eventIndex = bestStallIndex;
      eventKind = "stall_at_highs";
    }

    const eventSnapshot = snapshots[eventIndex];
    const eventTimeIst = formatIstTime(eventSnapshot.timestamp);
    const bbUpperProximity = buildBbUpperProximity(eventSnapshot);
    const bbLowerProximity = buildBbLowerProximity(eventSnapshot);

    signals.push({
      side: "SELL",
      rule: "deeppro",
      dateKey: resolvedDateKey,
      timeIst: formatIstTime(snapshot.timestamp),
      eventTimeIst,
      eventKind,
      price: snapshot.close,
      smi: cur.smi,
      smiSignal: cur.signal,
      peakSmi: peak,
      rsi: snapshot.rsi,
      eventRsi: eventSnapshot.rsi,
      bbUpperProximity,
      bbLowerProximity,
      macdHistogram: snapshot.macd.histogram,
      reasons: [
        `Stch Mtm(${config.deeppro.smi.lengthK},${config.deeppro.smi.lengthD},${config.deeppro.smi.lengthEma}) bearish cross from overbought`,
        `Peak SMI ${peak.toFixed(1)} >= ${minPeakSmi}`,
        "Upper Bollinger Band tagged in lookback",
        "MACD histogram declining",
        `Event ${eventKind} at ${eventTimeIst} IST`,
        `Event RSI ${eventSnapshot.rsi.toFixed(2)}`,
        `BB upper gap ${bbUpperProximity.gapPct.toFixed(3)}% (${bbUpperProximity.matchType ?? "none"})`,
        `BB lower gap ${bbLowerProximity.gapPct.toFixed(3)}% (${bbLowerProximity.matchType ?? "none"})`,
      ],
    });
  }

  return {
    dateKey: resolvedDateKey,
    rule: "deeppro",
    sessionStart,
    sessionEnd,
    signals,
  };
}

export function evaluateDeepproAcrossDays(
  snapshots: IndicatorSnapshot[],
  dateKeys: string[],
): DeepproSignal[] {
  const signals: DeepproSignal[] = [];
  for (const dateKey of dateKeys) {
    const day = evaluateDeepproSignals(snapshots, dateKey);
    signals.push(...day.signals);
  }
  return signals;
}

/** Helper for tests/scripts that only have OHLC candles + snapshots. */
export function candlesToDeepproScan(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): DeepproScanResult {
  return evaluateDeepproSignals(snapshots, dateKey);
}
