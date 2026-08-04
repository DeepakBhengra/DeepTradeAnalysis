import {
  config,
  getDashboardSymbol,
  resolveDashboardSymbol,
  type DashboardSymbolConfig,
  type DashboardSymbolId,
} from "../config.js";
import { fetchPnbCandles, getLatestClosedCandle } from "../data/pnbFeed.js";
import { fetchPnbQuote } from "../data/quoteFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import { buildVolumeSnapshots } from "../indicators/volume.js";
import { computeConfidenceScore } from "../rules/confidenceScore.js";
import { evaluateDeepakDecision, evaluateDeepak2Decision } from "../rules/deepakDecision.js";
import { evaluateDeepproDecision } from "../rules/deepproDecision.js";
import {
  evaluateRulePnbDecision,
  isRulePnbSymbol,
} from "../rules/rulePnbDecision.js";
import {
  evaluateRuleSunpharmaDecision,
  isRuleSunpharmaSymbol,
} from "../rules/ruleSunpharmaDecision.js";
import {
  evaluateFavourableSymbolDecision,
  favourableSymbolRuleIdForTradingSymbol,
} from "../rules/favourableSymbolRule.js";
import { evaluateDepthAnalysis } from "../rules/depthAnalysis.js";
import {
  buildSidewaysDebug,
  buildSidewaysReasons,
  evaluateSidewaysTrend,
} from "../rules/sidewaysTrend.js";
import {
  buildBbProximityReasons,
  scanBbProximity,
} from "../rules/bbProximityScan.js";
import { evaluateVolumeAnalysis } from "../rules/volumeAnalysis.js";
import type {
  BbProximityReport,
  Candle,
  ConfidenceResult,
  Decision,
  DeepakDecisionResult,
  DepthSnapshot,
  FavourableSymbolRuleId,
  SidewaysDebug,
  SidewaysTrendState,
  VolumeFlags,
} from "../types.js";
import {
  getIstTimeParts,
  isWithinAnalysisDayDisplay,
} from "../utils/marketTime.js";

export interface DashboardSeriesPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  relVolume: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  rsi: number | null;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export interface DashboardPayload {
  symbol: string;
  interval: "15m";
  updatedAt: string;
  latestClosedAt: string | null;
  candleCount: number;
  decision: Decision;
  reasons: string[];
  close: number | null;
  confidence: ConfidenceResult | null;
  volumeFlags: VolumeFlags | null;
  depth: DepthSnapshot | null;
  sidewaysTrend: SidewaysTrendState | null;
  sidewaysDebug: SidewaysDebug | null;
  bbProximity: BbProximityReport | null;
  deepakDecision: DeepakDecisionResult | null;
  deepak2Decision: DeepakDecisionResult | null;
  deepproDecision: DeepakDecisionResult | null;
  rulePnbDecision: DeepakDecisionResult | null;
  ruleSunpharmaDecision: DeepakDecisionResult | null;
  /** Populated only when the dashboard symbol matches a per-symbol favourable rule. */
  favourableSymbolDecision: DeepakDecisionResult | null;
  favourableSymbolRuleId: FavourableSymbolRuleId | null;
  analysisDate: string | null;
  mode: "live" | "historical" | "simulation";
  series: DashboardSeriesPoint[];
}

function toFiniteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function buildSeries(
  candles: Candle[],
  snapshots: ReturnType<typeof buildIndicatorSnapshots>,
): DashboardSeriesPoint[] {
  const volumeSnapshots = buildVolumeSnapshots(candles);

  return candles.map((candle, index) => {
    const snapshot = snapshots[index];
    const volumeSnapshot = volumeSnapshots[index];
    const rvol = volumeSnapshot.rvol;

    return {
      time: Math.floor(candle.timestamp.getTime() / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      relVolume: Number.isFinite(rvol) ? rvol : null,
      bbUpper: toFiniteOrNull(snapshot.bollinger.upper),
      bbMiddle: toFiniteOrNull(snapshot.bollinger.middle),
      bbLower: toFiniteOrNull(snapshot.bollinger.lower),
      rsi: toFiniteOrNull(snapshot.rsi),
      macd: toFiniteOrNull(snapshot.macd.macdLine),
      signal: toFiniteOrNull(snapshot.macd.signalLine),
      histogram: toFiniteOrNull(snapshot.macd.histogram),
    };
  });
}

function buildFilteredSeries(
  candles: Candle[],
  snapshots: ReturnType<typeof buildIndicatorSnapshots>,
  analysisDate: string | null,
): DashboardSeriesPoint[] {
  const series = buildSeries(candles, snapshots);

  if (!analysisDate) {
    return series;
  }

  return series.filter((_, index) =>
    isWithinAnalysisDayDisplay(candles[index].timestamp, analysisDate),
  );
}

function resolveTargetDateKey(
  analysisDate: string | undefined,
  candles: Candle[],
): string | undefined {
  if (analysisDate) {
    return analysisDate;
  }

  if (candles.length === 0) {
    return undefined;
  }

  return getIstTimeParts(candles[candles.length - 1].timestamp).dateKey;
}

function emptyPayload(
  dashboardSymbol: DashboardSymbolConfig,
  mode: "live" | "historical" | "simulation",
  analysisDate: string | null,
  updatedAt: string,
  overrides: Partial<DashboardPayload> = {},
): DashboardPayload {
  return {
    symbol: dashboardSymbol.symbol,
    interval: config.interval,
    updatedAt,
    latestClosedAt: null,
    candleCount: 0,
    decision: "HOLD",
    reasons: [],
    close: null,
    confidence: null,
    volumeFlags: null,
    depth: null,
    sidewaysTrend: null,
    sidewaysDebug: null,
    bbProximity: null,
    deepakDecision: null,
    deepak2Decision: null,
    deepproDecision: null,
    rulePnbDecision: null,
    ruleSunpharmaDecision: null,
    favourableSymbolDecision: null,
    favourableSymbolRuleId: null,
    analysisDate,
    mode,
    series: [],
    ...overrides,
  };
}

function buildPayloadFromCandles(input: {
  candles: Candle[];
  analysisDate?: string;
  latestClosedAt?: Date;
  depth?: DepthSnapshot | null;
  dashboardSymbol: DashboardSymbolConfig;
}): DashboardPayload {
  const { candles, analysisDate, latestClosedAt, depth = null, dashboardSymbol } = input;
  const mode = analysisDate ? "historical" : "live";
  const updatedAt = new Date().toISOString();

  if (candles.length === 0) {
    return emptyPayload(dashboardSymbol, mode, analysisDate ?? null, updatedAt);
  }

  const snapshots = buildIndicatorSnapshots(candles);
  const targetDateKey = resolveTargetDateKey(analysisDate, candles);
  const deepakDecision =
    targetDateKey != null
      ? evaluateDeepakDecision(snapshots, targetDateKey)
      : null;
  const deepak2Decision =
    targetDateKey != null
      ? evaluateDeepak2Decision(snapshots, targetDateKey)
      : null;
  const deepproDecision =
    targetDateKey != null ? evaluateDeepproDecision(snapshots, targetDateKey) : null;
  // RulePNB is PNB-only and never mixes into Deepak/Deeppro reasons or decision.
  const rulePnbDecision =
    targetDateKey != null && isRulePnbSymbol(dashboardSymbol.tradingSymbol)
      ? evaluateRulePnbDecision(snapshots, targetDateKey)
      : null;
  // RuleSUNPHARMA is SUNPHARMA-only and never mixes into shared reasons/decision.
  const ruleSunpharmaDecision =
    targetDateKey != null && isRuleSunpharmaSymbol(dashboardSymbol.tradingSymbol)
      ? evaluateRuleSunpharmaDecision(snapshots, targetDateKey)
      : null;
  // Per-symbol favourable rules (LTM/ICICIGI/TECHM/TVSMOTOR/POLICYBZR) — never mixed.
  const favourableSymbolRuleId = favourableSymbolRuleIdForTradingSymbol(
    dashboardSymbol.tradingSymbol,
  );
  const favourableSymbolDecision =
    targetDateKey != null && favourableSymbolRuleId != null
      ? evaluateFavourableSymbolDecision(
          favourableSymbolRuleId,
          snapshots,
          targetDateKey,
        )
      : null;
  const volumeAnalysis = evaluateVolumeAnalysis(candles);
  const sidewaysTrend = evaluateSidewaysTrend(snapshots, { targetDateKey });
  const sidewaysDebug = buildSidewaysDebug(snapshots, { targetDateKey });
  const sidewaysReasons = sidewaysTrend ? buildSidewaysReasons(sidewaysTrend) : [];
  const bbProximity =
    targetDateKey != null ? scanBbProximity(snapshots, targetDateKey) : null;
  const bbProximityReasons = buildBbProximityReasons(bbProximity);
  const series = buildFilteredSeries(candles, snapshots, analysisDate ?? null);

  const decision = deepakDecision?.decision ?? "HOLD";

  const depthAnalysis =
    depth != null
      ? evaluateDepthAnalysis({
          lastPrice: depth.lastPrice,
          buyQuantity: depth.buyQuantity,
          sellQuantity: depth.sellQuantity,
          bids: depth.bids,
          asks: depth.asks,
        })
      : null;

  const confidence =
    volumeAnalysis != null
      ? computeConfidenceScore({
          decision,
          deepakSignals: deepakDecision?.signals,
          volumeFlags: volumeAnalysis.flags,
          volumeSnapshot: volumeAnalysis.snapshot,
          depthFlags: depthAnalysis?.flags ?? null,
          mode,
        })
      : null;

  const volumeReasons = volumeAnalysis?.reasons ?? [];
  const depthReasons = depthAnalysis?.reasons ?? [];
  const confidenceReasons = confidence?.reasons ?? [];
  const deepakReasons = deepakDecision?.reasons ?? [];
  const deepak2Reasons =
    deepak2Decision?.reasons.map((reason) => `[Deepak-2] ${reason}`) ?? [];
  const deepproReasons =
    deepproDecision?.reasons.map((reason) => `[Deeppro] ${reason}`) ?? [];

  const referenceCandle =
    analysisDate && series.length > 0
      ? candles.find(
          (candle) =>
            Math.floor(candle.timestamp.getTime() / 1000) ===
            series[series.length - 1].time,
        ) ?? candles[candles.length - 1]
      : candles[candles.length - 1];

  return {
    symbol: dashboardSymbol.symbol,
    interval: config.interval,
    updatedAt,
    latestClosedAt:
      latestClosedAt?.toISOString() ?? referenceCandle.timestamp.toISOString(),
    candleCount: series.length,
    decision,
    reasons: [
      ...deepakReasons,
      ...deepak2Reasons,
      ...deepproReasons,
      ...volumeReasons,
      ...depthReasons,
      ...confidenceReasons,
      ...sidewaysReasons,
      ...bbProximityReasons,
    ],
    close: deepakDecision?.snapshot.close ?? referenceCandle.close,
    confidence,
    volumeFlags: volumeAnalysis?.flags ?? null,
    depth: mode === "live" ? depth : null,
    sidewaysTrend,
    sidewaysDebug,
    bbProximity,
    deepakDecision,
    deepak2Decision,
    deepproDecision,
    rulePnbDecision,
    ruleSunpharmaDecision,
    favourableSymbolDecision,
    favourableSymbolRuleId,
    analysisDate: analysisDate ?? null,
    mode,
    series,
  };
}

export async function buildDashboardPayload(options?: {
  analysisDate?: string;
  dashboardId?: DashboardSymbolId;
  dashboardSymbol?: DashboardSymbolConfig;
}): Promise<DashboardPayload> {
  const dashboardSymbol =
    options?.dashboardSymbol ??
    getDashboardSymbol(options?.dashboardId);
  const analysisDate = options?.analysisDate;
  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    analysisDate,
  });
  const updatedAt = new Date().toISOString();

  if (candles.length === 0) {
    return emptyPayload(
      dashboardSymbol,
      analysisDate ? "historical" : "live",
      analysisDate ?? null,
      updatedAt,
    );
  }

  if (analysisDate) {
    return buildPayloadFromCandles({ candles, analysisDate, dashboardSymbol });
  }

  const latestClosed = getLatestClosedCandle(candles);
  if (!latestClosed) {
    return emptyPayload(dashboardSymbol, "live", null, updatedAt, {
      candleCount: candles.length,
    });
  }

  const closedCandles = candles.filter(
    (candle) => candle.timestamp.getTime() <= latestClosed.timestamp.getTime(),
  );

  let depth: DepthSnapshot | null = null;
  try {
    const quote = await fetchPnbQuote(dashboardSymbol.symbol);
    if (quote) {
      depth = evaluateDepthAnalysis(quote).snapshot;
    }
  } catch {
    depth = null;
  }

  return buildPayloadFromCandles({
    candles: closedCandles,
    latestClosedAt: latestClosed.timestamp,
    depth,
    dashboardSymbol,
  });
}

export function buildDashboardPayloadFromData(input: {
  candles: Candle[];
  latestClosedAt?: Date;
  analysisDate?: string;
  depth?: DepthSnapshot | null;
  dashboardId?: DashboardSymbolId;
  dashboardSymbol?: DashboardSymbolConfig;
}): DashboardPayload {
  const dashboardSymbol =
    input.dashboardSymbol ?? getDashboardSymbol(input.dashboardId);
  return buildPayloadFromCandles({ ...input, dashboardSymbol });
}
