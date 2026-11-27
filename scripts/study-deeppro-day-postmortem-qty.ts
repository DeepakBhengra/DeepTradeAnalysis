#!/usr/bin/env node
/**
 * Deeppro Day Scan Post-Mortem for one date:
 * - Scan SECTOR_WATCHLIST (Day Scan universe)
 * - Enter each BUY/SELL at event mid with fixed quantity (default 100)
 * - Square-off at best AND worst later same-day mid before 15:15 IST
 * - Report profit side and loss side for each signal
 *
 * Usage:
 *   npx tsx scripts/study-deeppro-day-postmortem-qty.ts --date 2026-08-03 --qty 100
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
  quantity: number;
  limit: number;
} {
  let date = "2026-08-03";
  let quantity = 100;
  let limit = SECTOR_WATCHLIST.length;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--date" && argv[i + 1]) {
      date = argv[++i];
      continue;
    }
    if (arg === "--qty" && argv[i + 1]) {
      quantity = Math.max(1, Math.floor(Number(argv[++i])));
      continue;
    }
    if (arg === "--limit" && argv[i + 1]) {
      limit = Math.max(1, Number(argv[++i]));
      continue;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid --date ${date}. Use YYYY-MM-DD.`);
  }

  return { date, quantity, limit };
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
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function pnlPerShare(
  side: "BUY" | "SELL",
  entryPrice: number,
  exitPrice: number,
): number {
  return side === "SELL" ? entryPrice - exitPrice : exitPrice - entryPrice;
}

function squareOffRange(
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
  bestProfitPerShare: number | null;
  worstTimeIst: string | null;
  worstExitPrice: number | null;
  worstProfitPct: number | null;
  worstProfitPerShare: number | null;
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
      bestProfitPerShare: null,
      worstTimeIst: null,
      worstExitPrice: null,
      worstProfitPct: null,
      worstProfitPerShare: null,
    };
  }

  let bestTimeIst: string | null = null;
  let bestExitPrice: number | null = null;
  let bestProfitPct: number | null = null;
  let bestProfitPerShare: number | null = null;
  let worstTimeIst: string | null = null;
  let worstExitPrice: number | null = null;
  let worstProfitPct: number | null = null;
  let worstProfitPerShare: number | null = null;

  for (const snapshot of after) {
    const exitPrice = midPrice(snapshot);
    const perShare = pnlPerShare(side, entryPrice, exitPrice);
    const pct = (perShare / entryPrice) * 100;
    if (bestProfitPct == null || pct > bestProfitPct) {
      bestProfitPct = pct;
      bestProfitPerShare = perShare;
      bestExitPrice = exitPrice;
      bestTimeIst = formatIstTime(snapshot.timestamp);
    }
    if (worstProfitPct == null || pct < worstProfitPct) {
      worstProfitPct = pct;
      worstProfitPerShare = perShare;
      worstExitPrice = exitPrice;
      worstTimeIst = formatIstTime(snapshot.timestamp);
    }
  }

  return {
    hasExitWindow: true,
    bestTimeIst,
    bestExitPrice: bestExitPrice == null ? null : round(bestExitPrice),
    bestProfitPct: bestProfitPct == null ? null : round(bestProfitPct),
    bestProfitPerShare:
      bestProfitPerShare == null ? null : round(bestProfitPerShare),
    worstTimeIst,
    worstExitPrice: worstExitPrice == null ? null : round(worstExitPrice),
    worstProfitPct: worstProfitPct == null ? null : round(worstProfitPct),
    worstProfitPerShare:
      worstProfitPerShare == null ? null : round(worstProfitPerShare),
  };
}

interface TradeRow {
  stock: string;
  sector: string;
  signal: "BUY" | "SELL";
  signalTimeIst: string;
  eventKind: string;
  entryPrice: number;
  quantity: number;
  hasExitWindow: boolean;
  bestTimeIst: string | null;
  bestExitPrice: number | null;
  bestProfitPct: number | null;
  bestProfitInr: number | null;
  worstTimeIst: string | null;
  worstExitPrice: number | null;
  worstProfitPct: number | null;
  worstProfitInr: number | null;
}

function toTradeRow(
  entry: SectorWatchlistEntry,
  signal: DeepproSignal,
  snapshots: IndicatorSnapshot[],
  quantity: number,
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
  const sq = squareOffRange(
    snapshots,
    signal.dateKey,
    signal.eventTimeIst,
    signal.side,
    entryPrice,
  );

  return {
    stock: entry.tradingSymbol,
    sector: entry.sector,
    signal: signal.side,
    signalTimeIst: signal.eventTimeIst,
    eventKind: signal.eventKind,
    entryPrice,
    quantity,
    hasExitWindow: sq.hasExitWindow,
    bestTimeIst: sq.bestTimeIst,
    bestExitPrice: sq.bestExitPrice,
    bestProfitPct: sq.bestProfitPct,
    bestProfitInr:
      sq.bestProfitPerShare == null
        ? null
        : round(sq.bestProfitPerShare * quantity),
    worstTimeIst: sq.worstTimeIst,
    worstExitPrice: sq.worstExitPrice,
    worstProfitPct: sq.worstProfitPct,
    worstProfitInr:
      sq.worstProfitPerShare == null
        ? null
        : round(sq.worstProfitPerShare * quantity),
  };
}

function formatInr(value: number | null, hasExit: boolean): string {
  if (!hasExit || value == null) return "no exit";
  return `**${value.toFixed(2)}**`;
}

function formatPct(value: number | null, hasExit: boolean): string {
  if (!hasExit || value == null) return "—";
  return `${value.toFixed(2)}%`;
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

async function main(): Promise<void> {
  const { date, quantity, limit } = parseArgs(process.argv.slice(2));
  const watchlist = SECTOR_WATCHLIST.slice(0, limit);
  const concurrency = Math.max(1, config.dayScanConcurrency);

  console.log(
    JSON.stringify({
      phase: "start",
      date,
      quantity,
      stocks: watchlist.length,
      concurrency,
      mode: "best-and-worst-square-off",
      lengthEma: config.deeppro.smi.lengthEma,
      signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
    }),
  );

  type ScanResult = {
    entry: SectorWatchlistEntry;
    trades: TradeRow[];
    error: string | null;
  };

  const results = await mapPool(watchlist, concurrency, async (entry, index) => {
    try {
      const dash = resolveDashboardSymbol(entry.tradingSymbol);
      const candles = await fetchPnbCandles({
        symbol: dash.tradingSymbol,
        exchange: dash.exchange,
        segment: dash.segment,
        fromDate: date,
        toDate: date,
        kiteRetries: Math.max(config.dayScanKiteRetries, 3),
      });
      const snapshots = buildIndicatorSnapshots(candles);
      const day = evaluateDeepproDay(snapshots, date);
      const trades = day.signals
        .map((signal) => toTradeRow(entry, signal, snapshots, quantity))
        .filter((row): row is TradeRow => row != null);

      if ((index + 1) % 10 === 0 || index === 0 || index === watchlist.length - 1) {
        console.log(
          `[deeppro-pm] ${index + 1}/${watchlist.length} ${entry.tradingSymbol} signals=${trades.length}`,
        );
      }

      return { entry, trades, error: null } satisfies ScanResult;
    } catch (error) {
      const message = formatUnknownError(error);
      console.log(
        `[deeppro-pm] ${index + 1}/${watchlist.length} ${entry.tradingSymbol} ERROR ${message}`,
      );
      return { entry, trades: [], error: message } satisfies ScanResult;
    }
  });

  const trades = results
    .flatMap((r) => r.trades)
    .sort((a, b) => {
      const profitDiff =
        (b.bestProfitInr ?? Number.NEGATIVE_INFINITY) -
        (a.bestProfitInr ?? Number.NEGATIVE_INFINITY);
      if (profitDiff !== 0) return profitDiff;
      return a.stock.localeCompare(b.stock);
    });

  const errors = results.filter((r) => r.error);
  const sells = trades.filter((t) => t.signal === "SELL");
  const buys = trades.filter((t) => t.signal === "BUY");
  const profitTrades = trades
    .filter((t) => (t.bestProfitInr ?? 0) > 0)
    .sort(
      (a, b) => (b.bestProfitInr ?? 0) - (a.bestProfitInr ?? 0),
    );
  const lossTrades = trades
    .filter((t) => (t.worstProfitInr ?? 0) < 0)
    .sort(
      (a, b) => (a.worstProfitInr ?? 0) - (b.worstProfitInr ?? 0),
    );

  const totalBestProfitInr = round(
    trades.reduce((sum, t) => sum + (t.bestProfitInr ?? 0), 0),
  );
  const totalWorstProfitInr = round(
    trades.reduce((sum, t) => sum + (t.worstProfitInr ?? 0), 0),
  );
  const profitSideTotal = round(
    profitTrades.reduce((sum, t) => sum + (t.bestProfitInr ?? 0), 0),
  );
  const lossSideTotal = round(
    lossTrades.reduce((sum, t) => sum + (t.worstProfitInr ?? 0), 0),
  );
  const generatedAtUtc = new Date().toISOString();
  const dayLabel = formatDayLabel(date);

  mkdirSync(REPORTS_DIR, { recursive: true });
  const base = `deeppro-postmortem-${date}-qty${quantity}-pnl`;
  const jsonPath = resolve(REPORTS_DIR, `${base}.json`);
  const mdPath = resolve(REPORTS_DIR, `${base}.md`);

  const payload = {
    rule: "deeppro",
    mode: "day-scan-post-mortem-pnl",
    date,
    quantity,
    watchlistSize: watchlist.length,
    stocksScanned: results.length,
    signalCount: trades.length,
    sellCount: sells.length,
    buyCount: buys.length,
    profitTradeCount: profitTrades.length,
    lossTradeCount: lossTrades.length,
    totalBestProfitInr,
    totalWorstProfitInr,
    profitSideTotal,
    lossSideTotal,
    squareOffRule: `Best and worst later same-day candle mid before ${SESSION_END} IST`,
    entryRule: "Event candle mid (high+low)/2 at SMI↔signal cross",
    deeppro: {
      lengthEma: config.deeppro.smi.lengthEma,
      signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
      qualityFilterEnabled: config.deeppro.qualityFilter.enabled,
    },
    generatedAtUtc,
    errorCount: errors.length,
    errors: errors.map((r) => ({
      stock: r.entry.tradingSymbol,
      sector: r.entry.sector,
      error: r.error,
    })),
    trades,
    profitTrades,
    lossTrades,
  };

  const lines = [
    `# Deeppro Day Scan Post-Mortem — ${dayLabel} (qty ${quantity}, profit & loss)`,
    "",
    `- **Date:** ${date}`,
    `- **Universe:** ${watchlist.length} Day Scan stocks (\`SECTOR_WATCHLIST\`)`,
    `- **Rule:** deeppro — SMI↔signal cross/touch · signal EMA(10) · no angle gate · quality gates on`,
    `- **Entry:** event candle mid \`(high+low)/2\` at signal time`,
    `- **Quantity:** **${quantity}** shares per signal`,
    `- **Best square-off:** highest later same-day mid P&L before \`${SESSION_END}\` IST`,
    `- **Worst square-off:** lowest later same-day mid P&L before \`${SESSION_END}\` IST`,
    `- **BUY P&L ₹:** \`(sq - entry) × qty\``,
    `- **SELL P&L ₹:** \`(entry - sq) × qty\``,
    `- **Signals:** ${trades.length} (${sells.length} SELL · ${buys.length} BUY)`,
    `- **Best-case total P&L:** **₹${totalBestProfitInr.toFixed(2)}**`,
    `- **Worst-case total P&L:** **₹${totalWorstProfitInr.toFixed(2)}**`,
    `- **Profit trades (best > 0):** ${profitTrades.length} · ₹${profitSideTotal.toFixed(2)}`,
    `- **Loss trades (worst < 0):** ${lossTrades.length} · ₹${lossSideTotal.toFixed(2)}`,
    `- **Fetch errors:** ${errors.length}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## All trades (best vs worst)",
    "",
    "| Stock | Signal | Signal time | Entry | Best SQ time | Best SQ | Best ₹ | Worst SQ time | Worst SQ | Worst ₹ |",
    "|-------|--------|-------------|-------|--------------|---------|--------|---------------|----------|---------|",
  ];

  if (trades.length === 0) {
    lines.push("| — | — | — | — | — | — | *none* | — | — | — |");
  } else {
    for (const t of trades) {
      lines.push(
        `| ${t.stock} | ${t.signal} | ${t.signalTimeIst} | ${t.entryPrice.toFixed(2)} | ${t.bestTimeIst ?? "—"} | ${t.bestExitPrice?.toFixed(2) ?? "—"} | ${formatInr(t.bestProfitInr, t.hasExitWindow)} | ${t.worstTimeIst ?? "—"} | ${t.worstExitPrice?.toFixed(2) ?? "—"} | ${formatInr(t.worstProfitInr, t.hasExitWindow)} |`,
      );
    }
  }

  lines.push(
    "",
    "## Profit trades (best square-off > 0)",
    "",
    "| Stock | Signal | Signal time | Entry | Best SQ time | Best SQ | Best ₹ | Best % |",
    "|-------|--------|-------------|-------|--------------|---------|--------|--------|",
  );
  if (profitTrades.length === 0) {
    lines.push("| — | — | — | — | — | — | *none* | — |");
  } else {
    for (const t of profitTrades) {
      lines.push(
        `| ${t.stock} | ${t.signal} | ${t.signalTimeIst} | ${t.entryPrice.toFixed(2)} | ${t.bestTimeIst ?? "—"} | ${t.bestExitPrice?.toFixed(2) ?? "—"} | ${formatInr(t.bestProfitInr, t.hasExitWindow)} | ${formatPct(t.bestProfitPct, t.hasExitWindow)} |`,
      );
    }
  }

  lines.push(
    "",
    "## Loss trades (worst square-off < 0)",
    "",
    "| Stock | Signal | Signal time | Entry | Worst SQ time | Worst SQ | Worst ₹ | Worst % |",
    "|-------|--------|-------------|-------|---------------|----------|---------|---------|",
  );
  if (lossTrades.length === 0) {
    lines.push("| — | — | — | — | — | — | *none* | — |");
  } else {
    for (const t of lossTrades) {
      lines.push(
        `| ${t.stock} | ${t.signal} | ${t.signalTimeIst} | ${t.entryPrice.toFixed(2)} | ${t.worstTimeIst ?? "—"} | ${t.worstExitPrice?.toFixed(2) ?? "—"} | ${formatInr(t.worstProfitInr, t.hasExitWindow)} | ${formatPct(t.worstProfitPct, t.hasExitWindow)} |`,
      );
    }
  }

  lines.push(
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Signals | ${trades.length} (${sells.length} SELL · ${buys.length} BUY) |`,
    `| Best-case total P&L | **₹${totalBestProfitInr.toFixed(2)}** |`,
    `| Worst-case total P&L | **₹${totalWorstProfitInr.toFixed(2)}** |`,
    `| Profit trades (best > 0) | ${profitTrades.length} · ₹${profitSideTotal.toFixed(2)} |`,
    `| Loss trades (worst < 0) | ${lossTrades.length} · ₹${lossSideTotal.toFixed(2)} |`,
    `| SELL best-case | ₹${round(sells.reduce((s, t) => s + (t.bestProfitInr ?? 0), 0)).toFixed(2)} |`,
    `| BUY best-case | ₹${round(buys.reduce((s, t) => s + (t.bestProfitInr ?? 0), 0)).toFixed(2)} |`,
    `| SELL worst-case | ₹${round(sells.reduce((s, t) => s + (t.worstProfitInr ?? 0), 0)).toFixed(2)} |`,
    `| BUY worst-case | ₹${round(buys.reduce((s, t) => s + (t.worstProfitInr ?? 0), 0)).toFixed(2)} |`,
    "",
  );

  if (errors.length > 0) {
    lines.push("## Fetch errors", "");
    for (const r of errors) {
      lines.push(`- \`${r.entry.tradingSymbol}\`: ${r.error}`);
    }
    lines.push("");
  }

  lines.push(
    "## Notes",
    "",
    "- Post-mortem uses the same Deeppro engine as Day Scan / Post-Mortem UI.",
    "- No black-line slope / angle gate on BUY or SELL (cross/touch + quality gates only).",
    "- **Best** = most favorable same-day mid after entry; **Worst** = least favorable same-day mid after entry (both before 15:15).",
    "- Not a live fill guarantee — shows the P&L envelope if squared off on any later 15m mid.",
    "- Kite Connect historical 15m only.",
    "",
  );

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(mdPath, `${lines.join("\n")}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        date,
        quantity,
        stocksScanned: results.length,
        signalCount: trades.length,
        sellCount: sells.length,
        buyCount: buys.length,
        profitTradeCount: profitTrades.length,
        lossTradeCount: lossTrades.length,
        totalBestProfitInr,
        totalWorstProfitInr,
        profitSideTotal,
        lossSideTotal,
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
