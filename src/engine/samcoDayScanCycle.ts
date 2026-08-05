import { config, resolveDashboardSymbol } from "../config.js";
import { fetchPnbCandles, getLatestClosedCandle } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  evaluateDeepak2Decision,
  evaluateDeepakDecision,
} from "../rules/deepakDecision.js";
import { evaluateDeepak3Decision } from "../rules/deepak3Decision.js";
import { evaluateDeepakWatchPartyDecision } from "../rules/deepakWatchParty.js";
import { evaluateDeepproDecision } from "../rules/deepproDecision.js";
import { evaluateDeeppro1Decision } from "../rules/deeppro1Decision.js";
import {
  getSamcoRuleVariant,
} from "../samco/samcoRuntimeSettings.js";
import {
  strategiesForSamcoRuleVariant,
  type SamcoRuleVariant,
} from "../samco/samcoRuleVariant.js";
import type { SamcoStrategy } from "../samco/signalKeys.js";
import {
  type SectorWatchlistEntry,
} from "../symbols/sectorWatchlist.js";
import { buildSectorRandomizedWatchlist } from "../symbols/sectorWatchlistOrder.js";
import type { DeepakDecisionResult, DeepakTradeSignal, IndicatorSnapshot } from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";
import { formatIstTime, getIstTimeParts } from "../utils/marketTime.js";

const CONCURRENCY = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SamcoStrategyDecision {
  strategy: SamcoStrategy;
  result: Pick<DeepakDecisionResult, "signals">;
}

export interface SamcoSymbolScanResult {
  tradingSymbol: string;
  sector: string;
  exchange: string;
  latestClosedAt?: Date;
  latestCandleTimeIst: string;
  decisions: SamcoStrategyDecision[];
  error?: string;
}

export interface SamcoDayScanCycleResult {
  dateKey: string;
  ruleVariant: SamcoRuleVariant;
  symbols: SamcoSymbolScanResult[];
  errors: Array<{ tradingSymbol: string; sector: string; error: string }>;
}

function adaptSignals(signals: DeepakTradeSignal[]): Pick<DeepakDecisionResult, "signals"> {
  return { signals };
}

function evaluateStrategy(
  strategy: SamcoStrategy,
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): Pick<DeepakDecisionResult, "signals"> | null {
  switch (strategy) {
    case "deepak": {
      const result = evaluateDeepakDecision(snapshots, dateKey);
      return result ? adaptSignals(result.signals) : null;
    }
    case "deepak2": {
      const result = evaluateDeepak2Decision(snapshots, dateKey);
      return result ? adaptSignals(result.signals) : null;
    }
    case "deepak3": {
      const result = evaluateDeepak3Decision(snapshots, dateKey);
      return result ? adaptSignals(result.signals) : null;
    }
    case "watchParty": {
      const result = evaluateDeepakWatchPartyDecision(snapshots, dateKey);
      return result ? adaptSignals(result.signals) : null;
    }
    case "deeppro": {
      const result = evaluateDeepproDecision(snapshots, dateKey);
      return result ? adaptSignals(result.signals) : null;
    }
    case "deeppro1": {
      const result = evaluateDeeppro1Decision(snapshots, dateKey);
      return result ? adaptSignals(result.signals) : null;
    }
  }
}

async function scanSymbol(
  entry: SectorWatchlistEntry,
  dateKey: string,
  strategies: SamcoStrategy[],
): Promise<SamcoSymbolScanResult> {
  const base = {
    tradingSymbol: entry.tradingSymbol,
    sector: entry.sector,
    exchange: config.exchange,
  };

  try {
    const dashboardSymbol = resolveDashboardSymbol(entry.tradingSymbol);
    const candles = await fetchPnbCandles({
      symbol: dashboardSymbol.tradingSymbol,
      exchange: dashboardSymbol.exchange,
      segment: dashboardSymbol.segment,
      fromDate: dateKey,
      toDate: dateKey,
    });

    const latestClosed = getLatestClosedCandle(candles);
    if (!latestClosed) {
      return {
        ...base,
        exchange: dashboardSymbol.exchange,
        latestCandleTimeIst: "",
        decisions: [],
      };
    }

    const closedCandles = candles.filter(
      (candle) => candle.timestamp.getTime() <= latestClosed.timestamp.getTime(),
    );
    const snapshots = buildIndicatorSnapshots(closedCandles);
    const decisions: SamcoStrategyDecision[] = [];

    for (const strategy of strategies) {
      const result = evaluateStrategy(strategy, snapshots, dateKey);
      if (result) {
        decisions.push({ strategy, result });
      }
    }

    return {
      ...base,
      exchange: dashboardSymbol.exchange,
      latestClosedAt: latestClosed.timestamp,
      latestCandleTimeIst: formatIstTime(latestClosed.timestamp),
      decisions,
    };
  } catch (error) {
    return {
      ...base,
      latestCandleTimeIst: "",
      decisions: [],
      error: formatUnknownError(error),
    };
  }
}

export async function runSamcoDayScanCycle(
  dateKey?: string,
  ruleVariant?: SamcoRuleVariant,
): Promise<SamcoDayScanCycleResult> {
  const resolvedDateKey = dateKey ?? getIstTimeParts(new Date()).dateKey;
  const resolvedVariant = ruleVariant ?? getSamcoRuleVariant();
  const strategies = strategiesForSamcoRuleVariant(resolvedVariant);
  const symbols: SamcoSymbolScanResult[] = [];
  const errors: SamcoDayScanCycleResult["errors"] = [];
  const scanOrder = buildSectorRandomizedWatchlist();

  for (let index = 0; index < scanOrder.length; index += CONCURRENCY) {
    const batch = scanOrder.slice(index, index + CONCURRENCY);
    const results = await Promise.all(
      batch.map((entry) => scanSymbol(entry, resolvedDateKey, strategies)),
    );

    for (const result of results) {
      symbols.push(result);
      if (result.error) {
        errors.push({
          tradingSymbol: result.tradingSymbol,
          sector: result.sector,
          error: result.error,
        });
      }
    }

    if (index + CONCURRENCY < scanOrder.length) {
      await delay(config.symbolBatchDelayMs);
    }
  }

  return {
    dateKey: resolvedDateKey,
    ruleVariant: resolvedVariant,
    symbols,
    errors,
  };
}
