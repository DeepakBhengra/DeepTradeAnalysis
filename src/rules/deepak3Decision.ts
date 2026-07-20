import { config, type Deepak3DecisionConfig } from "../config.js";
import type {
  Deepak3DayScanEntry,
  Deepak3DecisionResult,
  Deepak3DecisionScan,
  Deepak3TradeSignal,
  DeepakScenarioEvent,
  DeepakTradeSignal,
  IndicatorSnapshot,
} from "../types.js";
import { formatIstTime } from "../utils/marketTime.js";
import {
  attachExits,
  bbLowerMatchType,
  bbUpperMatchType,
  buildReasons,
  buildTradeScenarioMap,
  createDeepakScenarios,
  detectInitialRun,
  filterSessionCandlesForVariant,
  resolveDateKey,
  resolveDecision,
  runBearishPath,
  runBullishPath,
  type DeepakScenarios,
  type DeepakStrategyVariant,
} from "./deepakCore.js";

export interface Deepak3StrategyVariant extends DeepakStrategyVariant {
  id: "deepak3";
  config: Deepak3DecisionConfig;
}

export const DEEPAK3_VARIANT: Deepak3StrategyVariant = {
  id: "deepak3",
  namePrefix: "deepak-3",
  config: config.deepakDecision3,
};

export const DEEPAK3_SCENARIOS = createDeepakScenarios(DEEPAK3_VARIANT.namePrefix);

const GATE_CROSSED_ANCHOR = "G1: crossed anchor";
const GATE_CONTINUE_2 = "G2: continue direction - 2 only";
const GATE_ENTRY_RANGE = "G3: entry candle range >= profit target";
const GATE_SECTOR_BREADTH = "G4: sector breadth";

function isContinueScenario2(
  scenarioKey: string,
  scenarios: DeepakScenarios,
): boolean {
  return (
    scenarioKey === scenarios.CONTINUE_UP_2 ||
    scenarioKey === scenarios.CONTINUE_DOWN_2
  );
}

function anchorAllCrossed(
  anchorCandles: IndicatorSnapshot[],
  mode: "upper" | "lower",
): boolean {
  return anchorCandles.every((candle) => {
    const matchType =
      mode === "lower" ? bbLowerMatchType(candle) : bbUpperMatchType(candle);
    return matchType === "crossed";
  });
}

function passesCrossedAnchorGate(
  deepak3Config: Deepak3DecisionConfig,
  anchor: ReturnType<typeof detectInitialRun>,
  mode: "upper" | "lower",
): boolean {
  if (!deepak3Config.requireCrossedAnchor) {
    return true;
  }
  if (!anchor) {
    return false;
  }
  return anchorAllCrossed(anchor.anchorCandles, mode);
}

function passesContinueOnlyGate(
  deepak3Config: Deepak3DecisionConfig,
  scenarioKey: string,
  scenarios: DeepakScenarios,
): boolean {
  if (!deepak3Config.continueScenariosOnly) {
    return true;
  }
  return isContinueScenario2(scenarioKey, scenarios);
}

function passesEntryRangeGate(
  deepak3Config: Deepak3DecisionConfig,
  entryCandle: IndicatorSnapshot,
  profitTarget: number,
): boolean {
  if (!deepak3Config.requireEntryRangeGteTarget) {
    return true;
  }
  return entryCandle.high - entryCandle.low >= profitTarget;
}

function toDeepak3Signal(
  signal: DeepakTradeSignal,
  confidenceFactors: string[],
): Deepak3TradeSignal {
  return {
    ...signal,
    confidenceFactors,
  };
}

function collectGateFactors(
  deepak3Config: Deepak3DecisionConfig,
  signal: DeepakTradeSignal,
  scenarios: DeepakScenarios,
  bearishAnchor: ReturnType<typeof detectInitialRun>,
  bullishAnchor: ReturnType<typeof detectInitialRun>,
  fromBearishPath: boolean,
): string[] | null {
  const factors: string[] = [];

  const anchor = fromBearishPath ? bearishAnchor : bullishAnchor;
  const anchorMode = fromBearishPath ? "lower" : "upper";

  if (!passesCrossedAnchorGate(deepak3Config, anchor, anchorMode)) {
    return null;
  }
  if (deepak3Config.requireCrossedAnchor) {
    factors.push(GATE_CROSSED_ANCHOR);
  }

  if (!passesContinueOnlyGate(deepak3Config, signal.scenarioKey, scenarios)) {
    return null;
  }
  if (deepak3Config.continueScenariosOnly) {
    factors.push(GATE_CONTINUE_2);
  }

  return factors;
}

function analyzeDayWithDeepak3(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  variant: Deepak3StrategyVariant,
): Deepak3DecisionResult | null {
  const deepak3Config = variant.config;
  const scenarios = createDeepakScenarios(variant.namePrefix);
  const tradeScenarioMap = buildTradeScenarioMap(scenarios);
  const candles = filterSessionCandlesForVariant(snapshots, dateKey, variant);
  if (candles.length === 0) {
    return null;
  }

  const bearish = runBearishPath(candles, scenarios, tradeScenarioMap, variant);
  const bullish = runBullishPath(candles, scenarios, tradeScenarioMap, variant);

  const scenarioTrail: DeepakScenarioEvent[] = [...bearish.trail, ...bullish.trail].sort(
    (left, right) => left.timeIst.localeCompare(right.timeIst),
  );

  const bearishSignalKeys = new Set(
    bearish.signals.map((signal) => `${signal.timeIst}:${signal.scenarioKey}`),
  );

  const preExitSignals: Deepak3TradeSignal[] = [];

  for (const signal of bearish.signals) {
    const gateFactors = collectGateFactors(
      deepak3Config,
      signal,
      scenarios,
      bearish.bearishAnchor,
      bullish.bullishAnchor,
      true,
    );
    if (gateFactors) {
      preExitSignals.push(toDeepak3Signal(signal, gateFactors));
    }
  }

  for (const signal of bullish.signals) {
    if (bearishSignalKeys.has(`${signal.timeIst}:${signal.scenarioKey}`)) {
      continue;
    }
    const gateFactors = collectGateFactors(
      deepak3Config,
      signal,
      scenarios,
      bearish.bearishAnchor,
      bullish.bullishAnchor,
      false,
    );
    if (gateFactors) {
      preExitSignals.push(toDeepak3Signal(signal, gateFactors));
    }
  }

  const candleByTime = new Map(
    candles.map((candle) => [formatIstTime(candle.timestamp), candle]),
  );

  const rawSignals: DeepakTradeSignal[] = preExitSignals.map(({ confidenceFactors: _f, ...signal }) => ({
    ...signal,
  }));
  attachExits(rawSignals, snapshots, dateKey, candleByTime, variant);

  const signals: Deepak3TradeSignal[] = [];

  for (let i = 0; i < preExitSignals.length; i++) {
    const gateFactors = preExitSignals[i].confidenceFactors;
    const signal = rawSignals[i];
    const entryCandle = candleByTime.get(signal.timeIst);
    if (!entryCandle) {
      continue;
    }

    if (
      !passesEntryRangeGate(deepak3Config, entryCandle, signal.profitTarget)
    ) {
      continue;
    }

    const factors = [...gateFactors];
    if (deepak3Config.requireEntryRangeGteTarget) {
      factors.push(GATE_ENTRY_RANGE);
    }

    signals.push(toDeepak3Signal(signal, factors));
  }

  signals.sort((left, right) => left.timeIst.localeCompare(right.timeIst));

  const activeScenario =
    scenarioTrail.length > 0
      ? scenarioTrail[scenarioTrail.length - 1].scenarioKey
      : null;

  const snapshot = candles[candles.length - 1];
  const allFactors = [...new Set(signals.flatMap((signal) => signal.confidenceFactors))];

  return {
    dateKey,
    decision: signals.length > 0 ? resolveDecision(signals) : "HOLD",
    activeScenario,
    scenarioTrail,
    signals,
    reasons: buildReasons(scenarioTrail, signals),
    snapshot,
    confidenceFactors: allFactors,
  };
}

function countSectorSideSignals(
  results: Array<{ sector: string; signals: Deepak3TradeSignal[] }>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const entry of results) {
    for (const signal of entry.signals) {
      const key = `${entry.sector}:${signal.side}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

function filterResultsBySectorBreadth(
  results: Deepak3DecisionResult[],
  sectorBySymbol: Map<string, string>,
  tradingSymbolByResultIndex: string[],
  minSectorBreadth: number,
): Deepak3DecisionResult[] {
  const sectorSignalEntries = results.map((result, index) => ({
    sector: sectorBySymbol.get(tradingSymbolByResultIndex[index]) ?? "",
    signals: result.signals,
  }));

  const sectorSideCounts = countSectorSideSignals(sectorSignalEntries);

  return results.map((result, index) => {
    const sector = sectorBySymbol.get(tradingSymbolByResultIndex[index]) ?? "";
    const filteredSignals = result.signals.filter((signal) => {
      const key = `${sector}:${signal.side}`;
      const count = sectorSideCounts.get(key) ?? 0;
      return count >= minSectorBreadth;
    }).map((signal) => {
      const key = `${sector}:${signal.side}`;
      const count = sectorSideCounts.get(key) ?? 0;
      if (count >= minSectorBreadth && !signal.confidenceFactors.includes(GATE_SECTOR_BREADTH)) {
        return toDeepak3Signal(signal, [
          ...signal.confidenceFactors,
          `${GATE_SECTOR_BREADTH} (${count} in ${sector})`,
        ]);
      }
      return signal;
    });

    const allFactors = [...new Set(filteredSignals.flatMap((s) => s.confidenceFactors))];

    return {
      ...result,
      signals: filteredSignals,
      decision:
        filteredSignals.length > 0 ? resolveDecision(filteredSignals) : "HOLD",
      reasons: buildReasons(result.scenarioTrail, filteredSignals),
      confidenceFactors: allFactors,
    };
  });
}

export function evaluateDeepak3Decision(
  snapshots: IndicatorSnapshot[],
  dateKey?: string,
): Deepak3DecisionResult | null {
  const resolvedDateKey = resolveDateKey(snapshots, dateKey);
  if (!resolvedDateKey) {
    return null;
  }

  return analyzeDayWithDeepak3(snapshots, resolvedDateKey, DEEPAK3_VARIANT);
}

export function scanDeepak3Decisions(
  entries: Array<{
    tradingSymbol: string;
    sector: string;
    snapshots: IndicatorSnapshot[];
  }>,
  dateKey: string,
): Deepak3DecisionScan {
  const { sessionStart, sessionEnd, minSectorBreadth } = DEEPAK3_VARIANT.config;

  const results: Deepak3DecisionResult[] = [];
  const tradingSymbols: string[] = [];
  const sectors: string[] = [];
  const sectorBySymbol = new Map<string, string>();

  for (const entry of entries) {
    sectorBySymbol.set(entry.tradingSymbol, entry.sector);
    const result = analyzeDayWithDeepak3(entry.snapshots, dateKey, DEEPAK3_VARIANT);
    if (result) {
      results.push(result);
      tradingSymbols.push(entry.tradingSymbol);
      sectors.push(entry.sector);
    }
  }

  const filteredResults =
    minSectorBreadth > 1
      ? filterResultsBySectorBreadth(
          results,
          sectorBySymbol,
          tradingSymbols,
          minSectorBreadth,
        )
      : results;

  return {
    dateKey,
    sessionStart,
    sessionEnd,
    results: filteredResults,
    tradingSymbols,
    sectors,
  };
}

export function scanDeepak3DayDecisions(
  entries: Deepak3DayScanEntry[],
  dateKey: string,
): Deepak3DecisionScan {
  return scanDeepak3Decisions(
    entries.map((entry) => ({
      tradingSymbol: entry.tradingSymbol,
      sector: entry.sector,
      snapshots: entry.snapshots,
    })),
    dateKey,
  );
}
