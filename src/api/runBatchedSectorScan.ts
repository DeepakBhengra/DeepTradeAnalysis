import { config } from "../config.js";
import { warmKiteExchangeInstruments } from "../data/pnbFeed.js";
import type { SectorWatchlistEntry } from "../symbols/sectorWatchlist.js";

const KITE_AUTH_SNIPPETS = [
  "Kite access_token expired",
  "Kite not connected",
] as const;

export function isKiteAuthScanError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    KITE_AUTH_SNIPPETS.some((snippet) => message.includes(snippet)) ||
    (lower.includes("token") && (lower.includes("expired") || lower.includes("invalid"))) ||
    lower.includes("unauthorized") ||
    lower.includes("access denied")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withSymbolTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  tradingSymbol: string,
): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`${tradingSymbol}: timed out after ${Math.round(timeoutMs / 1000)}s`),
        );
      }, timeoutMs);
    }),
  ]);
}

export function withDayScanSymbolTimeout<T>(
  promise: Promise<T>,
  tradingSymbol: string,
): Promise<T> {
  if (config.dayScanSymbolTimeoutMs <= 0) {
    return promise;
  }

  return withSymbolTimeout(promise, config.dayScanSymbolTimeoutMs, tradingSymbol);
}

export interface RunBatchedSectorScanOptions<T> {
  entries: SectorWatchlistEntry[];
  scan: (entry: SectorWatchlistEntry) => Promise<T>;
  resolveError?: (result: T) => string | null;
  label?: string;
  concurrency?: number;
  symbolTimeoutMs?: number;
  batchDelayMs?: number;
  failFastOnAuthError?: boolean;
}

export interface RunBatchedSectorScanResult<T> {
  results: T[];
  skippedEntries: SectorWatchlistEntry[];
  abortedEarly: boolean;
  abortReason: string | null;
}

function logProgress(
  label: string,
  completed: number,
  total: number,
  tradingSymbol: string,
): void {
  console.info(`[${label}] ${completed}/${total} ${tradingSymbol}`);
}

export async function runBatchedSectorScan<T>(
  options: RunBatchedSectorScanOptions<T>,
): Promise<RunBatchedSectorScanResult<T>> {
  const {
    entries,
    scan,
    resolveError,
    label = "day-scan",
    concurrency = config.dayScanConcurrency,
    batchDelayMs = config.symbolBatchDelayMs,
    failFastOnAuthError = config.dayScanFailFastOnAuthError,
  } = options;

  await warmKiteExchangeInstruments("NSE");

  const results: T[] = [];
  let completed = 0;
  let authErrorCount = 0;
  let authErrorMessage: string | null = null;

  for (let index = 0; index < entries.length; index += concurrency) {
    if (failFastOnAuthError && authErrorCount >= 2 && authErrorMessage) {
      break;
    }

    const batch = entries.slice(index, index + concurrency);
    const batchResults = await Promise.all(batch.map((entry) => scan(entry)));

    for (let batchIndex = 0; batchIndex < batchResults.length; batchIndex += 1) {
      const result = batchResults[batchIndex];
      const entry = batch[batchIndex];
      results.push(result);
      completed += 1;
      logProgress(label, completed, entries.length, entry.tradingSymbol);

      const errorMessage = resolveError?.(result) ?? null;
      if (errorMessage && isKiteAuthScanError(errorMessage)) {
        authErrorCount += 1;
        authErrorMessage = errorMessage;
      }
    }

    if (failFastOnAuthError && authErrorCount >= 2 && authErrorMessage) {
      break;
    }

    if (index + concurrency < entries.length) {
      await delay(batchDelayMs);
    }
  }

  const skippedEntries = entries.slice(results.length);

  return {
    results,
    skippedEntries,
    abortedEarly: skippedEntries.length > 0 && authErrorCount >= 2,
    abortReason: authErrorMessage,
  };
}
