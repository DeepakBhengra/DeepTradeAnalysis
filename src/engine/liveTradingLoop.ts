import { getSamcoLiveTradingEnabled } from "../samco/samcoLiveTrading.js";
import { getSamcoDryRun } from "../samco/samcoRuntimeSettings.js";
import { appendSamcoTradeLogs } from "../samco/samcoTradeLog.js";
import {
  forceEodSquareOff,
  isEodSquareOffDue,
  processDecisionResult,
  reconcilePendingEntries,
  type ProcessDecisionResult,
  type TradeExecutorLog,
} from "../samco/tradeExecutor.js";
import { runSamcoDayScanCycle } from "./samcoDayScanCycle.js";

export interface LiveTradingCycleResult {
  processed: boolean;
  eodSquareOff: boolean;
  stocksScanned: number;
  scanErrors: number;
  entriesPlaced: number;
  exitsPlaced: number;
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

  const cycle = await runSamcoDayScanCycle();
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
    };

    if (symbolResult.deepak) {
      const deepakResult = await processDecisionResult(
        "deepak",
        symbolResult.deepak,
        symbolResult.latestCandleTimeIst,
        executorOptions,
      );
      result.entriesPlaced += deepakResult.entriesPlaced;
      result.exitsPlaced += deepakResult.exitsPlaced;
      logExecutorMessages(deepakResult.logs);
      appendSamcoTradeLogs(deepakResult.logs, {
        dryRun: dryRun || !liveEnabled,
      });
    }

    if (symbolResult.deepak2) {
      const deepak2Result = await processDecisionResult(
        "deepak2",
        symbolResult.deepak2,
        symbolResult.latestCandleTimeIst,
        executorOptions,
      );
      result.entriesPlaced += deepak2Result.entriesPlaced;
      result.exitsPlaced += deepak2Result.exitsPlaced;
      logExecutorMessages(deepak2Result.logs);
      appendSamcoTradeLogs(deepak2Result.logs, {
        dryRun: dryRun || !liveEnabled,
      });
    }
  }

  if (result.reconcileLogs.length > 0) {
    appendSamcoTradeLogs(result.reconcileLogs, { dryRun: dryRun || !liveEnabled });
  }

  result.processed =
    result.entriesPlaced > 0 ||
    result.exitsPlaced > 0 ||
    cycle.symbols.some((symbol) => symbol.deepak || symbol.deepak2);

  return result;
}
