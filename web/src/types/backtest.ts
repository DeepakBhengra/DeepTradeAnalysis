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
  bbMatchType: "crossed" | "close";
  exitReason?: DeepakExitReason | null;
  stopLossHit?: boolean;
  deepak2StopScenarioKey?: string | null;
  deepak2StopTimeIst?: string | null;
}

export type DeepakExitReason = "target" | "deepak2_stop";

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

export interface DeepakBacktestPayload {
  symbol: string;
  tradingSymbol: string;
  fromDate: string;
  toDate: string;
  trades: DeepakBacktestTrade[];
  summary: DeepakBacktestSummary;
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
  stopsHit?: number;
}

export interface DeepakDayScanPayload {
  date: string;
  trades: DeepakDayScanTrade[];
  errors: DeepakDayScanError[];
  summary: DeepakDayScanSummary;
  runAt: string;
}

export interface DeepakWatchPartyDayScanTrade extends DeepakDayScanTrade {
  strategy: "deepak-watch-party";
}

export interface DeepakWatchPartyDayScanPayload {
  date: string;
  trades: DeepakWatchPartyDayScanTrade[];
  errors: DeepakDayScanError[];
  summary: DeepakDayScanSummary & { stopsHit: number };
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
  bbMatchType: "crossed" | "close";
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
