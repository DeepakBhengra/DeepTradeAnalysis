#!/usr/bin/env node
/**
 * deeppro BUY + SELL same-day square-off study across a date range.
 * Default universe: 100 liquid NSE names. Kite historical 15m only.
 *
 * Report tables match the Day Scan / square-off screenshot layout:
 * Stock | Event | RSI | BB upper % | BB lower % | price | Best SQ off
 * plus Date / SQ price / Profit % for the range study.
 */
import "../src/loadEnv.js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { evaluateDeepproDay } from "../src/rules/deepproDecision.js";
import { SECTOR_WATCHLIST } from "../src/symbols/sectorWatchlist.js";
import {
  STUDY_UNIVERSE_100,
  assertStudyUniverseSize,
  type StudyUniverseEntry,
} from "../src/symbols/studyUniverse100.js";
import type { DeepproSignal, IndicatorSnapshot } from "../src/types.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";
import { formatUnknownError } from "../src/utils/formatError.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SESSION_END = "15:15";

function parseArgs(argv: string[]): {
  fromDate: string;
  toDate: string;
  minProfitPct: number;
  limit: number;
  universe: "100" | "50";
  tag: string;
  symbols: string[] | null;
  mergeJson: string | null;
  concurrencyOverride: number | null;
} {
  let fromDate = "2026-01-01";
  let toDate = "2026-03-31";
  let minProfitPct = 0.75;
  let limit = 100;
  let universe: "100" | "50" = "100";
  let tag: string | undefined;
  let symbols: string[] | null = null;
  let mergeJson: string | null = null;
  let concurrencyOverride: number | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--from" || arg === "--from-date") && argv[i + 1]) {
      fromDate = argv[++i];
      continue;
    }
    if ((arg === "--to" || arg === "--to-date") && argv[i + 1]) {
      toDate = argv[++i];
      continue;
    }
    if (arg === "--min-profit" && argv[i + 1]) {
      minProfitPct = Number(argv[++i]);
      continue;
    }
    if (arg === "--limit" && argv[i + 1]) {
      limit = Math.max(1, Number(argv[++i]));
      continue;
    }
    if (arg === "--universe" && argv[i + 1]) {
      const value = argv[++i];
      if (value !== "100" && value !== "50") {
        throw new Error(`Invalid --universe ${value}. Use 100 or 50.`);
      }
      universe = value;
      continue;
    }
    if (arg === "--symbols" && argv[i + 1]) {
      symbols = argv[++i]
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      continue;
    }
    if (arg === "--merge-json" && argv[i + 1]) {
      mergeJson = argv[++i];
      continue;
    }
    if (arg === "--concurrency" && argv[i + 1]) {
      concurrencyOverride = Math.max(1, Number(argv[++i]));
      continue;
    }
    if (arg === "--tag" && argv[i + 1]) {
      tag = argv[++i];
      continue;
    }
  }

  for (const [label, value] of [
    ["--from", fromDate],
    ["--to", toDate],
  ] as const) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`Invalid ${label} ${value}. Use YYYY-MM-DD.`);
    }
  }
  if (fromDate > toDate) {
    throw new Error(`--from ${fromDate} must be <= --to ${toDate}`);
  }

  return {
    fromDate,
    toDate,
    minProfitPct,
    limit,
    universe,
    tag: tag ?? `${fromDate}_to_${toDate}-gte${minProfitPct}`,
    symbols,
    mergeJson,
    concurrencyOverride,
  };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function midPrice(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

function formatDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

function formatBbPct(gapPct: number, matchType: string | null): string {
  const base = gapPct.toFixed(3);
  return matchType ? `${base} (${matchType})` : base;
}

function enumerateDateKeys(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T12:00:00+05:30`);
  const end = new Date(`${toDate}T12:00:00+05:30`);
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    dates.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function bestSquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  eventTimeIst: string,
  side: "BUY" | "SELL",
  entryPrice: number,
): {
  hasExitWindow: boolean;
  bestTimeIst: string | null;
  bestExitPrice: number | null;
  bestProfitPct: number | null;
} {
  const after = snapshots.filter((snapshot) => {
    const parts = getIstTimeParts(snapshot.timestamp);
    if (parts.dateKey !== dateKey) return false;
    const timeIst = formatIstTime(snapshot.timestamp);
    return timeIst > eventTimeIst && timeIst <= SESSION_END;
  });

  if (after.length === 0) {
    return {
      hasExitWindow: false,
      bestTimeIst: null,
      bestExitPrice: null,
      bestProfitPct: null,
    };
  }

  let bestTimeIst: string | null = null;
  let bestExitPrice: number | null = null;
  let bestProfitPct: number | null = null;

  for (const snapshot of after) {
    const exitPrice = midPrice(snapshot);
    const profitPct =
      side === "SELL"
        ? ((entryPrice - exitPrice) / entryPrice) * 100
        : ((exitPrice - entryPrice) / entryPrice) * 100;
    if (bestProfitPct == null || profitPct > bestProfitPct) {
      bestProfitPct = profitPct;
      bestExitPrice = exitPrice;
      bestTimeIst = formatIstTime(snapshot.timestamp);
    }
  }

  return {
    hasExitWindow: true,
    bestTimeIst,
    bestExitPrice: bestExitPrice == null ? null : round(bestExitPrice),
    bestProfitPct: bestProfitPct == null ? null : round(bestProfitPct),
  };
}

interface TradeRow {
  symbol: string;
  sector: string;
  date: string;
  dateKey: string;
  side: "BUY" | "SELL";
  event: string;
  eventKind: string;
  eventRsi: number;
  bbUpperGapPct: number;
  bbLowerGapPct: number;
  bbUpperMatchType: string | null;
  bbLowerMatchType: string | null;
  entryPrice: number;
  bestTimeIst: string | null;
  bestExitPrice: number | null;
  bestProfitPct: number | null;
  hasExitWindow: boolean;
  hitMinProfit: boolean;
}

function toTradeRow(
  entry: StudyUniverseEntry,
  signal: DeepproSignal,
  snapshots: IndicatorSnapshot[],
  minProfitPct: number,
): TradeRow | null {
  const eventSnapshot = snapshots.find((snapshot) => {
    const parts = getIstTimeParts(snapshot.timestamp);
    return (
      parts.dateKey === signal.dateKey &&
      formatIstTime(snapshot.timestamp) === signal.eventTimeIst
    );
  });
  if (!eventSnapshot) return null;

  const entryPrice = round(midPrice(eventSnapshot));
  const sq = bestSquareOff(
    snapshots,
    signal.dateKey,
    signal.eventTimeIst,
    signal.side,
    entryPrice,
  );

  return {
    symbol: entry.tradingSymbol,
    sector: entry.sector,
    date: formatDayLabel(signal.dateKey),
    dateKey: signal.dateKey,
    side: signal.side,
    event: signal.eventTimeIst,
    eventKind: signal.eventKind,
    eventRsi: round(signal.eventRsi),
    bbUpperGapPct: round(signal.bbUpperProximity.gapPct, 3),
    bbLowerGapPct: round(signal.bbLowerProximity.gapPct, 3),
    bbUpperMatchType: signal.bbUpperProximity.matchType,
    bbLowerMatchType: signal.bbLowerProximity.matchType,
    entryPrice,
    bestTimeIst: sq.bestTimeIst,
    bestExitPrice: sq.bestExitPrice,
    bestProfitPct: sq.bestProfitPct,
    hasExitWindow: sq.hasExitWindow,
    hitMinProfit:
      sq.hasExitWindow &&
      sq.bestProfitPct != null &&
      sq.bestProfitPct >= minProfitPct,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}

function accuracyBlock(trades: TradeRow[], minProfitPct: number) {
  const withExit = trades.filter(
    (trade) => trade.hasExitWindow && trade.bestProfitPct != null,
  );
  const hits = withExit.filter((trade) => trade.hitMinProfit);
  const avg = (rows: TradeRow[]): number | null => {
    if (rows.length === 0) return null;
    return round(
      rows.reduce((acc, row) => acc + (row.bestProfitPct ?? 0), 0) / rows.length,
      3,
    );
  };
  return {
    signals: trades.length,
    withExit: withExit.length,
    hits: hits.length,
    hitRatePct:
      withExit.length === 0
        ? null
        : round((hits.length / withExit.length) * 100, 1),
    avgProfitPct: avg(withExit),
    avgHitProfitPct: avg(hits),
  };
}

/** Screenshot-style hit table (plus Date / Profit for range usefulness). */
function writeScreenshotSideTable(
  lines: string[],
  title: string,
  priceHeader: string,
  trades: TradeRow[],
): void {
  lines.push(
    "",
    `## ${title}`,
    "",
    `| Stock | Date | Event | RSI | BB upper % | BB lower % | ${priceHeader} | Best SQ off | SQ price | Profit % |`,
    "|-------|------|-------|-----|------------|------------|------------|-------------|----------|----------|",
  );

  if (trades.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | — | *none* |");
    return;
  }

  for (const trade of trades) {
    const profit =
      trade.bestProfitPct == null ? "—" : `${trade.bestProfitPct.toFixed(2)}%`;
    lines.push(
      `| ${trade.symbol} | ${trade.date} | ${trade.event} | ${trade.eventRsi.toFixed(2)} | ${formatBbPct(trade.bbUpperGapPct, trade.bbUpperMatchType)} | ${formatBbPct(trade.bbLowerGapPct, trade.bbLowerMatchType)} | ${trade.entryPrice.toFixed(2)} | ${trade.bestTimeIst ?? "—"} | ${trade.bestExitPrice?.toFixed(2) ?? "—"} | ${profit} |`,
    );
  }
}

async function main(): Promise<void> {
  const {
    fromDate,
    toDate,
    minProfitPct,
    limit,
    universe,
    tag,
    symbols,
    mergeJson,
    concurrencyOverride,
  } = parseArgs(process.argv.slice(2));

  if (universe === "100") {
    assertStudyUniverseSize(100);
  }

  const fullUniverse: StudyUniverseEntry[] =
    universe === "100"
      ? STUDY_UNIVERSE_100
      : SECTOR_WATCHLIST.map((entry) => ({
          sector: entry.sector,
          tradingSymbol: entry.tradingSymbol,
        }));
  const watchlist = (
    symbols
      ? fullUniverse.filter((entry) => symbols.includes(entry.tradingSymbol))
      : fullUniverse
  ).slice(0, symbols ? symbols.length : limit);
  if (symbols && watchlist.length !== symbols.length) {
    const found = new Set(watchlist.map((entry) => entry.tradingSymbol));
    const missing = symbols.filter((symbol) => !found.has(symbol));
    throw new Error(`Unknown --symbols: ${missing.join(", ")}`);
  }
  const dateKeys = enumerateDateKeys(fromDate, toDate);
  const concurrency = Math.max(
    1,
    concurrencyOverride ?? config.dayScanConcurrency,
  );

  console.log(
    JSON.stringify({
      phase: "start",
      fromDate,
      toDate,
      dates: dateKeys.length,
      minProfitPct,
      universe,
      stocks: watchlist.length,
      concurrency,
    }),
  );

  type ScanResult = {
    entry: StudyUniverseEntry;
    trades: TradeRow[];
    signalCount: number;
    error: string | null;
  };

  const results = await mapPool(watchlist, concurrency, async (entry, index) => {
    try {
      const dashboardSymbol = resolveDashboardSymbol(entry.tradingSymbol);
      // Gentle pacing under Kite rate limits on large range pulls.
      if (index > 0) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, Math.max(150, config.symbolBatchDelayMs)),
        );
      }
      const candles = await fetchPnbCandles({
        symbol: dashboardSymbol.tradingSymbol,
        exchange: dashboardSymbol.exchange,
        segment: dashboardSymbol.segment,
        fromDate,
        toDate,
        kiteRetries: Math.max(config.dayScanKiteRetries, config.kite.requestRetries),
      });
      const snapshots = buildIndicatorSnapshots(candles);
      const trades: TradeRow[] = [];
      for (const dateKey of dateKeys) {
        const day = evaluateDeepproDay(snapshots, dateKey);
        for (const signal of day.signals) {
          const row = toTradeRow(entry, signal, snapshots, minProfitPct);
          if (row) trades.push(row);
        }
      }

      if (
        (index + 1) % 5 === 0 ||
        index === 0 ||
        index === watchlist.length - 1
      ) {
        console.log(
          `[deeppro-range] ${index + 1}/${watchlist.length} ${entry.tradingSymbol} signals=${trades.length}`,
        );
      }

      return {
        entry,
        trades,
        signalCount: trades.length,
        error: null,
      } satisfies ScanResult;
    } catch (error) {
      const message = formatUnknownError(error);
      console.log(
        `[deeppro-range] ${index + 1}/${watchlist.length} ${entry.tradingSymbol} ERROR ${message}`,
      );
      return {
        entry,
        trades: [],
        signalCount: 0,
        error: message,
      } satisfies ScanResult;
    }
  });

  let scannedTrades = results.flatMap((result) => result.trades);
  let errors = results
    .filter((result) => result.error)
    .map((result) => ({
      symbol: result.entry.tradingSymbol,
      sector: result.entry.sector,
      error: result.error as string,
    }));
  let stocksScanned = results.length;
  let universeSize = symbols ? fullUniverse.length : watchlist.length;

  if (mergeJson) {
    const prior = JSON.parse(readFileSync(resolve(mergeJson), "utf8")) as {
      allTrades?: TradeRow[];
      errors?: Array<{ symbol: string; sector: string; error: string }>;
      watchlistSize?: number;
      stocksScanned?: number;
    };
    const retried = new Set(watchlist.map((entry) => entry.tradingSymbol));
    const priorTrades = (prior.allTrades ?? []).filter(
      (trade) => !retried.has(trade.symbol),
    );
    const priorErrors = (prior.errors ?? []).filter(
      (entry) => !retried.has(entry.symbol),
    );
    scannedTrades = [...priorTrades, ...scannedTrades];
    errors = [...priorErrors, ...errors];
    stocksScanned = prior.watchlistSize ?? prior.stocksScanned ?? stocksScanned;
    universeSize = prior.watchlistSize ?? fullUniverse.length;
    console.log(
      JSON.stringify({
        phase: "merged",
        priorTrades: priorTrades.length,
        retryTrades: results.flatMap((result) => result.trades).length,
        remainingErrors: errors.length,
      }),
    );
  }

  const filtered = scannedTrades
    .filter((trade) => trade.hitMinProfit)
    .sort((left, right) => {
      const profitDiff = (right.bestProfitPct ?? 0) - (left.bestProfitPct ?? 0);
      if (profitDiff !== 0) return profitDiff;
      const dateDiff = left.dateKey.localeCompare(right.dateKey);
      if (dateDiff !== 0) return dateDiff;
      return left.symbol.localeCompare(right.symbol);
    });

  const sells = filtered.filter((trade) => trade.side === "SELL");
  const buys = filtered.filter((trade) => trade.side === "BUY");
  const overall = accuracyBlock(scannedTrades, minProfitPct);
  const buyAcc = accuracyBlock(
    scannedTrades.filter((trade) => trade.side === "BUY"),
    minProfitPct,
  );
  const sellAcc = accuracyBlock(
    scannedTrades.filter((trade) => trade.side === "SELL"),
    minProfitPct,
  );
  const activeDates = dateKeys.filter((dateKey) =>
    scannedTrades.some((trade) => trade.dateKey === dateKey),
  );
  const stocksWithSignals = new Set(scannedTrades.map((t) => t.symbol)).size;
  const stocksInReport = new Set(filtered.map((t) => t.symbol)).size;

  mkdirSync(REPORTS_DIR, { recursive: true });
  const base = `deeppro-universe${universeSize}-${tag}`;
  const jsonPath = resolve(REPORTS_DIR, `${base}.json`);
  const mdPath = resolve(REPORTS_DIR, `${base}.md`);
  const source = "Kite Connect historical (NSE study universe, 15minute)";
  const generatedAtUtc = new Date().toISOString();

  const payload = {
    rule: "deeppro",
    fromDate,
    toDate,
    minProfitPct,
    universe,
    generatedAtUtc,
    watchlistSize: universeSize,
    stocksScanned,
    stocksWithSignals,
    stocksInReport,
    datesRequested: dateKeys.length,
    datesWithSignals: activeDates.length,
    scannedTrades: scannedTrades.length,
    tradesInReport: filtered.length,
    sellCount: sells.length,
    buyCount: buys.length,
    errorCount: errors.length,
    accuracy: { overall, buy: buyAcc, sell: sellAcc },
    errors,
    data: {
      source,
      deeppro: {
        minPeakSmi: config.deeppro.minPeakSmi,
        maxTroughSmi: config.deeppro.maxTroughSmi,
        lookbackBars: config.deeppro.lookbackBars,
        qualityFilter: config.deeppro.qualityFilter,
      },
    },
    trades: filtered,
    allTrades: scannedTrades,
  };

  const lines = [
    `# Deeppro BUY + SELL — ${formatDayLabel(fromDate)} to ${formatDayLabel(toDate)} (profit ≥ ${minProfitPct}%)`,
    "",
    `- **Range:** ${fromDate} → ${toDate} (${dateKeys.length} calendar days · ${activeDates.length} with signals)`,
    `- **Rule:** deeppro enhanced (Stch Mtm exhaustion + quality gates)`,
    `- **Universe:** ${universeSize} stocks`,
    `- **Entry price:** event candle mid \`(high + low) / 2\``,
    `- **Square-off:** best later same-day candle mid before \`${SESSION_END}\` IST`,
    `- **SELL profit %:** \`(sell - sq) / sell * 100\``,
    `- **BUY profit %:** \`(sq - buy) / buy * 100\``,
    `- **Hit definition:** best same-day SQ profit ≥ ${minProfitPct}%`,
    `- **Stocks scanned:** ${stocksScanned} · with signals: ${stocksWithSignals} · in hit report: ${stocksInReport}`,
    `- **Signals scanned:** ${scannedTrades.length} (${buyAcc.signals} BUY · ${sellAcc.signals} SELL)`,
    `- **Hits ≥ ${minProfitPct}%:** ${filtered.length} (${sells.length} SELL · ${buys.length} BUY)`,
    `- **Overall hit rate:** ${overall.hitRatePct == null ? "—" : `${overall.hitRatePct}%`} (${overall.hits}/${overall.withExit})`,
    `- **BUY hit rate:** ${buyAcc.hitRatePct == null ? "—" : `${buyAcc.hitRatePct}%`} (${buyAcc.hits}/${buyAcc.withExit}) · avg hit ${buyAcc.avgHitProfitPct ?? "—"}%`,
    `- **SELL hit rate:** ${sellAcc.hitRatePct == null ? "—" : `${sellAcc.hitRatePct}%`} (${sellAcc.hits}/${sellAcc.withExit}) · avg hit ${sellAcc.avgHitProfitPct ?? "—"}%`,
    `- **Fetch errors:** ${errors.length}`,
    `- **Data:** ${source}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
  ];

  writeScreenshotSideTable(lines, "SELL", "Sell price", sells);
  writeScreenshotSideTable(lines, "BUY", "Buy price", buys);

  if (errors.length > 0) {
    lines.push("", "## Fetch errors", "");
    for (const entry of errors) {
      lines.push(`- \`${entry.symbol}\` (${entry.sector}): ${entry.error}`);
    }
    lines.push("");
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- Same-day square-off only; no overnight holds.",
    "- Kite Connect historical 15m only — same enhanced deeppro engine as Post-Mortem / Day Scan.",
    "- Table layout matches the square-off screenshot (Stock / Event / RSI / BB% / price / Best SQ off), with Date + Profit % added for the range.",
    "",
  );

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        fromDate,
        toDate,
        minProfitPct,
        stocksScanned,
        stocksWithSignals,
        datesWithSignals: activeDates.length,
        scannedTrades: scannedTrades.length,
        tradesInReport: filtered.length,
        sellCount: sells.length,
        buyCount: buys.length,
        accuracy: payload.accuracy,
        errorCount: errors.length,
        json: jsonPath,
        markdown: mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
