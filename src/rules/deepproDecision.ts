import { config } from "../config.js";
import { computeStochasticMomentum } from "../indicators/stochasticMomentum.js";
import type {
  DeepakBbMatchType,
  DeepakDecisionResult,
  DeepakTradeSignal,
  DeepproBbProximity,
  DeepproEventKind,
  DeepproSignal,
  DeepproScanResult,
  IndicatorSnapshot,
} from "../types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
  parseHmToMinutes,
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

function taggedLowerBand(
  snapshots: IndicatorSnapshot[],
  from: number,
  to: number,
): boolean {
  for (let i = from; i <= to; i++) {
    const snapshot = snapshots[i];
    if (!snapshot) {
      continue;
    }
    if (classifyBbBottomMatch(snapshot.bollinger.lower, snapshot.low, snapshot.close)) {
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

function troughSmi(values: Array<{ smi: number }>, from: number, to: number): number {
  let trough = Number.POSITIVE_INFINITY;
  for (let i = from; i <= to; i++) {
    const value = values[i]?.smi;
    if (Number.isFinite(value) && value < trough) {
      trough = value;
    }
  }
  return trough;
}

function macdHistDeltaPct(
  prevHistogram: number,
  curHistogram: number,
  close: number,
): number {
  if (!Number.isFinite(close) || close === 0) {
    return 0;
  }
  return (Math.abs(curHistogram - prevHistogram) / Math.abs(close)) * 100;
}

function isBeforeEntryDeadline(timeIst: string, deadlineIst: string): boolean {
  return parseHmToMinutes(timeIst) < parseHmToMinutes(deadlineIst);
}

function isInInclusiveHmWindow(
  timeIst: string,
  fromIst: string | null,
  toIst: string | null,
): boolean {
  const minutes = parseHmToMinutes(timeIst);
  if (fromIst != null && minutes < parseHmToMinutes(fromIst)) {
    return false;
  }
  if (toIst != null && minutes > parseHmToMinutes(toIst)) {
    return false;
  }
  return true;
}

/**
 * True SMI↔signal bearish event: SMI was strictly above signal, then crosses
 * to at-or-below (includes a literal touch of the signal line).
 */
export function isSmiBearishCrossOrTouch(
  prevSmi: number,
  prevSignal: number,
  curSmi: number,
  curSignal: number,
): boolean {
  return prevSmi > prevSignal && curSmi <= curSignal;
}

/**
 * True SMI↔signal bullish event: SMI was strictly below signal, then crosses
 * to at-or-above (includes a literal touch of the signal line).
 */
export function isSmiBullishCrossOrTouch(
  prevSmi: number,
  prevSignal: number,
  curSmi: number,
  curSignal: number,
): boolean {
  return prevSmi < prevSignal && curSmi >= curSignal;
}

/**
 * Absolute slope angle (degrees) of the SMI (black) line over one bar,
 * in normalized SMI units where `scalePerBar` SMI-points ≈ 45° visual pitch.
 * Used for the approach into the red-line cross (prev→cur on the cross bar).
 */
export function smiBlackSlopeAngleDeg(
  prevSmi: number,
  curSmi: number,
  scalePerBar: number,
): number {
  if (!Number.isFinite(prevSmi) || !Number.isFinite(curSmi) || !(scalePerBar > 0)) {
    return 0;
  }
  return Math.abs(Math.atan((curSmi - prevSmi) / scalePerBar) * (180 / Math.PI));
}

/**
 * SELL: black must be falling into the red-line cross with slope ≥ min
 * (default 35°; reject shallow ~15–20°).
 */
export function passesSellSmiAngle(
  prevSmi: number,
  curSmi: number,
  scalePerBar: number,
  minAngleDeg: number,
): { ok: boolean; angleDeg: number } {
  const angleDeg = smiBlackSlopeAngleDeg(prevSmi, curSmi, scalePerBar);
  const falling = curSmi < prevSmi;
  return { ok: falling && angleDeg >= minAngleDeg, angleDeg };
}

/**
 * BUY: black must be rising into the red-line cross with slope ≥ min
 * (default 35°; reject shallow ~15–20°).
 */
export function passesBuySmiAngle(
  prevSmi: number,
  curSmi: number,
  scalePerBar: number,
  minAngleDeg: number,
): { ok: boolean; angleDeg: number } {
  const angleDeg = smiBlackSlopeAngleDeg(prevSmi, curSmi, scalePerBar);
  const rising = curSmi > prevSmi;
  return { ok: rising && angleDeg >= minAngleDeg, angleDeg };
}

/**
 * SELL quality gate — favors same-day square-off ≥ ~0.75%:
 * SMI cross only, event 10:45–12:30, RSI ≥ 67, BB upper gap capped.
 */
export function passesDeepproSellQuality(signal: DeepproSignal): boolean {
  const quality = config.deeppro.qualityFilter;
  if (!quality?.enabled) {
    return true;
  }
  const sell = quality.sell;
  if (!(sell.allowedEventKinds as string[]).includes(signal.eventKind)) {
    return false;
  }
  if (
    !isInInclusiveHmWindow(
      signal.eventTimeIst,
      sell.eventFromIst,
      sell.eventToIst,
    )
  ) {
    return false;
  }
  if (signal.bbUpperProximity.gapPct > sell.maxBbUpperGapPct) {
    return false;
  }

  return signal.eventRsi >= sell.minEventRsi;
}

/**
 * BUY quality gate — favors same-day square-off ≥ ~0.75%:
 * SMI cross only + one of:
 *   A) BB lower matched (not both-band squeeze; after 11:00 needs RSI≥40)
 *   B) unmatched morning proximity (event≤10:30, BB lower gap≤0.65)
 *   C) rare extreme late cross (RSI≤12, MACD hist≤-5, event≤12:30)
 * Soft RSI caps still apply (≤50, or ≤60 when BB lower matched).
 */
export function passesDeepproBuyQuality(signal: DeepproSignal): boolean {
  const quality = config.deeppro.qualityFilter;
  if (!quality?.enabled) {
    return true;
  }
  const buy = quality.buy;
  if (!isInInclusiveHmWindow(signal.eventTimeIst, null, buy.eventToIst)) {
    return false;
  }
  if (!(buy.allowedEventKinds as string[]).includes(signal.eventKind)) {
    return false;
  }
  if (signal.bbLowerProximity.gapPct > buy.maxBbLowerGapPct) {
    return false;
  }

  const bbLowerMatched = signal.bbLowerProximity.matchType != null;
  const bbUpperMatched = signal.bbUpperProximity.matchType != null;
  const maxRsi = bbLowerMatched ? buy.matchedBbMaxEventRsi : buy.maxEventRsi;
  if (signal.eventRsi > maxRsi) {
    return false;
  }

  if (buy.rejectBothBandsMatched && bbLowerMatched && bbUpperMatched) {
    return false;
  }

  // Path A — BB lower confirmed
  if (bbLowerMatched) {
    const needsRecovery = !isInInclusiveHmWindow(
      signal.eventTimeIst,
      null,
      buy.matchedRecoveryAfterIst,
    );
    if (needsRecovery && signal.eventRsi < buy.matchedRecoveryMinEventRsi) {
      return false;
    }
    return true;
  }

  // Path B — unmatched morning proximity
  if (
    isInInclusiveHmWindow(signal.eventTimeIst, null, buy.unmatchedEventToIst) &&
    signal.bbLowerProximity.gapPct <= buy.unmatchedMaxBbLowerGapPct
  ) {
    return true;
  }

  // Path C — rare extreme late cross
  if (
    buy.allowExtremeStallException &&
    signal.eventRsi <= buy.extremeStallMaxEventRsi &&
    signal.bbLowerProximity.gapPct <= buy.extremeStallMaxBbLowerGapPct &&
    signal.macdHistogram <= buy.extremeStallMaxMacdHist &&
    isInInclusiveHmWindow(signal.eventTimeIst, null, buy.extremeStallEventToIst)
  ) {
    return true;
  }

  return false;
}

function withSellQualityReasons(signal: DeepproSignal): DeepproSignal {
  const sell = config.deeppro.qualityFilter.sell;
  return {
    ...signal,
    reasons: [
      ...signal.reasons,
      `Quality SELL: SMI cross only, event ${sell.eventFromIst}–${sell.eventToIst}, RSI≥${sell.minEventRsi}, BB upper gap≤${sell.maxBbUpperGapPct}%`,
    ],
  };
}

function withBuyQualityReasons(signal: DeepproSignal): DeepproSignal {
  const buy = config.deeppro.qualityFilter.buy;
  return {
    ...signal,
    reasons: [
      ...signal.reasons,
      `Quality BUY: SMI cross only; BB-lower match (no dual-band squeeze; after ${buy.matchedRecoveryAfterIst} RSI≥${buy.matchedRecoveryMinEventRsi}) or unmatched≤${buy.unmatchedEventToIst} gap≤${buy.unmatchedMaxBbLowerGapPct}% or extreme RSI≤${buy.extremeStallMaxEventRsi}`,
    ],
  };
}

/** Keep one signal per side+event candle (multiple SMI crosses can share one stall). */
function dedupeDeepproSignals(signals: DeepproSignal[]): DeepproSignal[] {
  const byEvent = new Map<string, DeepproSignal>();
  for (const signal of signals) {
    const key = `${signal.side}|${signal.eventTimeIst}`;
    const existing = byEvent.get(key);
    if (!existing) {
      byEvent.set(key, signal);
      continue;
    }
    // Prefer the deeper exhaustion peak/trough when two crosses map to one event.
    const existingDepth = Math.abs(existing.peakSmi);
    const nextDepth = Math.abs(signal.peakSmi);
    if (nextDepth > existingDepth) {
      byEvent.set(key, signal);
    }
  }
  return [...byEvent.values()].sort((left, right) =>
    left.timeIst.localeCompare(right.timeIst),
  );
}

/**
 * deeppro — pink-circle pattern from Stch Mtm exhaustion reversals:
 *
 * 1. Stochastic Momentum (Kite Stch Mtm K=10,D=3,signalEMA=10) bearish
 *    cross/touch while in/from overbought (SMI >= 40)
 * 1b. Black-line slope ≥ minSellSmiAngleDeg (default 35°) into the downward red-line cross
 * 2. Deep overbought peak in lookback (default peak SMI >= 65)
 * 3. Upper Bollinger Band tagged in the same lookback
 * 4. MACD histogram declining on the cross candle (momentum fade)
 * 5. Meaningful MACD hist fade vs price (drops weak 0.08–0.25% setups)
 * 6. Event candle before entry deadline (default before 14:00 IST)
 * 7. Quality gate (default on): SMI cross only, event 10:45–12:30, RSI≥67,
 *    BB upper gap≤1.75% — tuned for same-day square-off ≥ ~0.75%
 *
 * Signal time = event time = SMI bearish-cross candle (IST) when
 * `signalOnSmiCrossOnly` is enabled (default).
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
    entryDeadlineIst,
    minMacdHistDeltaPct,
    signalOnSmiCrossOnly,
    smiAngleScalePerBar,
    minSellSmiAngleDeg,
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

    const bearishCross = isSmiBearishCrossOrTouch(
      prev.smi,
      prev.signal,
      cur.smi,
      cur.signal,
    );
    if (!bearishCross) {
      continue;
    }

    const sellAngle = passesSellSmiAngle(
      prev.smi,
      cur.smi,
      smiAngleScalePerBar,
      minSellSmiAngleDeg,
    );
    if (!sellAngle.ok) {
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

    const histDeltaPct = macdHistDeltaPct(
      prevSnapshot.macd.histogram,
      snapshot.macd.histogram,
      snapshot.close,
    );
    if (histDeltaPct < minMacdHistDeltaPct) {
      continue;
    }

    let eventIndex = index;
    let eventKind: DeepproSignal["eventKind"] = "smi_cross";

    if (!signalOnSmiCrossOnly) {
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

      if (bestStallIndex !== null) {
        eventIndex = bestStallIndex;
        eventKind = "stall_at_highs";
      }
    }

    const eventSnapshot = snapshots[eventIndex];
    const eventTimeIst = formatIstTime(eventSnapshot.timestamp);
    if (!isBeforeEntryDeadline(eventTimeIst, entryDeadlineIst)) {
      continue;
    }

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
        `SMI black slope ${sellAngle.angleDeg.toFixed(1)}° >= ${minSellSmiAngleDeg}° into downward cross (reject shallow ~15–20°)`,
        `Peak SMI ${peak.toFixed(1)} >= ${minPeakSmi}`,
        "Upper Bollinger Band tagged in lookback",
        "MACD histogram declining",
        `MACD hist Δ ${histDeltaPct.toFixed(3)}% >= ${minMacdHistDeltaPct}% of price`,
        `Event ${eventKind} at ${eventTimeIst} IST (before ${entryDeadlineIst})`,
        `Event RSI ${eventSnapshot.rsi.toFixed(2)}`,
        `BB upper gap ${bbUpperProximity.gapPct.toFixed(3)}% (${bbUpperProximity.matchType ?? "none"})`,
        `BB lower gap ${bbLowerProximity.gapPct.toFixed(3)}% (${bbLowerProximity.matchType ?? "none"})`,
      ],
    });
  }

  const qualitySignals = dedupeDeepproSignals(signals)
    .filter(passesDeepproSellQuality)
    .map(withSellQualityReasons);

  return {
    dateKey: resolvedDateKey,
    rule: "deeppro",
    sessionStart,
    sessionEnd,
    signals: qualitySignals,
  };
}

/**
 * deeppro BUY — mirror of the short exhaustion pattern:
 *
 * 1. Stochastic Momentum (Kite Stch Mtm K=10,D=3,signalEMA=10) bullish
 *    cross/touch while in/from oversold (SMI <= -40)
 * 1b. Black-line slope ≥ minBuySmiAngleDeg (default 35°) into the upward red-line cross
 * 2. Deep oversold trough in lookback (default trough SMI <= -65)
 * 3. Lower Bollinger Band tagged in the same lookback
 * 4. MACD histogram rising on the cross candle (momentum recovery)
 * 5. Meaningful MACD hist rise vs price (drops weak 0.08–0.25% setups)
 * 6. Event candle before entry deadline (default before 14:00 IST)
 * 7. Quality gate (default on): SMI cross only + BB-lower paths A/B/C,
 *    event≤13:15 — tuned for same-day square-off ≥ ~0.75%
 *
 * Signal time = event time = SMI bullish-cross candle (IST) when
 * `signalOnSmiCrossOnly` is enabled (default).
 */
export function evaluateDeepproBuySignals(
  snapshots: IndicatorSnapshot[],
  dateKey?: string,
): DeepproScanResult {
  const {
    sessionStart,
    sessionEnd,
    lookbackBars,
    oversoldLevel,
    maxTroughSmi,
    stallBodyRatioMax,
    entryDeadlineIst,
    minMacdHistDeltaPct,
    signalOnSmiCrossOnly,
    smiAngleScalePerBar,
    minBuySmiAngleDeg,
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

    const bullishCross = isSmiBullishCrossOrTouch(
      prev.smi,
      prev.signal,
      cur.smi,
      cur.signal,
    );
    if (!bullishCross) {
      continue;
    }

    const buyAngle = passesBuySmiAngle(
      prev.smi,
      cur.smi,
      smiAngleScalePerBar,
      minBuySmiAngleDeg,
    );
    if (!buyAngle.ok) {
      continue;
    }

    const fromOversold =
      cur.smi <= oversoldLevel || prev.smi <= oversoldLevel;
    if (!fromOversold) {
      continue;
    }

    const lookbackFrom = Math.max(0, index - lookbackBars + 1);
    const trough = troughSmi(smiSeries, lookbackFrom, index);
    if (trough > maxTroughSmi) {
      continue;
    }

    if (!taggedLowerBand(snapshots, lookbackFrom, index)) {
      continue;
    }

    const snapshot = snapshots[index];
    const prevSnapshot = snapshots[index - 1];
    const histRising = snapshot.macd.histogram > prevSnapshot.macd.histogram;
    if (!histRising) {
      continue;
    }

    const histDeltaPct = macdHistDeltaPct(
      prevSnapshot.macd.histogram,
      snapshot.macd.histogram,
      snapshot.close,
    );
    if (histDeltaPct < minMacdHistDeltaPct) {
      continue;
    }

    let eventIndex = index;
    let eventKind: DeepproSignal["eventKind"] = "smi_cross";

    if (!signalOnSmiCrossOnly) {
      let bestStallRatio = Number.POSITIVE_INFINITY;
      let bestStallIndex: number | null = null;
      let swingLow = Number.POSITIVE_INFINITY;
      for (let i = lookbackFrom; i <= index; i++) {
        swingLow = Math.min(swingLow, snapshots[i].low);
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
          (Math.abs(later.low - swingLow) / later.close) * 100 <= 0.5;
        const stall =
          ratio <= stallBodyRatioMax &&
          Boolean(
            classifyBbBottomMatch(later.bollinger.lower, later.low, later.close) ||
              later.low <= later.bollinger.lower * 1.002 ||
              nearSwing,
          );
        if (stall && ratio <= bestStallRatio) {
          bestStallRatio = ratio;
          bestStallIndex = laterIndex;
          eventIndex = laterIndex;
          eventKind = "stall_at_lows";
        }

        if (eventKind === "smi_cross") {
          const exitOs =
            earlierSmi.smi <= oversoldLevel && laterSmi.smi > oversoldLevel;
          if (exitOs && laterSmi.smi > laterSmi.signal) {
            eventIndex = laterIndex;
            eventKind = "smi_exit_oversold";
            continue;
          }

          const macdCross =
            snapshots[laterIndex - 1].macd.macdLine <=
              snapshots[laterIndex - 1].macd.signalLine &&
            later.macd.macdLine > later.macd.signalLine;
          if (macdCross) {
            eventIndex = laterIndex;
            eventKind = "macd_bull_cross";
          }
        }
      }

      if (bestStallIndex !== null) {
        eventIndex = bestStallIndex;
        eventKind = "stall_at_lows";
      }
    }

    const eventSnapshot = snapshots[eventIndex];
    const eventTimeIst = formatIstTime(eventSnapshot.timestamp);
    if (!isBeforeEntryDeadline(eventTimeIst, entryDeadlineIst)) {
      continue;
    }

    const bbUpperProximity = buildBbUpperProximity(eventSnapshot);
    const bbLowerProximity = buildBbLowerProximity(eventSnapshot);

    signals.push({
      side: "BUY",
      rule: "deeppro",
      dateKey: resolvedDateKey,
      timeIst: formatIstTime(snapshot.timestamp),
      eventTimeIst,
      eventKind,
      price: snapshot.close,
      smi: cur.smi,
      smiSignal: cur.signal,
      peakSmi: trough,
      rsi: snapshot.rsi,
      eventRsi: eventSnapshot.rsi,
      bbUpperProximity,
      bbLowerProximity,
      macdHistogram: snapshot.macd.histogram,
      reasons: [
        `Stch Mtm(${config.deeppro.smi.lengthK},${config.deeppro.smi.lengthD},${config.deeppro.smi.lengthEma}) bullish cross from oversold`,
        `SMI black slope ${buyAngle.angleDeg.toFixed(1)}° >= ${minBuySmiAngleDeg}° into upward cross (reject shallow ~15–20°)`,
        `Trough SMI ${trough.toFixed(1)} <= ${maxTroughSmi}`,
        "Lower Bollinger Band tagged in lookback",
        "MACD histogram rising",
        `MACD hist Δ ${histDeltaPct.toFixed(3)}% >= ${minMacdHistDeltaPct}% of price`,
        `Event ${eventKind} at ${eventTimeIst} IST (before ${entryDeadlineIst})`,
        `Event RSI ${eventSnapshot.rsi.toFixed(2)}`,
        `BB upper gap ${bbUpperProximity.gapPct.toFixed(3)}% (${bbUpperProximity.matchType ?? "none"})`,
        `BB lower gap ${bbLowerProximity.gapPct.toFixed(3)}% (${bbLowerProximity.matchType ?? "none"})`,
      ],
    });
  }

  const qualitySignals = dedupeDeepproSignals(signals)
    .filter(passesDeepproBuyQuality)
    .map(withBuyQualityReasons);

  return {
    dateKey: resolvedDateKey,
    rule: "deeppro",
    sessionStart,
    sessionEnd,
    signals: qualitySignals,
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

export function evaluateDeepproBuyAcrossDays(
  snapshots: IndicatorSnapshot[],
  dateKeys: string[],
): DeepproSignal[] {
  const signals: DeepproSignal[] = [];
  for (const dateKey of dateKeys) {
    const day = evaluateDeepproBuySignals(snapshots, dateKey);
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

const EVENT_SCENARIO_NUMBER: Record<DeepproEventKind, number> = {
  smi_cross: 1,
  stall_at_highs: 2,
  stall_at_lows: 2,
  smi_exit_overbought: 3,
  smi_exit_oversold: 3,
  macd_bear_cross: 4,
  macd_bull_cross: 4,
};

/** Combine BUY + SELL deeppro signals for one session date. */
export function evaluateDeepproDay(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): DeepproScanResult {
  const sell = evaluateDeepproSignals(snapshots, dateKey);
  const buy = evaluateDeepproBuySignals(snapshots, dateKey);
  const signals = [...sell.signals, ...buy.signals].sort((left, right) =>
    left.timeIst.localeCompare(right.timeIst),
  );

  return {
    dateKey,
    rule: "deeppro",
    sessionStart: sell.sessionStart,
    sessionEnd: sell.sessionEnd,
    signals,
  };
}

/** Map a deeppro signal into the shared day-scan trade-signal shape. */
export function deepproSignalToTradeSignal(signal: DeepproSignal): DeepakTradeSignal {
  const proximity =
    signal.side === "SELL" ? signal.bbUpperProximity : signal.bbLowerProximity;
  const bbMatchType: DeepakBbMatchType = proximity.matchType ?? "close";

  return {
    side: signal.side,
    scenarioKey: `deeppro ${signal.eventKind.replace(/_/g, " ")}`,
    scenarioNumber: EVENT_SCENARIO_NUMBER[signal.eventKind],
    timeIst: signal.timeIst,
    price: signal.price,
    bbMatchType,
    profitTarget: 0,
    exit: null,
  };
}

/** Adapt deeppro day signals into the Deepak decision shape used by dashboard/post-mortem. */
export function evaluateDeepproDecision(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): DeepakDecisionResult | null {
  const day = evaluateDeepproDay(snapshots, dateKey);
  if (day.signals.length === 0) {
    return null;
  }

  const tradeSignals = day.signals.map(deepproSignalToTradeSignal);
  const lastSignal = tradeSignals[tradeSignals.length - 1];
  const lastSnapshot =
    snapshots.find((snapshot) => {
      const parts = getIstTimeParts(snapshot.timestamp);
      return parts.dateKey === dateKey && formatIstTime(snapshot.timestamp) === lastSignal.timeIst;
    }) ??
    [...snapshots].reverse().find((snapshot) => {
      const parts = getIstTimeParts(snapshot.timestamp);
      return parts.dateKey === dateKey;
    });

  if (!lastSnapshot) {
    return null;
  }

  return {
    dateKey,
    decision: lastSignal.side,
    activeScenario: lastSignal.scenarioKey,
    scenarioTrail: tradeSignals.map((signal) => ({
      scenarioKey: signal.scenarioKey,
      timeIst: signal.timeIst,
      bbMatchType: signal.bbMatchType,
    })),
    signals: tradeSignals,
    reasons: day.signals.flatMap((signal) => signal.reasons),
    snapshot: lastSnapshot,
  };
}
