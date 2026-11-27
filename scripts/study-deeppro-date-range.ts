#!/usr/bin/env node
/**
 * deeppro BUY + SELL same-day square-off study across a date range
 * for the sector watchlist — Kite historical 15m + enhanced quality gates.
 */
import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { evaluateDeepproDay } from "../src/rules/deepproDecision.js";
import {
  SECTOR_WATCHLIST,
  type SectorWatchlistEntry,
} from "../src/symbols/sectorWatchlist.js";
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
  tag: string;
} {
  let fromDate = "2026-06-01";
  let toDate = "2026-06-15";
  let minProfitPct = 0.75;
  let limit = 50;
  let tag: string | undefined;

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
    tag: tag ?? `${fromDate}_to_${toDate}-gte${minProfitPct}`,
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
    if (parts.dateKey !== dateKey) {
      return false;
    }
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
  entry: SectorWatchlistEntry,
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
  if (!eventSnapshot) {
    return null;
  }

  const entryPrice = round(midPrice(eventSnapshot));
  const sq = bestSquareOff(
    snapshots,
    signal.dateKey,
    signal.eventTimeIst,
    signal.side,
    entryPrice,
  );
  const bestProfitPct = sq.bestProfitPct;

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
    bestProfitPct,
    hasExitWindow: sq.hasExitWindow,
    hitMinProfit:
      sq.hasExitWindow && bestProfitPct != null && bestProfitPct >= minProfitPct,
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

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

function accuracyBlock(
  trades: TradeRow[],
  minProfitPct: number,
): {
  signals: number;
  withExit: number;
  hits: number;
  hitRatePct: number | null;
  avgProfitPct: number | null;
  avgHitProfitPct: number | null;
} {
  const withExit = trades.filter(
    (trade) => trade.hasExitWindow && trade.bestProfitPct != null,
  );
  const hits = withExit.filter((trade) => trade.hitMinProfit);
  const avg = (rows: TradeRow[]): number | null => {
    if (rows.length === 0) return null;
    const sum = rows.reduce((acc, row) => acc + (row.bestProfitPct ?? 0), 0);
    return round(sum / rows.length, 3);
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

function writeSideTable(
  lines: string[],
  title: string,
  priceHeader: string,
  trades: TradeRow[],
): void {
  lines.push(
    "",
    `## ${title}`,
    "",
    `| Stock | Sector | Date | Event | Kind | RSI | BB upper % | BB lower % | ${priceHeader} | Best SQ off | SQ price | Profit % |`,
    "|-------|--------|------|-------|------|-----|------------|------------|------------|-------------|----------|----------|",
  );

  if (trades.length === 0) {
    lines.push(
      "| — | — | — | — | — | — | — | — | — | — | — | *none* |",
    );
    return;
  }

  for (const trade of trades) {
    const profit = !trade.hasExitWindow
      ? "no exit window"
      : trade.bestProfitPct == null
        ? "—"
        : `${trade.bestProfitPct.toFixed(2)}%`;
    lines.push(
      `| ${trade.symbol} | ${trade.sector} | ${trade.date} | ${trade.event} | ${trade.eventKind} | ${trade.eventRsi.toFixed(2)} | ${formatBbPct(trade.bbUpperGapPct, trade.bbUpperMatchType)} | ${formatBbPct(trade.bbLowerGapPct, trade.bbLowerMatchType)} | ${trade.entryPrice.toFixed(2)} | ${trade.hasExitWindow ? (trade.bestTimeIst ?? "—") : "—"} | ${trade.hasExitWindow ? (trade.bestExitPrice?.toFixed(2) ?? "—") : "—"} | ${profit} |`,
    );
  }
}

function writeDailyAccuracy(
  lines: string[],
  dateKeys: string[],
  scannedTrades: TradeRow[],
  minProfitPct: number,
): void {
  lines.push(
    "",
    "## Daily accuracy",
    "",
    `| Date | Signals | With exit | Hits ≥${minProfitPct}% | Hit rate | BUY hits | SELL hits | Avg profit % |`,
    "|------|---------|-----------|--------------------------|----------|----------|-----------|--------------|",
  );

  for (const dateKey of dateKeys) {
    const day = scannedTrades.filter((trade) => trade.dateKey === dateKey);
    if (day.length === 0) {
      lines.push(
        `| ${formatDayLabel(dateKey)} | 0 | 0 | 0 | — | 0 | 0 | — |`,
      );
      continue;
    }
    const acc = accuracyBlock(day, minProfitPct);
    const buyHits = day.filter(
      (trade) => trade.side === "BUY" && trade.hitMinProfit,
    ).length;
    const sellHits = day.filter(
      (trade) => trade.side === "SELL" && trade.hitMinProfit,
    ).length;
    lines.push(
      `| ${formatDayLabel(dateKey)} | ${acc.signals} | ${acc.withExit} | ${acc.hits} | ${acc.hitRatePct == null ? "—" : `${acc.hitRatePct}%`} | ${buyHits} | ${sellHits} | ${acc.avgProfitPct == null ? "—" : acc.avgProfitPct.toFixed(3)} |`,
    );
  }
}

async function main(): Promise<void> {
  const { fromDate, toDate, minProfitPct, limit, tag } = parseArgs(
    process.argv.slice(2),
  );
  const watchlist = SECTOR_WATCHLIST.slice(0, limit);
  const dateKeys = enumerateDateKeys(fromDate, toDate);
  const concurrency = Math.max(1, config.dayScanConcurrency);

  console.log(
    JSON.stringify({
      phase: "start",
      fromDate,
      toDate,
      dates: dateKeys.length,
      minProfitPct,
      stocks: watchlist.length,
      concurrency,
    }),
  );

  type ScanResult = {
    entry: SectorWatchlistEntry;
    trades: TradeRow[];
    signalCount: number;
    error: string | null;
  };

  const results = await mapPool(watchlist, concurrency, async (entry, index) => {
    try {
      const dashboardSymbol = resolveDashboardSymbol(entry.tradingSymbol);
      const candles = await fetchPnbCandles({
        symbol: dashboardSymbol.tradingSymbol,
        exchange: dashboardSymbol.exchange,
        segment: dashboardSymbol.segment,
        fromDate,
        toDate,
        kiteRetries: config.dayScanKiteRetries,
      });
      const snapshots = buildIndicatorSnapshots(candles);
      const trades: TradeRow[] = [];
      for (const dateKey of dateKeys) {
        const day = evaluateDeepproDay(snapshots, dateKey);
        for (const signal of day.signals) {
          const row = toTradeRow(entry, signal, snapshots, minProfitPct);
          if (row) {
            trades.push(row);
          }
        }
      }

      if ((index + 1) % 5 === 0 || index === 0 || index === watchlist.length - 1) {
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

  const scannedTrades = results
    .flatMap((result) => result.trades)
    .sort((left, right) => {
      const dateDiff = left.dateKey.localeCompare(right.dateKey);
      if (dateDiff !== 0) return dateDiff;
      const sideDiff = right.side.localeCompare(left.side);
      if (sideDiff !== 0) return sideDiff;
      const profitDiff = (right.bestProfitPct ?? -999) - (left.bestProfitPct ?? -999);
      if (profitDiff !== 0) return profitDiff;
      return left.symbol.localeCompare(right.symbol);
    });

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
  const errors = results.filter((result) => result.error);
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
  const stocksWithSignals = new Set(
    scannedTrades.map((trade) => trade.symbol),
  ).size;
  const stocksInReport = new Set(filtered.map((trade) => trade.symbol)).size;

  mkdirSync(REPORTS_DIR, { recursive: true });
  const base = `deeppro-watchlist-${tag}`;
  const jsonPath = resolve(REPORTS_DIR, `${base}.json`);
  const mdPath = resolve(REPORTS_DIR, `${base}.md`);
  const source = "Kite Connect historical (NSE sector watchlist, 15minute)";
  const generatedAtUtc = new Date().toISOString();

  const payload = {
    rule: "deeppro",
    fromDate,
    toDate,
    minProfitPct,
    generatedAtUtc,
    watchlistSize: watchlist.length,
    stocksScanned: results.length,
    stocksWithSignals,
    stocksInReport,
    datesRequested: dateKeys.length,
    datesWithSignals: activeDates.length,
    scannedTrades: scannedTrades.length,
    tradesInReport: filtered.length,
    sellCount: sells.length,
    buyCount: buys.length,
    errorCount: errors.length,
    accuracy: {
      overall,
      buy: buyAcc,
      sell: sellAcc,
    },
    errors: errors.map((result) => ({
      symbol: result.entry.tradingSymbol,
      sector: result.entry.sector,
      error: result.error,
    })),
    data: {
      source,
      deeppro: {
        minPeakSmi: config.deeppro.minPeakSmi,
        maxTroughSmi: config.deeppro.maxTroughSmi,
        lookbackBars: config.deeppro.lookbackBars,
        entryDeadlineIst: config.deeppro.entryDeadlineIst,
        minMacdHistDeltaPct: config.deeppro.minMacdHistDeltaPct,
        qualityFilter: config.deeppro.qualityFilter,
      },
    },
    allTrades: scannedTrades,
    trades: filtered,
  };

  const lines = [
    `# Deeppro BUY + SELL square-off — ${formatDayLabel(fromDate)} to ${formatDayLabel(toDate)} (profit ≥ ${minProfitPct}%)`,
    "",
    `- **Range:** ${fromDate} → ${toDate} (${dateKeys.length} calendar days · ${activeDates.length} with signals)`,
    `- **Rule:** deeppro enhanced (Stch Mtm exhaustion + quality gates)`,
    `- **Universe:** ${watchlist.length} sector-watchlist stocks`,
    `- **Entry price:** event candle mid \`(high + low) / 2\``,
    `- **Square-off:** best later same-day candle mid before \`${SESSION_END}\` IST`,
    `- **SELL profit %:** \`(sell - sq) / sell * 100\``,
    `- **BUY profit %:** \`(sq - buy) / buy * 100\``,
    `- **Hit definition:** best same-day SQ profit ≥ ${minProfitPct}%`,
    `- **Stocks scanned:** ${results.length} · with signals: ${stocksWithSignals} · in hit report: ${stocksInReport}`,
    `- **Signals scanned:** ${scannedTrades.length} (${buyAcc.signals} BUY · ${sellAcc.signals} SELL)`,
    `- **Hits ≥ ${minProfitPct}%:** ${filtered.length} (${sells.length} SELL · ${buys.length} BUY)`,
    `- **Overall hit rate:** ${overall.hitRatePct == null ? "—" : `${overall.hitRatePct}%`} (${overall.hits}/${overall.withExit} with exit window)`,
    `- **BUY hit rate:** ${buyAcc.hitRatePct == null ? "—" : `${buyAcc.hitRatePct}%`} (${buyAcc.hits}/${buyAcc.withExit}) · avg profit ${buyAcc.avgProfitPct ?? "—"}%`,
    `- **SELL hit rate:** ${sellAcc.hitRatePct == null ? "—" : `${sellAcc.hitRatePct}%`} (${sellAcc.hits}/${sellAcc.withExit}) · avg profit ${sellAcc.avgProfitPct ?? "—"}%`,
    `- **Fetch errors:** ${errors.length}`,
    `- **Data:** ${source}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
  ];

  writeDailyAccuracy(lines, dateKeys, scannedTrades, minProfitPct);
  writeSideTable(lines, `SELL hits (≥ ${minProfitPct}%)`, "Sell price", sells);
  writeSideTable(lines, `BUY hits (≥ ${minProfitPct}%)`, "Buy price", buys);

  const misses = scannedTrades
    .filter((trade) => trade.hasExitWindow && !trade.hitMinProfit)
    .sort((left, right) => {
      const dateDiff = left.dateKey.localeCompare(right.dateKey);
      if (dateDiff !== 0) return dateDiff;
      return (left.bestProfitPct ?? 0) - (right.bestProfitPct ?? 0);
    });
  writeSideTable(
    lines,
    `Misses (best SQ < ${minProfitPct}%)`,
    "Entry price",
    misses,
  );

  if (errors.length > 0) {
    lines.push("", "## Fetch errors", "");
    for (const result of errors) {
      lines.push(
        `- \`${result.entry.tradingSymbol}\` (${result.entry.sector}): ${result.error}`,
      );
    }
    lines.push("");
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- Same-day square-off only; no overnight holds.",
    "- Kite Connect historical 15m only — same enhanced deeppro engine as Post-Mortem / Day Scan.",
    "- Quality gates: SELL event 10:45–12:30 + RSI/BB rules; BUY BB-match recovery / morning unmatched proximity / extreme-stall paths.",
    "- Hit rate uses best later same-day mid before 15:15 (study metric; not a live fill guarantee).",
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
        stocksScanned: results.length,
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
