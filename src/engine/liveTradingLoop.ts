import { getSamcoLiveTradingEnabled } from "../samco/samcoLiveTrading.js";
import {
  getSamcoDryRun,
  getSamcoRuleVariant,
  setSamcoRuleVariant,
} from "../samco/samcoRuntimeSettings.js";
import {
  latestClosedSessionCandleIst,
  loadSamcoDayScanSignalSnapshot,
} from "../samco/samcoDayScanBridge.js";
import { appendSamcoTradeLogs } from "../samco/samcoTradeLog.js";
import {
  forceEodSquareOff,
  isEodSquareOffDue,
  processDayScanSignalSnapshot,
  processDecisionResult,
  reconcilePendingEntries,
  type ProcessDecisionResult,
  type TradeExecutorLog,
} from "../samco/tradeExecutor.js";
import { getIstTimeParts } from "../utils/marketTime.js";
import { runSamcoDayScanCycle } from "./samcoDayScanCycle.js";

export interface LiveTradingCycleResult {
  processed: boolean;
  eodSquareOff: boolean;
  stocksScanned: number;
  scanErrors: number;
  entriesPlaced: number;
  exitsPlaced: number;
  signalSource: "dayscan" | "poll" | "none";
  eod?: ProcessDecisionResult;
  reconcileLogs: TradeExecutorLog[];
}

function logExecutorMessages(logs: TradeExecutorLog[]): void {
  for (const entry of logs) {
    const prefix = entry.signalKey ? `[${entry.signalKey}] ` : "";
    const line = `${prefix}${entry.message}`;
    if (entry.level === "error") {
      console.error(line);
    } else if (entry.level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

export async function processLiveTradingCycle(): Promise<LiveTradingCycleResult> {
  const liveEnabled = getSamcoLiveTradingEnabled();
  const dryRun = getSamcoDryRun();
  const result: LiveTradingCycleResult = {
    processed: false,
    eodSquareOff: false,
    stocksScanned: 0,
    scanErrors: 0,
    entriesPlaced: 0,
    exitsPlaced: 0,
    signalSource: "none",
    reconcileLogs: [],
  };

  if (!liveEnabled && !dryRun) {
    return result;
  }

  result.reconcileLogs = await reconcilePendingEntries();

  if (isEodSquareOffDue()) {
    result.eod = await forceEodSquareOff();
    result.eodSquareOff = true;
    result.processed = true;
    logExecutorMessages(result.eod.logs);
    appendSamcoTradeLogs(result.eod.logs, { dryRun: dryRun || !liveEnabled });
    return result;
  }

  const today = getIstTimeParts(new Date()).dateKey;
  const dayScanSnapshot = loadSamcoDayScanSignalSnapshot();
  const latestCandle = latestClosedSessionCandleIst();

  if (dayScanSnapshot && dayScanSnapshot.date === today) {
    // Prefer Day Scan widget signals when a fresh ingest exists for today.
    if (getSamcoRuleVariant() !== dayScanSnapshot.variant) {
      setSamcoRuleVariant(dayScanSnapshot.variant);
    }

    const dayScanResult = await processDayScanSignalSnapshot(
      dayScanSnapshot,
      latestCandle,
    );
    result.signalSource = "dayscan";
    result.stocksScanned = new Set(
      dayScanSnapshot.trades.map((trade) => trade.tradingSymbol),
    ).size;
    result.entriesPlaced += dayScanResult.entriesPlaced;
    result.exitsPlaced += dayScanResult.exitsPlaced;
    logExecutorMessages(dayScanResult.logs);
    appendSamcoTradeLogs(dayScanResult.logs, {
      dryRun: dryRun || !liveEnabled,
    });
  } else {
    const cycle = await runSamcoDayScanCycle();
    result.signalSource = "poll";
    result.stocksScanned = cycle.symbols.length;
    result.scanErrors = cycle.errors.length;

    if (cycle.errors.length > 0) {
      for (const scanError of cycle.errors) {
        console.warn(
          `Samco day scan ${scanError.tradingSymbol}: ${scanError.error}`,
        );
      }
    }

    for (const symbolResult of cycle.symbols) {
      if (!symbolResult.latestCandleTimeIst || symbolResult.error) {
        continue;
      }

      const executorOptions = {
        tradingSymbol: symbolResult.tradingSymbol,
        exchange: symbolResult.exchange,
        source: "poll" as const,
      };

      for (const decision of symbolResult.decisions) {
        const decisionResult = await processDecisionResult(
          decision.strategy,
          decision.result,
          symbolResult.latestCandleTimeIst,
          executorOptions,
        );
        result.entriesPlaced += decisionResult.entriesPlaced;
        result.exitsPlaced += decisionResult.exitsPlaced;
        logExecutorMessages(decisionResult.logs);
        appendSamcoTradeLogs(decisionResult.logs, {
          dryRun: dryRun || !liveEnabled,
        });
      }
    }
  }

  if (result.reconcileLogs.length > 0) {
    appendSamcoTradeLogs(result.reconcileLogs, { dryRun: dryRun || !liveEnabled });
  }

  result.processed =
    result.entriesPlaced > 0 ||
    result.exitsPlaced > 0 ||
    result.signalSource === "dayscan";

  return result;
}
