#!/usr/bin/env node
/**
 * Deeppro Day Scan Post-Mortem for one date:
 * - Scan SECTOR_WATCHLIST (Day Scan universe)
 * - Enter each BUY/SELL at event mid with fixed quantity (default 100)
 * - Square-off at best later same-day mid before 15:15 IST
 * - Report stock, signal, entry price, SQ price, profit (₹ + %)
 *
 * Usage:
 *   npx tsx scripts/study-deeppro-day-postmortem-qty.ts --date 2026-07-27 --qty 100
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
  let date = "2026-07-27";
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

function bestSquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  eventTimeIst: string,
  side: "BUY" | "SELL",
  entryPrice: number,
): {
  hasExitWindow: boolean;
  squareOffTimeIst: string | null;
  squareOffPrice: number | null;
  profitPct: number | null;
  profitPerShare: number | null;
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
      squareOffTimeIst: null,
      squareOffPrice: null,
      profitPct: null,
      profitPerShare: null,
    };
  }

  let squareOffTimeIst: string | null = null;
  let squareOffPrice: number | null = null;
  let profitPct: number | null = null;
  let profitPerShare: number | null = null;

  for (const snapshot of after) {
    const exitPrice = midPrice(snapshot);
    const perShare =
      side === "SELL" ? entryPrice - exitPrice : exitPrice - entryPrice;
    const pct = (perShare / entryPrice) * 100;
    if (profitPct == null || pct > profitPct) {
      profitPct = pct;
      profitPerShare = perShare;
      squareOffPrice = exitPrice;
      squareOffTimeIst = formatIstTime(snapshot.timestamp);
    }
  }

  return {
    hasExitWindow: true,
    squareOffTimeIst,
    squareOffPrice: squareOffPrice == null ? null : round(squareOffPrice),
    profitPct: profitPct == null ? null : round(profitPct),
    profitPerShare: profitPerShare == null ? null : round(profitPerShare),
  };
}

interface TradeRow {
  stock: string;
  sector: string;
  signal: "BUY" | "SELL";
  signalTimeIst: string;
  eventKind: string;
  entryPrice: number;
  squareOffTimeIst: string | null;
  squareOffPrice: number | null;
  quantity: number;
  profitPct: number | null;
  profitInr: number | null;
  hasExitWindow: boolean;
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
  const sq = bestSquareOff(
    snapshots,
    signal.dateKey,
    signal.eventTimeIst,
    signal.side,
    entryPrice,
  );

  const profitInr =
    sq.profitPerShare == null ? null : round(sq.profitPerShare * quantity);

  return {
    stock: entry.tradingSymbol,
    sector: entry.sector,
    signal: signal.side,
    signalTimeIst: signal.eventTimeIst,
    eventKind: signal.eventKind,
    entryPrice,
    squareOffTimeIst: sq.squareOffTimeIst,
    squareOffPrice: sq.squareOffPrice,
    quantity,
    profitPct: sq.profitPct,
    profitInr,
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
      minSellSmiAngleDeg: config.deeppro.minSellSmiAngleDeg,
      minBuySmiAngleDeg: config.deeppro.minBuySmiAngleDeg,
      lengthEma: config.deeppro.smi.lengthEma,
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
      const profitDiff = (b.profitInr ?? Number.NEGATIVE_INFINITY) - (a.profitInr ?? Number.NEGATIVE_INFINITY);
      if (profitDiff !== 0) return profitDiff;
      return a.stock.localeCompare(b.stock);
    });

  const errors = results.filter((r) => r.error);
  const sells = trades.filter((t) => t.signal === "SELL");
  const buys = trades.filter((t) => t.signal === "BUY");
  const totalProfitInr = round(
    trades.reduce((sum, t) => sum + (t.profitInr ?? 0), 0),
  );
  const generatedAtUtc = new Date().toISOString();
  const dayLabel = formatDayLabel(date);

  mkdirSync(REPORTS_DIR, { recursive: true });
  const base = `deeppro-postmortem-${date}-qty${quantity}`;
  const jsonPath = resolve(REPORTS_DIR, `${base}.json`);
  const mdPath = resolve(REPORTS_DIR, `${base}.md`);

  const payload = {
    rule: "deeppro",
    mode: "day-scan-post-mortem",
    date,
    quantity,
    watchlistSize: watchlist.length,
    stocksScanned: results.length,
    signalCount: trades.length,
    sellCount: sells.length,
    buyCount: buys.length,
    totalProfitInr,
    squareOffRule: `Best later same-day candle mid before ${SESSION_END} IST`,
    entryRule: "Event candle mid (high+low)/2 at SMI↔signal cross",
    deeppro: {
      lengthEma: config.deeppro.smi.lengthEma,
      minSellSmiAngleDeg: config.deeppro.minSellSmiAngleDeg,
      minBuySmiAngleDeg: config.deeppro.minBuySmiAngleDeg,
      signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
    },
    generatedAtUtc,
    errorCount: errors.length,
    errors: errors.map((r) => ({
      stock: r.entry.tradingSymbol,
      sector: r.entry.sector,
      error: r.error,
    })),
    trades,
  };

  const lines = [
    `# Deeppro Day Scan Post-Mortem — ${dayLabel} (qty ${quantity})`,
    "",
    `- **Date:** ${date}`,
    `- **Universe:** ${watchlist.length} Day Scan stocks (\`SECTOR_WATCHLIST\`)`,
    `- **Rule:** deeppro — SMI↔signal cross/touch · signal EMA(10) · black slope ≥${config.deeppro.minSellSmiAngleDeg}° · quality gates on`,
    `- **Entry:** event candle mid \`(high+low)/2\` at signal time`,
    `- **Quantity:** **${quantity}** shares per signal`,
    `- **Square-off signal:** best later same-day mid before \`${SESSION_END}\` IST`,
    `- **BUY profit ₹:** \`(sq - entry) × qty\``,
    `- **SELL profit ₹:** \`(entry - sq) × qty\``,
    `- **Signals:** ${trades.length} (${sells.length} SELL · ${buys.length} BUY)`,
    `- **Total P&L:** **₹${totalProfitInr.toFixed(2)}**`,
    `- **Fetch errors:** ${errors.length}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Trades",
    "",
    "| Stock | Signal | Signal time | Buy/Sell price | Square-off time | Square-off price | Qty | Profit ₹ | Profit % |",
    "|-------|--------|-------------|----------------|-----------------|------------------|-----|----------|----------|",
  ];

  if (trades.length === 0) {
    lines.push("| — | — | — | — | — | — | — | *none* | — |");
  } else {
    for (const t of trades) {
      const profitInr =
        !t.hasExitWindow || t.profitInr == null
          ? "no exit"
          : `**${t.profitInr.toFixed(2)}**`;
      const profitPct =
        !t.hasExitWindow || t.profitPct == null
          ? "—"
          : `${t.profitPct.toFixed(2)}%`;
      lines.push(
        `| ${t.stock} | ${t.signal} | ${t.signalTimeIst} | ${t.entryPrice.toFixed(2)} | ${t.squareOffTimeIst ?? "—"} | ${t.squareOffPrice?.toFixed(2) ?? "—"} | ${t.quantity} | ${profitInr} | ${profitPct} |`,
      );
    }
  }

  lines.push(
    "",
    "## Summary by side",
    "",
    `| Side | Trades | Total profit ₹ |`,
    `|------|--------|----------------|`,
    `| SELL | ${sells.length} | ${round(sells.reduce((s, t) => s + (t.profitInr ?? 0), 0)).toFixed(2)} |`,
    `| BUY | ${buys.length} | ${round(buys.reduce((s, t) => s + (t.profitInr ?? 0), 0)).toFixed(2)} |`,
    `| **All** | **${trades.length}** | **${totalProfitInr.toFixed(2)}** |`,
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
    "- Square-off is the best achievable same-day mid after entry (not a live fill guarantee).",
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
        totalProfitInr,
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
