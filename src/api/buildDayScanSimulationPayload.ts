import { DAY_SCAN_SIMULATION } from "../config.js";
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
  evaluateFavourableSymbolDecision,
} from "../rules/favourableSymbolRule.js";
import {
  evaluateRulePnbDecision,
  isRulePnbSymbol,
} from "../rules/rulePnbDecision.js";
import {
  evaluateRuleSunpharmaDecision,
  isRuleSunpharmaSymbol,
} from "../rules/ruleSunpharmaDecision.js";
import {
  getSectorRank,
  type SectorName,
  type SectorWatchlistEntry,
} from "../symbols/sectorWatchlist.js";
import type {
  DayScanSimulationExit,
  DayScanSimulationMark,
  DayScanSimulationPayload,
  DayScanSimulationSignal,
  DayScanSimulationSummary,
  DayScanStrategy,
  DeepakDayScanError,
  DeepakTradeSignal,
} from "../types.js";
import { formatIstTime, getIstTimeParts, isValidAnalysisDate } from "../utils/marketTime.js";
import { candleMidPrice } from "../utils/sessionMarkPrice.js";
import { applyStopLossToDayScanSimulationPayload } from "../utils/dayScanStopLoss.js";
import { getSamcoProfitPct, getSamcoStopLossPct } from "../samco/samcoRuntimeSettings.js";
import { validateDayScanDate } from "./buildDeepakDayScanPayload.js";
import {
  DayScanSimulationCache,
  truncateDayScanCandlesForIndex,
} from "./dayScanSimulationCache.js";
import {
  dayScanStrategyForVariant,
  isFavourableSimulationVariant,
  parseDayScanSimulationVariant,
  watchlistForSimulationVariant,
  type DayScanSimulationRuleVariant,
  type DayScanSimulationVariant,
} from "./dayScanSimulationVariant.js";

function signalToSimulationSignal(
  date: string,
  signal: DeepakTradeSignal,
  strategy: DayScanStrategy,
  entry: SectorWatchlistEntry,
  symbolLabel: string,
): DayScanSimulationSignal {
  const exitReason =
    signal.exit?.exitReason ??
    (signal.exit?.targetHit ? "target" : null);
  const stopLossHit = signal.exit?.stopLossHit ?? false;

  return {
    date,
    strategy,
    side: signal.side,
    scenarioNumber: signal.scenarioNumber,
    scenarioKey: signal.scenarioKey,
    entryTimeIst: signal.timeIst,
    entryPrice: signal.price,
    exitTimeIst: signal.exit?.timeIst ?? null,
    exitPrice: signal.exit?.price ?? null,
    targetHit: signal.exit?.targetHit ?? false,
    profit: signal.exit?.profit ?? null,
    profitTarget: signal.profitTarget,
    bbMatchType: signal.bbMatchType,
    symbol: symbolLabel,
    tradingSymbol: entry.tradingSymbol,
    sector: entry.sector,
    exitReason,
    stopLossHit,
  };
}

function compareIstTime(left: string, right: string): number {
  return left.localeCompare(right);
}

function isTimeAtOrBefore(time: string, simulatedTimeIst: string): boolean {
  return compareIstTime(time, simulatedTimeIst) <= 0;
}

function sortSignals(signals: DayScanSimulationSignal[]): DayScanSimulationSignal[] {
  return [...signals].sort((left, right) => {
    const timeDiff = compareIstTime(left.entryTimeIst, right.entryTimeIst);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    const sectorDiff =
      getSectorRank(left.sector as SectorName) -
      getSectorRank(right.sector as SectorName);
    if (sectorDiff !== 0) {
      return sectorDiff;
    }
    const symbolDiff = left.tradingSymbol.localeCompare(right.tradingSymbol);
    if (symbolDiff !== 0) {
      return symbolDiff;
    }
    return left.strategy.localeCompare(right.strategy);
  });
}

function sortExits(exits: DayScanSimulationExit[]): DayScanSimulationExit[] {
  return [...exits].sort((left, right) => {
    const timeDiff = compareIstTime(left.exitTimeIst, right.exitTimeIst);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    const sectorDiff =
      getSectorRank(left.sector as SectorName) -
      getSectorRank(right.sector as SectorName);
    if (sectorDiff !== 0) {
      return sectorDiff;
    }
    return left.tradingSymbol.localeCompare(right.tradingSymbol);
  });
}

function buildSummary(
  entries: DayScanSimulationSignal[],
  exits: DayScanSimulationExit[],
  errors: DeepakDayScanError[],
  stocksScanned: number,
): DayScanSimulationSummary {
  const profits = exits
    .map((trade) => trade.profit)
    .filter((profit): profit is number => profit != null && Number.isFinite(profit));

  return {
    stocksScanned,
    stocksWithSignals: new Set(entries.map((entry) => entry.tradingSymbol)).size,
    entryCount: entries.length,
    exitCount: exits.length,
    openPositions: entries.length - exits.length,
    buyCount: entries.filter((entry) => entry.side === "BUY").length,
    sellCount: entries.filter((entry) => entry.side === "SELL").length,
    targetsHit: exits.filter((exit) => exit.targetHit).length,
    stopsHit: exits.filter((exit) => exit.stopLossHit).length,
    avgProfit:
      profits.length > 0
        ? profits.reduce((sum, profit) => sum + profit, 0) / profits.length
        : null,
    errorCount: errors.length,
  };
}

function appendDecisionSignals(
  signals: DayScanSimulationSignal[],
  decision: { signals: DeepakTradeSignal[] } | null,
  date: string,
  strategy: DayScanStrategy,
  entry: SectorWatchlistEntry,
  symbolLabel: string,
): void {
  if (!decision) {
    return;
  }
  for (const signal of decision.signals) {
    signals.push(
      signalToSimulationSignal(date, signal, strategy, entry, symbolLabel),
    );
  }
}

function evaluateRuleVariant(
  variant: DayScanSimulationRuleVariant,
  snapshots: ReturnType<typeof buildIndicatorSnapshots>,
  date: string,
  tradingSymbol: string,
): { signals: DeepakTradeSignal[] } | null {
  switch (variant) {
    case "deepak2":
      return evaluateDeepak2Decision(snapshots, date);
    case "deepak3":
      return evaluateDeepak3Decision(snapshots, date);
    case "watchParty":
      return evaluateDeepakWatchPartyDecision(snapshots, date);
    case "deeppro":
      return evaluateDeepproDecision(snapshots, date);
    case "deeppro1":
      return evaluateDeeppro1Decision(snapshots, date, {
        squareOffPct: getSamcoProfitPct(),
      });
    case "rulePnb":
      return isRulePnbSymbol(tradingSymbol)
        ? evaluateRulePnbDecision(snapshots, date)
        : null;
    case "ruleSunpharma":
      return isRuleSunpharmaSymbol(tradingSymbol)
        ? evaluateRuleSunpharmaDecision(snapshots, date)
        : null;
    case "ruleLtm":
    case "ruleIcicigi":
    case "ruleTechm":
    case "ruleTvsmotor":
    case "rulePolicybzr":
      return isFavourableSimulationVariant(variant)
        ? evaluateFavourableSymbolDecision(variant, snapshots, date)
        : null;
    case "deepak":
    default:
      return evaluateDeepakDecision(snapshots, date);
  }
}

function evaluateSymbolAtIndex(
  entry: SectorWatchlistEntry,
  date: string,
  sessionIndex: number,
  cache: DayScanSimulationCache,
  variant: DayScanSimulationVariant,
): { signals: DayScanSimulationSignal[]; error: DeepakDayScanError | null } {
  const candles = cache.getCandles(date, entry.tradingSymbol);
  const fetchError = cache.getSymbolError(date, entry.tradingSymbol);

  if (fetchError) {
    return {
      signals: [],
      error: {
        tradingSymbol: entry.tradingSymbol,
        sector: entry.sector,
        error: fetchError,
      },
    };
  }

  if (!candles || candles.length === 0) {
    return {
      signals: [],
      error: {
        tradingSymbol: entry.tradingSymbol,
        sector: entry.sector,
        error: "No candle data available.",
      },
    };
  }

  const sessionCandles = cache.getSessionCandlesForSymbol(date, entry.tradingSymbol);
  const truncated = truncateDayScanCandlesForIndex(
    candles,
    date,
    sessionIndex,
    sessionCandles,
  );
  const snapshots = buildIndicatorSnapshots(truncated);
  const dashboardSymbol = cache.getResolvedSymbol(date, entry.tradingSymbol);

  if (!dashboardSymbol) {
    return {
      signals: [],
      error: {
        tradingSymbol: entry.tradingSymbol,
        sector: entry.sector,
        error: "Symbol metadata unavailable.",
      },
    };
  }

  const signals: DayScanSimulationSignal[] = [];

  if (variant === "all") {
    appendDecisionSignals(
      signals,
      evaluateDeepakDecision(snapshots, date),
      date,
      "deepak",
      entry,
      dashboardSymbol.symbol,
    );
    appendDecisionSignals(
      signals,
      evaluateDeepak2Decision(snapshots, date),
      date,
      "deepak-2",
      entry,
      dashboardSymbol.symbol,
    );
    appendDecisionSignals(
      signals,
      evaluateDeepakWatchPartyDecision(snapshots, date),
      date,
      "deepak-watch-party",
      entry,
      dashboardSymbol.symbol,
    );
  } else {
    appendDecisionSignals(
      signals,
      evaluateRuleVariant(variant, snapshots, date, entry.tradingSymbol),
      date,
      dayScanStrategyForVariant(variant),
      entry,
      dashboardSymbol.symbol,
    );
  }

  return { signals, error: null };
}

async function computeDayScanSimulationFrame(input: {
  date: string;
  sessionIndex: number;
  cache: DayScanSimulationCache;
  variant: DayScanSimulationVariant;
}): Promise<DayScanSimulationPayload> {
  const { date, sessionIndex, cache, variant } = input;
  const sessionCandleCount = cache.getSessionCandleCount(date);
  const watchlist = watchlistForSimulationVariant(variant);

  const referenceSymbol =
    watchlist[0]?.tradingSymbol ?? cache.getWatchlist()[0]?.tradingSymbol ?? "";
  const sessionCandles = cache.getSessionCandlesForSymbol(date, referenceSymbol) ?? [];
  const latestSessionCandle = sessionCandles[sessionIndex];
  const simulatedTimeIst = latestSessionCandle
    ? formatIstTime(latestSessionCandle.timestamp)
    : DAY_SCAN_SIMULATION.sessionStart;

  const results = await Promise.all(
    watchlist.map((entry) =>
      Promise.resolve().then(() =>
        evaluateSymbolAtIndex(entry, date, sessionIndex, cache, variant),
      ),
    ),
  );

  const allSignals: DayScanSimulationSignal[] = [];
  const errors: DeepakDayScanError[] = [];

  for (const result of results) {
    allSignals.push(...result.signals);
    if (result.error) {
      errors.push(result.error);
    }
  }

  const entries = sortSignals(
    allSignals.filter((signal) =>
      isTimeAtOrBefore(signal.entryTimeIst, simulatedTimeIst),
    ),
  );

  const exits = sortExits(
    entries
      .filter(
        (signal) =>
          signal.exitTimeIst != null &&
          signal.exitPrice != null &&
          isTimeAtOrBefore(signal.exitTimeIst, simulatedTimeIst),
      )
      .map(
        (signal): DayScanSimulationExit => ({
          date: signal.date,
          strategy: signal.strategy,
          side: signal.side,
          scenarioNumber: signal.scenarioNumber,
          scenarioKey: signal.scenarioKey,
          tradingSymbol: signal.tradingSymbol,
          symbol: signal.symbol,
          sector: signal.sector,
          entryTimeIst: signal.entryTimeIst,
          entryPrice: signal.entryPrice,
          exitTimeIst: signal.exitTimeIst!,
          exitPrice: signal.exitPrice!,
          targetHit: signal.targetHit,
          profit: signal.profit,
          profitTarget: signal.profitTarget,
          bbMatchType: signal.bbMatchType,
          exitReason: signal.exitReason ?? (signal.targetHit ? "target" : null),
          stopLossHit: signal.stopLossHit ?? false,
        }),
      ),
  );

  const marks: DayScanSimulationMark[] = [];
  for (const entry of watchlist) {
    const candles = cache.getCandles(date, entry.tradingSymbol);
    if (!candles || candles.length === 0) {
      continue;
    }
    const sessionCandles = cache.getSessionCandlesForSymbol(
      date,
      entry.tradingSymbol,
    );
    const visibleSession = (sessionCandles ?? []).slice(0, sessionIndex + 1);
    const latest = visibleSession[visibleSession.length - 1];
    if (!latest) {
      continue;
    }
    marks.push({
      tradingSymbol: entry.tradingSymbol,
      price: candleMidPrice(latest),
      timeIst: formatIstTime(latest.timestamp),
    });
  }

  return {
    date,
    simulation: {
      sessionIndex,
      sessionCandleCount,
      simulatedTimeIst,
    },
    entries,
    exits,
    marks,
    errors,
    summary: buildSummary(entries, exits, errors, watchlist.length),
  };
}

export async function buildDayScanSimulationPayload(input: {
  date: string;
  sessionIndex: number;
  cache: DayScanSimulationCache;
  variant?: string | null;
  /** When true, re-fetch candles for the date (live IST-today growth). */
  refresh?: boolean;
}): Promise<DayScanSimulationPayload> {
  const dateError = validateDayScanDate(input.date);
  if (dateError) {
    throw new Error(dateError);
  }

  if (!Number.isInteger(input.sessionIndex) || input.sessionIndex < 0) {
    throw new RangeError("sessionIndex must be a non-negative integer.");
  }

  const variant = parseDayScanSimulationVariant(input.variant);

  await input.cache.prefetch(input.date, { force: input.refresh === true });

  let sessionCandleCount = input.cache.getSessionCandleCount(input.date);
  if (sessionCandleCount === 0) {
    const summary =
      input.cache.getPrefetchErrorSummary(input.date) ??
      `No session candles found for ${input.date}.`;
    throw new Error(summary);
  }

  // Live today: if the client asks for a candle past the cached count, force one
  // refresh so a newly completed 15m bar can extend the session.
  if (input.sessionIndex >= sessionCandleCount && input.refresh !== true) {
    const todayKey = getIstTimeParts(new Date()).dateKey;
    if (input.date === todayKey) {
      await input.cache.prefetch(input.date, { force: true });
      sessionCandleCount = input.cache.getSessionCandleCount(input.date);
    }
  }

  if (input.sessionIndex >= sessionCandleCount) {
    throw new RangeError(
      `sessionIndex ${input.sessionIndex} out of range (0–${sessionCandleCount - 1}).`,
    );
  }

  const payload = await input.cache.getOrBuildFrame(
    input.date,
    variant,
    input.sessionIndex,
    () =>
      computeDayScanSimulationFrame({
        date: input.date,
        sessionIndex: input.sessionIndex,
        cache: input.cache,
        variant,
      }),
  );

  const nextIndex = input.sessionIndex + 1;
  if (nextIndex < sessionCandleCount) {
    input.cache.ensureFrameCached(input.date, variant, nextIndex, () =>
      computeDayScanSimulationFrame({
        date: input.date,
        sessionIndex: nextIndex,
        cache: input.cache,
        variant,
      }),
    );
  }

  // Overlay Samco Trading stop-loss % after cache so SL setting changes
  // appear in EXIT SIGNAL without invalidating strategy frames.
  return applyStopLossToDayScanSimulationPayload(
    payload,
    getSamcoStopLossPct(),
  );
}

export function validateDayScanSimulationDate(date: string): string | null {
  if (!isValidAnalysisDate(date)) {
    return "Invalid date format. Use YYYY-MM-DD.";
  }
  return null;
}
