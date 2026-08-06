#!/usr/bin/env node
/**
 * Deeppro single-symbol multi-day post-mortem with fixed qty P&L.
 *
 * - Last N trading session days (default 60)
 * - Enter each BUY/SELL at event mid with fixed quantity (default 100)
 * - Square-off at best later same-day mid before 15:15 IST
 * - Report date, signal, entry, SQ, profit ₹ / %
 *
 * Usage:
 *   npx tsx scripts/study-deeppro-symbol-postmortem-qty.ts --symbol AUROPHARMA --trade-days 60 --qty 100
 */
import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectDeepproTradingDates } from "../src/backtest/runDeepproBacktest.js";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { evaluateDeepproDay } from "../src/rules/deepproDecision.js";
import type { DeepproSignal, IndicatorSnapshot } from "../src/types.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SESSION_END = "15:15";

function parseArgs(argv: string[]): {
  symbol: string;
  tradeDays: number;
  quantity: number;
} {
  let symbol = "AUROPHARMA";
  let tradeDays = 60;
  let quantity = 100;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--symbol" && argv[i + 1]) {
      symbol = argv[++i];
      continue;
    }
    if (arg === "--trade-days" && argv[i + 1]) {
      tradeDays = Math.max(1, Math.floor(Number(argv[++i])));
      continue;
    }
    if (arg === "--qty" && argv[i + 1]) {
      quantity = Math.max(1, Math.floor(Number(argv[++i])));
      continue;
    }
  }

  return { symbol, tradeDays, quantity };
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
  date: string;
  dateKey: string;
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
  stock: string,
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
    stock,
    date: formatDayLabel(signal.dateKey),
    dateKey: signal.dateKey,
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

async function main(): Promise<void> {
  const { symbol, tradeDays, quantity } = parseArgs(process.argv.slice(2));
  const dashboardSymbol = resolveDashboardSymbol(symbol);

  // Calendar span: ~2× trade days for weekends/holidays + warmup padding for indicators.
  const toDate = new Date();
  const lookbackDays = Math.min(Math.max(tradeDays * 2 + 40, 120), 180);
  const fromDate = new Date(toDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fromKey = fromDate.toISOString().slice(0, 10);
  const toKey = toDate.toISOString().slice(0, 10);

  console.log(
    JSON.stringify({
      phase: "start",
      symbol: dashboardSymbol.tradingSymbol,
      tradeDays,
      quantity,
      fromKey,
      toKey,
      minSellSmiAngleDeg: config.deeppro.minSellSmiAngleDeg,
      minBuySmiAngleDeg: config.deeppro.minBuySmiAngleDeg,
      lengthEma: config.deeppro.smi.lengthEma,
    }),
  );

  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    fromDate: fromKey,
    toDate: toKey,
    kiteRetries: Math.max(config.dayScanKiteRetries, 3),
  });
  const snapshots = buildIndicatorSnapshots(candles);
  const allDates = collectDeepproTradingDates(snapshots);
  const targetDates = allDates.slice(-tradeDays);

  const trades: TradeRow[] = [];
  for (const dateKey of targetDates) {
    const day = evaluateDeepproDay(snapshots, dateKey);
    for (const signal of day.signals) {
      const row = toTradeRow(
        dashboardSymbol.tradingSymbol,
        signal,
        snapshots,
        quantity,
      );
      if (row) trades.push(row);
    }
  }

  trades.sort((a, b) => {
    const byDate = a.dateKey.localeCompare(b.dateKey);
    if (byDate !== 0) return byDate;
    return a.signalTimeIst.localeCompare(b.signalTimeIst);
  });

  const sells = trades.filter((t) => t.signal === "SELL");
  const buys = trades.filter((t) => t.signal === "BUY");
  const totalProfitInr = round(
    trades.reduce((sum, t) => sum + (t.profitInr ?? 0), 0),
  );
  const winCount = trades.filter((t) => (t.profitInr ?? 0) > 0).length;
  const lossCount = trades.filter((t) => (t.profitInr ?? 0) < 0).length;
  const generatedAtUtc = new Date().toISOString();
  const windowFrom = targetDates[0] ?? fromKey;
  const windowTo = targetDates[targetDates.length - 1] ?? toKey;

  mkdirSync(REPORTS_DIR, { recursive: true });
  const base = `deeppro-postmortem-${dashboardSymbol.tradingSymbol.toLowerCase()}-${tradeDays}d-qty${quantity}`;
  const jsonPath = resolve(REPORTS_DIR, `${base}.json`);
  const mdPath = resolve(REPORTS_DIR, `${base}.md`);
  const source = `Kite Connect historical (${dashboardSymbol.exchange}:${dashboardSymbol.tradingSymbol}, 15minute)`;

  const payload = {
    rule: "deeppro",
    mode: "symbol-post-mortem",
    symbol: dashboardSymbol.tradingSymbol,
    quantity,
    tradeDaysRequested: tradeDays,
    tradeDaysScanned: targetDates.length,
    window: { from: windowFrom, to: windowTo },
    signalCount: trades.length,
    sellCount: sells.length,
    buyCount: buys.length,
    winCount,
    lossCount,
    totalProfitInr,
    squareOffRule: `Best later same-day candle mid before ${SESSION_END} IST`,
    entryRule: "Event candle mid (high+low)/2 at SMI↔signal cross",
    deeppro: {
      lengthEma: config.deeppro.smi.lengthEma,
      minSellSmiAngleDeg: config.deeppro.minSellSmiAngleDeg,
      minBuySmiAngleDeg: config.deeppro.minBuySmiAngleDeg,
      signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
    },
    data: {
      source,
      candleCount: candles.length,
      dateCount: allDates.length,
    },
    generatedAtUtc,
    trades,
  };

  const lines = [
    `# Deeppro Post-Mortem — ${dashboardSymbol.tradingSymbol} · last ${targetDates.length}d (qty ${quantity})`,
    "",
    `- **Symbol:** ${dashboardSymbol.tradingSymbol}`,
    `- **Window:** ${targetDates.length} trade days (${windowFrom} → ${windowTo})`,
    `- **Rule:** deeppro — SMI↔signal cross/touch · signal EMA(10) · black slope ≥${config.deeppro.minSellSmiAngleDeg}° · quality gates on`,
    `- **Entry:** event candle mid \`(high+low)/2\` at signal time`,
    `- **Quantity:** **${quantity}** shares per signal`,
    `- **Square-off signal:** best later same-day mid before \`${SESSION_END}\` IST`,
    `- **BUY profit ₹:** \`(sq - entry) × qty\``,
    `- **SELL profit ₹:** \`(entry - sq) × qty\``,
    `- **Signals:** ${trades.length} (${sells.length} SELL · ${buys.length} BUY)`,
    `- **Wins / losses:** ${winCount} / ${lossCount}`,
    `- **Total P&L:** **₹${totalProfitInr.toFixed(2)}**`,
    `- **Data:** ${source}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Trades",
    "",
    "| Date | Stock | Signal | Signal time | Buy/Sell price | Square-off time | Square-off price | Qty | Profit ₹ | Profit % |",
    "|------|-------|--------|-------------|----------------|-----------------|------------------|-----|----------|----------|",
  ];

  if (trades.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | *none* | — |");
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
        `| ${t.date} | ${t.stock} | ${t.signal} | ${t.signalTimeIst} | ${t.entryPrice.toFixed(2)} | ${t.squareOffTimeIst ?? "—"} | ${t.squareOffPrice?.toFixed(2) ?? "—"} | ${t.quantity} | ${profitInr} | ${profitPct} |`,
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
    "## Notes",
    "",
    "- Same Deeppro engine as Day Scan / Post-Mortem UI.",
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
        symbol: dashboardSymbol.tradingSymbol,
        tradeDaysScanned: targetDates.length,
        window: { from: windowFrom, to: windowTo },
        quantity,
        signalCount: trades.length,
        sellCount: sells.length,
        buyCount: buys.length,
        winCount,
        lossCount,
        totalProfitInr,
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
