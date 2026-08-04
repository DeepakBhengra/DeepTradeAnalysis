export interface Candle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdValues {
  macdLine: number;
  signalLine: number;
  histogram: number;
}

export interface IndicatorSnapshot {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  bollinger: BollingerBands;
  rsi: number;
  macd: MacdValues;
}

export type Decision = "BUY" | "SELL" | "HOLD";

export type VolumeDirection = "bullish" | "bearish" | "neutral";

export interface VolumeSnapshot {
  rvol: number;
  volumeSma: number;
  direction: VolumeDirection;
}

export interface VolumeFlags {
  highRvol: boolean;
  lowRvol: boolean;
  volumeConfirmsBuy: boolean;
  volumeConfirmsSell: boolean;
  volumeDryUp: boolean;
}

export interface DepthLevel {
  price: number;
  orders: number;
  quantity: number;
}

export interface DepthWall {
  price: number;
  quantity: number;
}

export interface DepthSnapshot {
  lastPrice: number;
  buyQuantity: number;
  sellQuantity: number;
  imbalanceRatio: number;
  nearBidQty: number;
  nearAskQty: number;
  spread: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
  strongestBidWall: DepthWall | null;
  strongestAskWall: DepthWall | null;
}

export interface DepthFlags {
  bidDominant: boolean;
  askDominant: boolean;
  tightSpread: boolean;
  bidWallNearPrice: boolean;
  askWallNearPrice: boolean;
}

export type ConfidenceBand = "strong" | "moderate" | "weak" | "avoid";

export interface ConfidenceResult {
  score: number;
  band: ConfidenceBand;
  technicalScore: number;
  volumeScore: number;
  depthScore: number;
  reasons: string[];
}

export interface RuleFlags {
  isTopClose: boolean;
  isBottomClose: boolean;
  isParallel: boolean;
  nearOverbought: boolean;
  nearOversold: boolean;
  bullCross: boolean;
  bearCross: boolean;
  histIncreasing: boolean;
  histDecreasing: boolean;
}

export interface DecisionResult {
  decision: Decision;
  reasons: string[];
  snapshot: IndicatorSnapshot;
  deepak?: DeepakDecisionResult | null;
  deepak2?: DeepakDecisionResult | null;
}

export type DeepakBbMatchType = "crossed" | "close";

export interface DeepakScenarioEvent {
  scenarioKey: string;
  timeIst: string;
  bbMatchType?: DeepakBbMatchType;
}

export type DeepakExitReason = "target" | "deepak2_stop";

export interface DeepakExitSignal {
  timeIst: string;
  price: number;
  targetHit: boolean;
  profit: number | null;
  profitTarget: number;
  exitReason?: DeepakExitReason;
  stopLossHit?: boolean;
  deepak2StopScenarioKey?: string;
}

export interface DeepakTradeSignal {
  side: "BUY" | "SELL";
  scenarioKey: string;
  scenarioNumber: number;
  timeIst: string;
  price: number;
  bbMatchType: DeepakBbMatchType;
  profitTarget: number;
  exit: DeepakExitSignal | null;
}

export interface DeepakDecisionResult {
  dateKey: string;
  decision: Decision;
  activeScenario: string | null;
  scenarioTrail: DeepakScenarioEvent[];
  signals: DeepakTradeSignal[];
  reasons: string[];
  snapshot: IndicatorSnapshot;
}

export interface DeepakDecisionScan {
  dateKey: string;
  sessionStart: string;
  sessionEnd: string;
  results: DeepakDecisionResult[];
}

export interface Deepak3TradeSignal extends DeepakTradeSignal {
  confidenceFactors: string[];
}

export interface Deepak3DecisionResult extends Omit<DeepakDecisionResult, "signals"> {
  signals: Deepak3TradeSignal[];
  confidenceFactors: string[];
}

export interface Deepak3DecisionScan {
  dateKey: string;
  sessionStart: string;
  sessionEnd: string;
  results: Deepak3DecisionResult[];
  tradingSymbols: string[];
  sectors: string[];
}

export interface Deepak3DayScanEntry {
  tradingSymbol: string;
  sector: string;
  snapshots: IndicatorSnapshot[];
}

export type DeepproEventKind =
  | "smi_cross"
  | "stall_at_highs"
  | "stall_at_lows"
  | "smi_exit_overbought"
  | "smi_exit_oversold"
  | "macd_bear_cross"
  | "macd_bull_cross";

export interface DeepproBbProximity {
  /** Absolute gap % between price extreme and band (of close) */
  gapPct: number;
  /** Signed gap %: positive = outside/beyond band, negative = inside */
  signedGapPct: number;
  matchType: "crossed" | "close" | null;
  price: number;
  bbLevel: number;
}

export interface DeepproSignal {
  side: "BUY" | "SELL";
  rule: "deeppro";
  dateKey: string;
  /** SMI cross candle time (IST) */
  timeIst: string;
  /** Nearby chart-event time (stall / OB-OS exit / MACD cross) */
  eventTimeIst: string;
  eventKind: DeepproEventKind;
  price: number;
  smi: number;
  smiSignal: number;
  /** Peak SMI (SELL) or trough SMI (BUY, most negative) in lookback */
  peakSmi: number;
  /** RSI at SMI cross candle */
  rsi: number;
  /** RSI at event candle */
  eventRsi: number;
  /** BB upper proximity at event candle (high vs upper) */
  bbUpperProximity: DeepproBbProximity;
  /** BB lower proximity at event candle (low vs lower) */
  bbLowerProximity: DeepproBbProximity;
  macdHistogram: number;
  reasons: string[];
}

export interface DeepproScanResult {
  dateKey: string;
  rule: "deeppro";
  sessionStart: string;
  sessionEnd: string;
  signals: DeepproSignal[];
}

/** RulePNB scenario keys from PNB favourable profit-range study. */
export type RulePnbScenarioKey =
  | "buy_quality"
  | "sell_quality"
  | "buy_extended"
  | "sell_cascade";

export interface RulePnbSignal {
  side: "BUY" | "SELL";
  rule: "rulePnb";
  dateKey: string;
  timeIst: string;
  scenarioKey: RulePnbScenarioKey;
  /** Candle mid (high+low)/2 */
  price: number;
  smi: number;
  rsi: number;
  bbUpperProximity: DeepproBbProximity;
  bbLowerProximity: DeepproBbProximity;
  reasons: string[];
}

export interface RulePnbScanResult {
  dateKey: string;
  rule: "rulePnb";
  sessionStart: string;
  sessionEnd: string;
  signals: RulePnbSignal[];
}

/** RuleSUNPHARMA scenario keys from SUNPHARMA favourable profit-range study. */
export type RuleSunpharmaScenarioKey =
  | "buy_quality"
  | "sell_quality"
  | "buy_extended"
  | "sell_cascade";

export interface RuleSunpharmaSignal {
  side: "BUY" | "SELL";
  rule: "ruleSunpharma";
  dateKey: string;
  timeIst: string;
  scenarioKey: RuleSunpharmaScenarioKey;
  /** Candle mid (high+low)/2 */
  price: number;
  smi: number;
  rsi: number;
  bbUpperProximity: DeepproBbProximity;
  bbLowerProximity: DeepproBbProximity;
  reasons: string[];
}

export interface RuleSunpharmaScanResult {
  dateKey: string;
  rule: "ruleSunpharma";
  sessionStart: string;
  sessionEnd: string;
  signals: RuleSunpharmaSignal[];
}

/** Per-symbol favourable profit-range rules (LTM / ICICIGI / TECHM / TVSMOTOR / POLICYBZR). */
export type FavourableSymbolRuleId =
  | "ruleLtm"
  | "ruleIcicigi"
  | "ruleTechm"
  | "ruleTvsmotor"
  | "rulePolicybzr";

export type FavourableSymbolScenarioKey =
  | "buy_quality"
  | "sell_quality"
  | "buy_extended"
  | "sell_cascade";

export interface FavourableSymbolSignal {
  side: "BUY" | "SELL";
  rule: FavourableSymbolRuleId;
  dateKey: string;
  timeIst: string;
  scenarioKey: FavourableSymbolScenarioKey;
  /** Candle mid (high+low)/2 */
  price: number;
  smi: number;
  rsi: number;
  bbUpperProximity: DeepproBbProximity;
  bbLowerProximity: DeepproBbProximity;
  reasons: string[];
}

export interface FavourableSymbolScanResult {
  dateKey: string;
  rule: FavourableSymbolRuleId;
  sessionStart: string;
  sessionEnd: string;
  signals: FavourableSymbolSignal[];
}

export interface ParameterCheckCandleRef {
  timeIst: string;
  intervalLabel: string;
  high: number;
  low: number;
  close: number;
  candleColor: "green" | "red";
}

export interface SidewaysParameterCheck {
  id: string;
  label: string;
  passed: boolean;
  value: string;
  threshold: string;
  candleRef?: ParameterCheckCandleRef;
  matchType?: "close" | "crossed";
  gapPct?: number;
}

export interface SidewaysTrendParameters {
  bollinger: {
    length: number;
    stdDev: number;
    maType: "SMA";
    field: "close";
  };
  rsi: { period: number };
  macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
  sessionWindow: {
    start: string;
    end: string;
    timezone: string;
  };
  candleCountInWindow: number;
  avgRsi: number | null;
  avgMacdHistogram: number | null;
  avgBandWidthPct: number | null;
  checks: SidewaysParameterCheck[];
}

export interface SidewaysTrendState {
  isSidewaysTrend: boolean;
  bbTopRange: number | null;
  bbBottomRange: number | null;
  nearBbTopRange: boolean;
  nearBbBottomRange: boolean;
  sessionDate: string | null;
  parameters: SidewaysTrendParameters | null;
}

export interface SidewaysDebug {
  targetDateKey: string | null;
  rawSessionCount: number;
  usableSessionCount: number;
}

export interface BbProximityMatch {
  timeIst: string;
  intervalLabel: string;
  price: number;
  bbLevel: number;
  gapPct: number;
  matchType: "close" | "crossed";
  isSessionExtreme: boolean;
  candleColor: "green" | "red";
  high: number;
  low: number;
  bbUpper: number;
  bbLower: number;
}

export interface BbProximityReport {
  dateKey: string;
  thresholdPct: number;
  topMatches: BbProximityMatch[];
  bottomMatches: BbProximityMatch[];
}

export interface DeepakBacktestTrade {
  date: string;
  side: "BUY" | "SELL";
  scenarioNumber: number;
  scenarioKey: string;
  entryTimeIst: string;
  entryPrice: number;
  exitTimeIst: string | null;
  exitPrice: number | null;
  targetHit: boolean;
  profit: number | null;
  profitTarget: number;
  bbMatchType: DeepakBbMatchType;
}

export interface DeepakBacktestSummary {
  tradingDaysScanned: number;
  dateRange: { from: string | null; to: string | null };
  totalSignals: number;
  buyCount: number;
  sellCount: number;
  targetsHit: number;
  targetsMissed: number;
  avgProfit: number | null;
}

export interface DeepakBacktestResult {
  trades: DeepakBacktestTrade[];
  summary: DeepakBacktestSummary;
}

export interface DeepakBacktestPayload {
  symbol: string;
  tradingSymbol: string;
  fromDate: string;
  toDate: string;
  trades: DeepakBacktestTrade[];
  summary: DeepakBacktestSummary;
  runAt: string;
}

export interface DeepakWatchPartyBacktestTrade extends DeepakBacktestTrade {
  exitReason: DeepakExitReason | null;
  stopLossHit: boolean;
  deepak2StopScenarioKey: string | null;
  deepak2StopTimeIst: string | null;
}

export interface DeepakWatchPartyBacktestSummary extends DeepakBacktestSummary {
  stopsHit: number;
}

export interface DeepakWatchPartyBacktestResult {
  trades: DeepakWatchPartyBacktestTrade[];
  summary: DeepakWatchPartyBacktestSummary;
}

export interface DeepakWatchPartyBacktestPayload {
  symbol: string;
  tradingSymbol: string;
  fromDate: string;
  toDate: string;
  trades: DeepakWatchPartyBacktestTrade[];
  summary: DeepakWatchPartyBacktestSummary;
  runAt: string;
}

export interface DeepakWatchPartyDayScanTrade extends DeepakWatchPartyBacktestTrade {
  symbol: string;
  tradingSymbol: string;
  sector: string;
  strategy: "deepak-watch-party";
}

export interface DeepakWatchPartyDayScanSummary extends DeepakDayScanSummary {
  stopsHit: number;
}

export interface DeepakWatchPartyDayScanPayload {
  date: string;
  trades: DeepakWatchPartyDayScanTrade[];
  errors: DeepakDayScanError[];
  summary: DeepakWatchPartyDayScanSummary;
  runAt: string;
}

export interface DeepakDayScanTrade extends DeepakBacktestTrade {
  symbol: string;
  tradingSymbol: string;
  sector: string;
  confidenceFactors?: string[];
}

export interface DeepakDayScanError {
  tradingSymbol: string;
  sector: string;
  error: string;
}

export interface DeepakDayScanSummary {
  stocksScanned: number;
  stocksWithSignals: number;
  totalSignals: number;
  buyCount: number;
  sellCount: number;
  targetsHit: number;
  targetsMissed: number;
  avgProfit: number | null;
  errorCount: number;
}

export interface DeepakDayScanPayload {
  date: string;
  trades: DeepakDayScanTrade[];
  errors: DeepakDayScanError[];
  summary: DeepakDayScanSummary;
  runAt: string;
}

export type DayScanStrategy = "deepak" | "deepak-2" | "deepak-watch-party";

export interface DayScanSimulationSignal extends DeepakDayScanTrade {
  strategy: DayScanStrategy;
  exitReason?: DeepakExitReason | null;
  stopLossHit?: boolean;
}

export interface DayScanSimulationExit {
  date: string;
  strategy: DayScanStrategy;
  side: "BUY" | "SELL";
  scenarioNumber: number;
  scenarioKey: string;
  tradingSymbol: string;
  symbol: string;
  sector: string;
  entryTimeIst: string;
  entryPrice: number;
  exitTimeIst: string;
  exitPrice: number;
  targetHit: boolean;
  profit: number | null;
  profitTarget: number;
  bbMatchType: DeepakBbMatchType;
  exitReason: DeepakExitReason | null;
  stopLossHit: boolean;
}

export interface DayScanSimulationSummary {
  stocksScanned: number;
  stocksWithSignals: number;
  entryCount: number;
  exitCount: number;
  openPositions: number;
  buyCount: number;
  sellCount: number;
  targetsHit: number;
  stopsHit: number;
  avgProfit: number | null;
  errorCount: number;
}

export interface DayScanSimulationPayload {
  date: string;
  simulation: {
    sessionIndex: number;
    sessionCandleCount: number;
    simulatedTimeIst: string;
  };
  entries: DayScanSimulationSignal[];
  exits: DayScanSimulationExit[];
  errors: DeepakDayScanError[];
  summary: DayScanSimulationSummary;
}
