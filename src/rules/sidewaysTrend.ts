import { config } from "../config.js";
import { linearSlope } from "../indicators/compute.js";
import type {
  IndicatorSnapshot,
  ParameterCheckCandleRef,
  SidewaysDebug,
  SidewaysParameterCheck,
  SidewaysTrendParameters,
  SidewaysTrendState,
} from "../types.js";
import {
  getIstTimeParts,
  formatIstTime,
  isWithinIstSessionWindow,
} from "../utils/marketTime.js";
import {
  average,
  bbMatchGapPct,
  classifyBbBottomMatch,
  classifyBbTopMatch,
  pctDistance,
  sessionPriceExtremes,
} from "./bollingerUtils.js";

function isUsableSnapshot(snapshot: IndicatorSnapshot): boolean {
  return (
    Number.isFinite(snapshot.bollinger.upper) &&
    Number.isFinite(snapshot.bollinger.middle) &&
    Number.isFinite(snapshot.bollinger.lower) &&
    Number.isFinite(snapshot.rsi) &&
    Number.isFinite(snapshot.macd.macdLine) &&
    Number.isFinite(snapshot.macd.histogram)
  );
}

function bandWidthPct(snapshot: IndicatorSnapshot): number {
  const { upper, lower } = snapshot.bollinger;
  return ((upper - lower) / snapshot.close) * 100;
}

function isParallelBands(window: IndicatorSnapshot[]): boolean {
  if (window.length < 2) {
    return false;
  }

  const upperHistory = window.map((snapshot) => snapshot.bollinger.upper);
  const middleHistory = window.map((snapshot) => snapshot.bollinger.middle);
  const lowerHistory = window.map((snapshot) => snapshot.bollinger.lower);
  const lookback = Math.min(window.length, config.thresholds.slopeLookback);

  const upperSlope = linearSlope(upperHistory, lookback);
  const middleSlope = linearSlope(middleHistory, lookback);
  const lowerSlope = linearSlope(lowerHistory, lookback);

  const slopeDiffs = [
    Math.abs(upperSlope - middleSlope),
    Math.abs(upperSlope - lowerSlope),
    Math.abs(middleSlope - lowerSlope),
  ];

  return (
    Math.max(...slopeDiffs) <= config.thresholds.bbParallelSlopeTolerance
  );
}

export function selectSessionWindowFrom(
  snapshots: IndicatorSnapshot[],
  targetDateKey?: string,
): IndicatorSnapshot[] {
  if (snapshots.length === 0) {
    return [];
  }

  const dateKey =
    targetDateKey ??
    getIstTimeParts(snapshots[snapshots.length - 1].timestamp).dateKey;
  const { sessionStart, sessionEnd } = config.sidewaysTrend;

  return snapshots.filter((snapshot) => {
    const ist = getIstTimeParts(snapshot.timestamp);
    return (
      ist.dateKey === dateKey &&
      isWithinIstSessionWindow(snapshot.timestamp, sessionStart, sessionEnd)
    );
  });
}

function selectSessionWindow(
  usable: IndicatorSnapshot[],
  targetDateKey?: string,
): IndicatorSnapshot[] {
  return selectSessionWindowFrom(usable, targetDateKey);
}

function buildCandleRef(snapshot: IndicatorSnapshot): ParameterCheckCandleRef {
  const timeIst = formatIstTime(snapshot.timestamp);
  return {
    timeIst,
    intervalLabel: `15m candle ${timeIst} IST`,
    high: snapshot.high,
    low: snapshot.low,
    close: snapshot.close,
    candleColor: snapshot.close >= snapshot.open ? "green" : "red",
  };
}

function buildBbSessionCheckValue(
  kind: "top" | "bottom",
  matchType: "close" | "crossed" | null,
  gapPct: number,
  bbLevel: number,
  extremePrice: number,
  candleRef: ParameterCheckCandleRef,
): string {
  const bbLabel = kind === "top" ? "BB top" : "BB bottom";
  const priceLabel = kind === "top" ? "high" : "low";

  if (matchType === "close") {
    return `close · gap ${gapPct.toFixed(3)}% at ${candleRef.timeIst} IST (${priceLabel} ${extremePrice.toFixed(2)}, ${bbLabel} ${bbLevel.toFixed(2)})`;
  }
  if (matchType === "crossed") {
    return `crossed · by ${gapPct.toFixed(3)}% at ${candleRef.timeIst} IST (${priceLabel} ${extremePrice.toFixed(2)}, ${bbLabel} ${bbLevel.toFixed(2)})`;
  }
  return `gap ${gapPct.toFixed(3)}% (${bbLabel} ${bbLevel.toFixed(2)} vs ${priceLabel} ${extremePrice.toFixed(2)} at ${candleRef.timeIst} IST)`;
}

function buildParameterChecks(window: IndicatorSnapshot[]): {
  checks: SidewaysParameterCheck[];
  avgRsi: number;
  avgMacdHistogram: number;
  avgBandWidthPct: number;
  bbTopActive: boolean;
  bbBottomActive: boolean;
  allPriceWithinBands: boolean;
  parallelBands: boolean;
  rsiNeutral: boolean;
  macdFlat: boolean;
} {
  const upperValues = window.map((snapshot) => snapshot.bollinger.upper);
  const lowerValues = window.map((snapshot) => snapshot.bollinger.lower);
  const bbTopRange = average(upperValues);
  const bbBottomRange = average(lowerValues);
  const sessionEndClose = window[window.length - 1].close;
  const { sessionHigh, sessionLow, highCandle, lowCandle } =
    sessionPriceExtremes(window);

  const topMatchType = classifyBbTopMatch(bbTopRange, sessionHigh, sessionEndClose);
  const bottomMatchType = classifyBbBottomMatch(
    bbBottomRange,
    sessionLow,
    sessionEndClose,
  );
  const bbTopActive = topMatchType !== null;
  const bbBottomActive = bottomMatchType !== null;
  const topGapPct =
    topMatchType !== null
      ? bbMatchGapPct(topMatchType, "top", bbTopRange, sessionHigh, sessionEndClose)
      : pctDistance(bbTopRange, sessionHigh, sessionEndClose);
  const bottomGapPct =
    bottomMatchType !== null
      ? bbMatchGapPct(
          bottomMatchType,
          "bottom",
          bbBottomRange,
          sessionLow,
          sessionEndClose,
        )
      : pctDistance(bbBottomRange, sessionLow, sessionEndClose);
  const highCandleRef = buildCandleRef(highCandle);
  const lowCandleRef = buildCandleRef(lowCandle);
  const bbThreshold = `<= ${config.thresholds.bbClosePctThreshold}% close or crossed`;

  const parallelBands = isParallelBands(window);
  const avgRsi = average(window.map((snapshot) => snapshot.rsi));
  const avgMacdHistogram = average(
    window.map((snapshot) => snapshot.macd.histogram),
  );
  const avgAbsMacdHistogram = average(
    window.map((snapshot) => Math.abs(snapshot.macd.histogram)),
  );
  const avgBandWidthPct = average(window.map(bandWidthPct));

  const allPriceWithinBands = window.every(
    (snapshot) =>
      snapshot.close <= snapshot.bollinger.upper &&
      snapshot.close >= snapshot.bollinger.lower,
  );

  const { rsiNeutralMin, rsiNeutralMax, macdHistogramFlatThreshold } =
    config.sidewaysTrend;
  const rsiNeutral = avgRsi >= rsiNeutralMin && avgRsi <= rsiNeutralMax;
  const macdFlat = avgAbsMacdHistogram <= macdHistogramFlatThreshold;

  const checks: SidewaysParameterCheck[] = [
    {
      id: "sessionWindow",
      label: "Session window (IST)",
      passed: window.length >= config.sidewaysTrend.minCandlesInWindow,
      value: `${config.sidewaysTrend.sessionStart}–${config.sidewaysTrend.sessionEnd} (${window.length} candles)`,
      threshold: `>= ${config.sidewaysTrend.minCandlesInWindow} candles`,
    },
    {
      id: "bbTopCloseToSessionHigh",
      label: "BB(20,2) top close to session high",
      passed: bbTopActive,
      value: buildBbSessionCheckValue(
        "top",
        topMatchType,
        topGapPct,
        bbTopRange,
        sessionHigh,
        highCandleRef,
      ),
      threshold: bbThreshold,
      candleRef: highCandleRef,
      matchType: topMatchType ?? undefined,
      gapPct: topMatchType !== null ? topGapPct : undefined,
    },
    {
      id: "bbBottomCloseToSessionLow",
      label: "BB(20,2) bottom close to session low",
      passed: bbBottomActive,
      value: buildBbSessionCheckValue(
        "bottom",
        bottomMatchType,
        bottomGapPct,
        bbBottomRange,
        sessionLow,
        lowCandleRef,
      ),
      threshold: bbThreshold,
      candleRef: lowCandleRef,
      matchType: bottomMatchType ?? undefined,
      gapPct: bottomMatchType !== null ? bottomGapPct : undefined,
    },
    {
      id: "bbBandsParallel",
      label: "BB bands parallel",
      passed: parallelBands,
      value: parallelBands ? "slopes aligned" : "slopes diverging",
      threshold: `slope diff <= ${config.thresholds.bbParallelSlopeTolerance}`,
    },
    {
      id: "priceWithinBands",
      label: "Price within BB bands",
      passed: allPriceWithinBands,
      value: allPriceWithinBands ? "all closes inside bands" : "breakout detected",
      threshold: "close between lower and upper",
    },
    {
      id: "rsiNeutral",
      label: "RSI(14) neutral",
      passed: rsiNeutral,
      value: `avg ${avgRsi.toFixed(2)}`,
      threshold: `${rsiNeutralMin}–${rsiNeutralMax}`,
    },
    {
      id: "macdFlat",
      label: "MACD(12,26,9) histogram flat",
      passed: macdFlat,
      value: `avg |hist| ${avgAbsMacdHistogram.toFixed(3)}`,
      threshold: `<= ${macdHistogramFlatThreshold}`,
    },
    {
      id: "bandWidthCompressed",
      label: "BB band width compressed",
      passed: avgBandWidthPct <= config.thresholds.bbClosePctThreshold * 4,
      value: `avg width ${avgBandWidthPct.toFixed(3)}%`,
      threshold: `<= ${(config.thresholds.bbClosePctThreshold * 4).toFixed(1)}%`,
    },
  ];

  return {
    checks,
    avgRsi,
    avgMacdHistogram,
    avgBandWidthPct,
    bbTopActive,
    bbBottomActive,
    allPriceWithinBands,
    parallelBands,
    rsiNeutral,
    macdFlat,
  };
}

function buildParameters(
  window: IndicatorSnapshot[],
  sessionDate: string,
): SidewaysTrendParameters {
  const analysis = buildParameterChecks(window);

  return {
    bollinger: { ...config.bollinger },
    rsi: { period: config.rsi.period },
    macd: { ...config.macd },
    sessionWindow: {
      start: config.sidewaysTrend.sessionStart,
      end: config.sidewaysTrend.sessionEnd,
      timezone: config.sidewaysTrend.timezone,
    },
    candleCountInWindow: window.length,
    avgRsi: analysis.avgRsi,
    avgMacdHistogram: analysis.avgMacdHistogram,
    avgBandWidthPct: analysis.avgBandWidthPct,
    checks: analysis.checks,
  };
}

export function buildSidewaysReasons(state: SidewaysTrendState): string[] {
  const reasons: string[] = [];

  if (state.isSidewaysTrend) {
    reasons.push(
      `Sideways trend in ${state.parameters?.sessionWindow.start ?? "09:15"}–${state.parameters?.sessionWindow.end ?? "12:00"} IST session`,
    );
  }

  for (const check of state.parameters?.checks ?? []) {
    if (check.passed && check.id !== "sessionWindow") {
      reasons.push(`${check.label}: ${check.value}`);
    }
  }

  if (state.nearBbTopRange) {
    reasons.push("Price near BB top range");
  }
  if (state.nearBbBottomRange) {
    reasons.push("Price near BB bottom range");
  }

  return reasons;
}

export interface SidewaysTrendOptions {
  targetDateKey?: string;
}

export function buildSidewaysDebug(
  snapshots: IndicatorSnapshot[],
  options: SidewaysTrendOptions = {},
): SidewaysDebug {
  const usable = snapshots.filter(isUsableSnapshot);
  const targetDateKey =
    options.targetDateKey ??
    (snapshots.length > 0
      ? getIstTimeParts(snapshots[snapshots.length - 1].timestamp).dateKey
      : null);

  return {
    targetDateKey,
    rawSessionCount: selectSessionWindowFrom(snapshots, targetDateKey ?? undefined)
      .length,
    usableSessionCount: selectSessionWindow(usable, targetDateKey ?? undefined)
      .length,
  };
}

export function evaluateSidewaysTrend(
  snapshots: IndicatorSnapshot[],
  options: SidewaysTrendOptions = {},
): SidewaysTrendState | null {
  const usable = snapshots.filter(isUsableSnapshot);
  const window = selectSessionWindow(usable, options.targetDateKey);

  if (window.length < config.sidewaysTrend.minCandlesInWindow) {
    return null;
  }

  const sessionDate = getIstTimeParts(window[0].timestamp).dateKey;
  const upperValues = window.map((snapshot) => snapshot.bollinger.upper);
  const lowerValues = window.map((snapshot) => snapshot.bollinger.lower);
  const bbTopRange = average(upperValues);
  const bbBottomRange = average(lowerValues);
  const parameters = buildParameters(window, sessionDate);
  const analysis = buildParameterChecks(window);

  const isSidewaysTrend =
    analysis.bbTopActive &&
    analysis.bbBottomActive &&
    analysis.parallelBands &&
    analysis.allPriceWithinBands;

  const sessionEndClose = window[window.length - 1].close;
  const topProximityPct =
    (Math.abs(sessionEndClose - bbTopRange) / sessionEndClose) * 100;
  const bottomProximityPct =
    (Math.abs(sessionEndClose - bbBottomRange) / sessionEndClose) * 100;

  const nearBbTopRange =
    isSidewaysTrend &&
    topProximityPct <= config.sidewaysTrend.priceProximityPct;
  const nearBbBottomRange =
    isSidewaysTrend &&
    bottomProximityPct <= config.sidewaysTrend.priceProximityPct;

  return {
    isSidewaysTrend,
    bbTopRange,
    bbBottomRange,
    nearBbTopRange,
    nearBbBottomRange,
    sessionDate,
    parameters,
  };
}
