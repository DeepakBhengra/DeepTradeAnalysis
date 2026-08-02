#!/usr/bin/env node
/**
 * deeppro BUY + SELL same-day square-off study for one session date
 * across the sector watchlist (50 stocks) — Kite historical 15m only.
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
  date: string;
  minProfitPct: number;
  limit: number;
  tag: string;
} {
  let date = "2026-06-29";
  let minProfitPct = 0.75;
  let limit = 50;
  let tag: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--date" && argv[i + 1]) {
      date = argv[++i];
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid --date ${date}. Use YYYY-MM-DD.`);
  }

  return {
    date,
    minProfitPct,
    limit,
    tag: tag ?? `watchlist-${date}-gte${minProfitPct}`,
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
}

function toTradeRow(
  entry: SectorWatchlistEntry,
  signal: DeepproSignal,
  snapshots: IndicatorSnapshot[],
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

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    run(),
  );
  await Promise.all(runners);
  return results;
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
    `| Stock | Sector | Date | Event | RSI | BB upper % | BB lower % | ${priceHeader} | Best SQ off | SQ price | Profit % |`,
    "|-------|--------|------|-------|-----|------------|------------|------------|-------------|----------|----------|",
  );

  if (trades.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | — | — | *none* |");
    return;
  }

  for (const trade of trades) {
    const profit = !trade.hasExitWindow
      ? "no exit window"
      : trade.bestProfitPct == null
        ? "—"
        : `${trade.bestProfitPct.toFixed(2)}%`;
    lines.push(
      `| ${trade.symbol} | ${trade.sector} | ${trade.date} | ${trade.event} | ${trade.eventRsi.toFixed(2)} | ${formatBbPct(trade.bbUpperGapPct, trade.bbUpperMatchType)} | ${formatBbPct(trade.bbLowerGapPct, trade.bbLowerMatchType)} | ${trade.entryPrice.toFixed(2)} | ${trade.hasExitWindow ? (trade.bestTimeIst ?? "—") : "—"} | ${trade.hasExitWindow ? (trade.bestExitPrice?.toFixed(2) ?? "—") : "—"} | ${profit} |`,
    );
  }
}

async function main(): Promise<void> {
  const { date, minProfitPct, limit, tag } = parseArgs(process.argv.slice(2));
  const watchlist = SECTOR_WATCHLIST.slice(0, limit);
  const concurrency = Math.max(1, config.dayScanConcurrency);

  console.log(
    JSON.stringify({
      phase: "start",
      date,
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
        fromDate: date,
        toDate: date,
        kiteRetries: config.dayScanKiteRetries,
      });
      const snapshots = buildIndicatorSnapshots(candles);
      const day = evaluateDeepproDay(snapshots, date);
      const trades = day.signals
        .map((signal) => toTradeRow(entry, signal, snapshots))
        .filter((row): row is TradeRow => row != null);

      if ((index + 1) % 5 === 0 || index === 0 || index === watchlist.length - 1) {
        console.log(
          `[deeppro-day] ${index + 1}/${watchlist.length} ${entry.tradingSymbol} signals=${trades.length}`,
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
        `[deeppro-day] ${index + 1}/${watchlist.length} ${entry.tradingSymbol} ERROR ${message}`,
      );
      return {
        entry,
        trades: [],
        signalCount: 0,
        error: message,
      } satisfies ScanResult;
    }
  });

  const scannedTrades = results.flatMap((result) => result.trades);
  const filtered = scannedTrades
    .filter(
      (trade) =>
        trade.hasExitWindow &&
        trade.bestProfitPct != null &&
        trade.bestProfitPct >= minProfitPct,
    )
    .sort((left, right) => {
      const profitDiff = (right.bestProfitPct ?? 0) - (left.bestProfitPct ?? 0);
      if (profitDiff !== 0) {
        return profitDiff;
      }
      return left.symbol.localeCompare(right.symbol);
    });

  const sells = filtered.filter((trade) => trade.side === "SELL");
  const buys = filtered.filter((trade) => trade.side === "BUY");
  const errors = results.filter((result) => result.error);
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
    date,
    minProfitPct,
    generatedAtUtc,
    watchlistSize: watchlist.length,
    stocksScanned: results.length,
    stocksWithSignals,
    stocksInReport,
    scannedTrades: scannedTrades.length,
    tradesInReport: filtered.length,
    sellCount: sells.length,
    buyCount: buys.length,
    errorCount: errors.length,
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
      },
    },
    trades: filtered,
  };

  const lines = [
    `# Deeppro BUY + SELL square-off — ${formatDayLabel(date)} (profit ≥ ${minProfitPct}%)`,
    "",
    `- **Date:** ${date}`,
    `- **Rule:** deeppro (Stch Mtm exhaustion) — SELL overbought + BUY oversold mirror`,
    `- **Universe:** ${watchlist.length} sector-watchlist stocks`,
    `- **Entry price:** event candle mid \`(high + low) / 2\``,
    `- **Square-off:** best later same-day candle mid before \`${SESSION_END}\` IST`,
    `- **SELL profit %:** \`(sell - sq) / sell * 100\``,
    `- **BUY profit %:** \`(sq - buy) / buy * 100\``,
    `- **Filter:** profit ≥ ${minProfitPct}%`,
    `- **Stocks scanned:** ${results.length} · with signals: ${stocksWithSignals} · in report: ${stocksInReport}`,
    `- **Trades scanned:** ${scannedTrades.length}`,
    `- **Trades in report:** ${filtered.length} (${sells.length} SELL · ${buys.length} BUY)`,
    `- **Fetch errors:** ${errors.length}`,
    `- **Data:** ${source}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
  ];

  writeSideTable(lines, "SELL", "Sell price", sells);
  writeSideTable(lines, "BUY", "Buy price", buys);

  if (errors.length > 0) {
    lines.push("", "## Fetch errors", "");
    for (const result of errors) {
      lines.push(`- \`${result.entry.tradingSymbol}\` (${result.entry.sector}): ${result.error}`);
    }
    lines.push("");
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- Same-day square-off only; no overnight holds.",
    "- Kite Connect historical 15m only — same deeppro engine as Post-Mortem / Day Scan.",
    "- Deeppro quality gates enabled (favor same-day SQ ≥ ~0.75%): SELL event 10:45–12:30 + RSI/BB rules; BUY stall/OS-exit with BB-match recovery / morning unmatched proximity / extreme-stall paths.",
    "",
  );

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        date,
        minProfitPct,
        stocksScanned: results.length,
        stocksWithSignals,
        stocksInReport,
        scannedTrades: scannedTrades.length,
        tradesInReport: filtered.length,
        sellCount: sells.length,
        buyCount: buys.length,
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
