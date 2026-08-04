import type { Decision } from "./dashboard";

export type DeepakBbMatchType = "crossed" | "close";

export interface DeepakScenarioEvent {
  scenarioKey: string;
  timeIst: string;
  bbMatchType?: DeepakBbMatchType;
}

export interface DeepakExitSignal {
  timeIst: string;
  price: number;
  targetHit: boolean;
  profit: number | null;
  profitTarget: number;
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
}

export type VolumeDirection = "bullish" | "bearish" | "neutral";

export interface VolumeFlags {
  highRvol: boolean;
  lowRvol: boolean;
  volumeConfirmsBuy: boolean;
  volumeConfirmsSell: boolean;
  volumeDryUp: boolean;
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

export interface SimulationMeta {
  sessionIndex: number;
  sessionCandleCount: number;
  simulatedTimeIst: string;
}

export type Decision = "BUY" | "SELL" | "HOLD";

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
  deeppro1Decision: DeepakDecisionResult | null;
  rulePnbDecision: DeepakDecisionResult | null;
  ruleSunpharmaDecision: DeepakDecisionResult | null;
  favourableSymbolDecision: DeepakDecisionResult | null;
  favourableSymbolRuleId:
    | "ruleLtm"
    | "ruleIcicigi"
    | "ruleTechm"
    | "ruleTvsmotor"
    | "rulePolicybzr"
    | null;
  analysisDate: string | null;
  mode: "live" | "historical" | "simulation";
  simulation?: SimulationMeta;
  series: DashboardSeriesPoint[];
}
