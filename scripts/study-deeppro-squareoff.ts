#!/usr/bin/env node
/**
 * deeppro BUY + SELL same-day square-off study — Kite historical 15m only.
 *
 * Entry: event-candle mid (high+low)/2
 * Square-off: best later same-day mid before sessionEnd (default 15:15 IST)
 * SELL profit %: (entry - exit) / entry * 100
 * BUY profit %: (exit - entry) / entry * 100
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
  minProfitPct: number | null;
  tag: string;
} {
  let symbol = "SUNPHARMA";
  let tradeDays = 60;
  let minProfitPct: number | null = null;
  let tag: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--symbol" && argv[i + 1]) {
      symbol = argv[++i];
      continue;
    }
    if (arg === "--trade-days" && argv[i + 1]) {
      tradeDays = Math.max(1, Number(argv[++i]));
      continue;
    }
    if (arg === "--min-profit" && argv[i + 1]) {
      minProfitPct = Number(argv[++i]);
      continue;
    }
    if (arg === "--tag" && argv[i + 1]) {
      tag = argv[++i];
      continue;
    }
  }

  const profitTag = minProfitPct != null ? `-gte${String(minProfitPct)}` : "";
  return {
    symbol,
    tradeDays,
    minProfitPct,
    tag: tag ?? `buy-sell${profitTag}-${tradeDays}d`,
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
  eodTimeIst: string | null;
  eodExitPrice: number | null;
  eodProfitPct: number | null;
  positive: boolean;
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
      eodTimeIst: null,
      eodExitPrice: null,
      eodProfitPct: null,
      positive: false,
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

  const eod = after[after.length - 1];
  const eodExitPrice = midPrice(eod);
  const eodProfitPct =
    side === "SELL"
      ? ((entryPrice - eodExitPrice) / entryPrice) * 100
      : ((eodExitPrice - entryPrice) / entryPrice) * 100;

  return {
    hasExitWindow: true,
    bestTimeIst,
    bestExitPrice: bestExitPrice == null ? null : round(bestExitPrice),
    bestProfitPct: bestProfitPct == null ? null : round(bestProfitPct),
    eodTimeIst: formatIstTime(eod.timestamp),
    eodExitPrice: round(eodExitPrice),
    eodProfitPct: round(eodProfitPct),
    positive: (bestProfitPct ?? 0) > 0,
  };
}

function findEventSnapshot(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  eventTimeIst: string,
): IndicatorSnapshot | null {
  return (
    snapshots.find((snapshot) => {
      const parts = getIstTimeParts(snapshot.timestamp);
      return (
        parts.dateKey === dateKey && formatIstTime(snapshot.timestamp) === eventTimeIst
      );
    }) ?? null
  );
}

interface TradeRow {
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
  eodTimeIst: string | null;
  eodExitPrice: number | null;
  eodProfitPct: number | null;
  hasExitWindow: boolean;
  positive: boolean;
  peakSmi: number;
}

function formatBbPct(gapPct: number, matchType: string | null): string {
  const base = gapPct.toFixed(3);
  return matchType ? `${base} (${matchType})` : base;
}

function formatProfitCell(trade: TradeRow): string {
  if (!trade.hasExitWindow) {
    return "no exit window";
  }
  if (trade.bestProfitPct == null) {
    return "—";
  }
  return `${trade.bestProfitPct.toFixed(2)}%`;
}

function toTradeRow(
  signal: DeepproSignal,
  snapshots: IndicatorSnapshot[],
): TradeRow | null {
  const eventSnapshot = findEventSnapshot(
    snapshots,
    signal.dateKey,
    signal.eventTimeIst,
  );
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
    eodTimeIst: sq.eodTimeIst,
    eodExitPrice: sq.eodExitPrice,
    eodProfitPct: sq.eodProfitPct,
    hasExitWindow: sq.hasExitWindow,
    positive: sq.positive,
    peakSmi: round(signal.peakSmi, 1),
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
    `| Date | Event | RSI | BB upper % | BB lower % | ${priceHeader} | Best SQ off | SQ price | Profit % |`,
    "|------|-------|-----|------------|------------|------------|-------------|----------|----------|",
  );

  if (trades.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | *none* |");
    return;
  }

  for (const trade of trades) {
    if (!trade.hasExitWindow) {
      lines.push(
        `| ${trade.date} | ${trade.event} | ${trade.eventRsi.toFixed(2)} | ${formatBbPct(trade.bbUpperGapPct, trade.bbUpperMatchType)} | ${formatBbPct(trade.bbLowerGapPct, trade.bbLowerMatchType)} | ${trade.entryPrice.toFixed(2)} | — | — | no exit window |`,
      );
      continue;
    }
    lines.push(
      `| ${trade.date} | ${trade.event} | ${trade.eventRsi.toFixed(2)} | ${formatBbPct(trade.bbUpperGapPct, trade.bbUpperMatchType)} | ${formatBbPct(trade.bbLowerGapPct, trade.bbLowerMatchType)} | ${trade.entryPrice.toFixed(2)} | ${trade.bestTimeIst ?? "—"} | ${trade.bestExitPrice?.toFixed(2) ?? "—"} | ${formatProfitCell(trade)} |`,
    );
  }
}

function writeMarkdown(payload: {
  symbol: string;
  titleSuffix: string;
  generatedAtUtc: string;
  window: { from: string; to: string; tradeDays: number };
  summary: {
    trades: number;
    sellCount: number;
    buyCount: number;
    minProfitPct: number | null;
    scannedTrades: number;
  };
  trades: TradeRow[];
  source: string;
}): string {
  const { trades, summary } = payload;
  const sells = trades.filter((trade) => trade.side === "SELL");
  const buys = trades.filter((trade) => trade.side === "BUY");
  const profitFilter =
    summary.minProfitPct == null
      ? "all trades"
      : `profit ≥ ${summary.minProfitPct}%`;

  const lines = [
    `# ${payload.symbol} deeppro BUY + SELL square-off (${payload.titleSuffix})`,
    "",
    `- **Symbol:** ${payload.symbol}`,
    `- **Rule:** deeppro (Stch Mtm exhaustion) — SELL overbought + BUY oversold mirror`,
    `- **Entry price:** event candle mid \`(high + low) / 2\``,
    `- **Square-off:** best later same-day candle mid before \`${SESSION_END}\` IST`,
    `- **SELL profit %:** \`(sell - sq) / sell * 100\``,
    `- **BUY profit %:** \`(sq - buy) / buy * 100\``,
    `- **Window:** last ${summary.scannedTrades} deeppro trades (${payload.window.from} → ${payload.window.to})`,
    `- **Filter:** ${profitFilter}`,
    `- **Trades in report:** ${summary.trades} (${summary.sellCount} SELL · ${summary.buyCount} BUY)`,
    `- **Data:** ${payload.source}`,
    `- **Generated (UTC):** ${payload.generatedAtUtc}`,
  ];

  writeSideTable(lines, "SELL", "Sell price", sells);
  writeSideTable(lines, "BUY", "Buy price", buys);

  lines.push(
    "",
    "## Notes",
    "",
    "- Same-day square-off only; no overnight holds.",
    "- Kite Connect historical 15m only — same deeppro engine as Post-Mortem / Day Scan.",
    "",
  );

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const { symbol, tradeDays, minProfitPct, tag } = parseArgs(process.argv.slice(2));
  const dashboardSymbol = resolveDashboardSymbol(symbol);

  // Wide calendar span so we can assemble the newest N deeppro trades.
  // Kite 15m history caps around 200 calendar days including warmup padding.
  const toDate = new Date();
  const fromDate = new Date(
    toDate.getTime() - Math.min(Math.max(tradeDays * 2, 90), 150) * 24 * 60 * 60 * 1000,
  );
  const fromKey = fromDate.toISOString().slice(0, 10);
  const toKey = toDate.toISOString().slice(0, 10);

  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    fromDate: fromKey,
    toDate: toKey,
  });
  const snapshots = buildIndicatorSnapshots(candles);
  const targetDates = collectDeepproTradingDates(snapshots);

  const scanned: TradeRow[] = [];
  for (const dateKey of targetDates) {
    const day = evaluateDeepproDay(snapshots, dateKey);
    for (const signal of day.signals) {
      const row = toTradeRow(signal, snapshots);
      if (row) {
        scanned.push(row);
      }
    }
  }

  // Newest N deeppro trades (BUY + SELL), then optional profit filter.
  scanned.sort((left, right) => {
    const byDate = left.dateKey.localeCompare(right.dateKey);
    if (byDate !== 0) {
      return byDate;
    }
    return left.event.localeCompare(right.event);
  });
  const lastTrades = scanned.slice(-tradeDays);

  const trades = lastTrades.filter((row) => {
    if (minProfitPct == null) {
      return true;
    }
    // Inclusive threshold (0.80% counts for "more than / at least 0.8").
    return row.bestProfitPct != null && row.bestProfitPct >= minProfitPct;
  });

  mkdirSync(REPORTS_DIR, { recursive: true });
  const base = `deeppro-${dashboardSymbol.tradingSymbol.toLowerCase()}-${tag}`;
  const jsonPath = resolve(REPORTS_DIR, `${base}.json`);
  const mdPath = resolve(REPORTS_DIR, `${base}.md`);
  const source = `Kite Connect historical (${dashboardSymbol.exchange}:${dashboardSymbol.tradingSymbol}, 15minute)`;

  const payload = {
    symbol: dashboardSymbol.tradingSymbol,
    rule: "deeppro",
    titleSuffix:
      minProfitPct == null
        ? `last ${tradeDays} trades`
        : `profit ≥ ${minProfitPct}% · last ${tradeDays} trades`,
    generatedAtUtc: new Date().toISOString(),
    window: {
      from: lastTrades[0]?.dateKey ?? fromKey,
      to: lastTrades[lastTrades.length - 1]?.dateKey ?? toKey,
      tradeDays: lastTrades.length,
    },
    summary: {
      trades: trades.length,
      sellCount: trades.filter((trade) => trade.side === "SELL").length,
      buyCount: trades.filter((trade) => trade.side === "BUY").length,
      minProfitPct,
      scannedTrades: lastTrades.length,
    },
    data: {
      source,
      candleCount: candles.length,
      deeppro: {
        minPeakSmi: config.deeppro.minPeakSmi,
        maxTroughSmi: config.deeppro.maxTroughSmi,
        lookbackBars: config.deeppro.lookbackBars,
        entryDeadlineIst: config.deeppro.entryDeadlineIst,
        minMacdHistDeltaPct: config.deeppro.minMacdHistDeltaPct,
      },
    },
    trades,
  };

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(
    mdPath,
    writeMarkdown({
      symbol: payload.symbol,
      titleSuffix: payload.titleSuffix,
      generatedAtUtc: payload.generatedAtUtc,
      window: payload.window,
      summary: payload.summary,
      trades,
      source,
    }),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        symbol: payload.symbol,
        scannedTrades: lastTrades.length,
        trades: payload.summary.trades,
        sellCount: payload.summary.sellCount,
        buyCount: payload.summary.buyCount,
        minProfitPct,
        json: jsonPath,
        markdown: mdPath,
        june:
          trades
            .filter((trade) => trade.dateKey >= "2026-06-22" && trade.dateKey <= "2026-06-30")
            .map((trade) => `${trade.dateKey} ${trade.side} ${trade.event} ${trade.bestProfitPct}%`),
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
