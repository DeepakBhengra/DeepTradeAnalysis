#!/usr/bin/env node
/**
 * Deeppro BUY+SELL square-off study for N stocks × last M trade days.
 * Uses current rules (SMI cross/touch + angle gate + quality).
 *
 * Usage:
 *   npx tsx scripts/study-deeppro-multi-squareoff.ts \
 *     --symbols SBIN,LTM,TATASTEEL,MARUTI,SUNPHARMA \
 *     --trade-days 10 --min-profit 0.6
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
import { formatUnknownError } from "../src/utils/formatError.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SESSION_END = "15:15";

function parseArgs(argv: string[]): {
  symbols: string[];
  tradeDays: number;
  minProfitPct: number;
} {
  let symbols = ["SBIN", "LTM", "TATASTEEL", "MARUTI", "SUNPHARMA"];
  let tradeDays = 10;
  let minProfitPct = 0.6;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--symbols" && argv[i + 1]) {
      symbols = argv[++i]
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
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
  }

  if (symbols.length === 0) {
    throw new Error("Provide at least one symbol via --symbols");
  }
  return { symbols, tradeDays, minProfitPct };
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
): { bestTimeIst: string | null; bestExitPrice: number | null; bestProfitPct: number | null } {
  let bestTimeIst: string | null = null;
  let bestExitPrice: number | null = null;
  let bestProfitPct: number | null = null;

  for (const snapshot of snapshots) {
    const parts = getIstTimeParts(snapshot.timestamp);
    if (parts.dateKey !== dateKey) continue;
    const timeIst = formatIstTime(snapshot.timestamp);
    if (timeIst <= eventTimeIst || timeIst > SESSION_END) continue;
    const exitPrice = midPrice(snapshot);
    const profitPct =
      side === "SELL"
        ? ((entryPrice - exitPrice) / entryPrice) * 100
        : ((exitPrice - entryPrice) / entryPrice) * 100;
    if (bestProfitPct == null || profitPct > bestProfitPct) {
      bestProfitPct = profitPct;
      bestExitPrice = exitPrice;
      bestTimeIst = timeIst;
    }
  }

  return {
    bestTimeIst,
    bestExitPrice: bestExitPrice == null ? null : round(bestExitPrice),
    bestProfitPct: bestProfitPct == null ? null : round(bestProfitPct),
  };
}

interface TradeHit {
  symbol: string;
  dateKey: string;
  dateLabel: string;
  side: "BUY" | "SELL";
  eventTimeIst: string;
  eventKind: string;
  eventRsi: number;
  peakSmi: number;
  smi: number;
  smiSignal: number;
  entryPrice: number;
  bestTimeIst: string | null;
  bestExitPrice: number | null;
  bestProfitPct: number | null;
  qualifies: boolean;
}

async function scanSymbol(
  symbol: string,
  tradeDays: number,
  minProfitPct: number,
): Promise<{
  symbol: string;
  tradeDaysUsed: string[];
  allSignals: number;
  hits: TradeHit[];
  allTrades: TradeHit[];
  error: string | null;
}> {
  try {
    const dash = resolveDashboardSymbol(symbol);
    // 1mo range includes warmup + enough sessions for last N trade days.
    const candles = await fetchPnbCandles({
      symbol: dash.tradingSymbol,
      exchange: dash.exchange,
      segment: dash.segment,
      range: "1mo",
      kiteRetries: Math.max(config.dayScanKiteRetries, 3),
    });
    const snapshots = buildIndicatorSnapshots(candles);
    const allDates = collectDeepproTradingDates(snapshots);
    const tradeDaysUsed = allDates.slice(-tradeDays);
    if (tradeDaysUsed.length < tradeDays) {
      console.log(
        `[warn] ${symbol}: only ${tradeDaysUsed.length}/${tradeDays} session dates in 1mo fetch`,
      );
    }

    const allTrades: TradeHit[] = [];
    let allSignals = 0;

    for (const dateKey of tradeDaysUsed) {
      const day = evaluateDeepproDay(snapshots, dateKey);
      allSignals += day.signals.length;
      for (const signal of day.signals) {
        const eventSnapshot = snapshots.find((snapshot) => {
          const parts = getIstTimeParts(snapshot.timestamp);
          return (
            parts.dateKey === signal.dateKey &&
            formatIstTime(snapshot.timestamp) === signal.eventTimeIst
          );
        });
        if (!eventSnapshot) continue;

        const entryPrice = round(midPrice(eventSnapshot));
        const sq = bestSquareOff(
          snapshots,
          signal.dateKey,
          signal.eventTimeIst,
          signal.side,
          entryPrice,
        );
        const bestProfitPct = sq.bestProfitPct;
        const qualifies =
          bestProfitPct != null && bestProfitPct >= minProfitPct;

        allTrades.push({
          symbol,
          dateKey,
          dateLabel: formatDayLabel(dateKey),
          side: signal.side,
          eventTimeIst: signal.eventTimeIst,
          eventKind: signal.eventKind,
          eventRsi: round(signal.eventRsi),
          peakSmi: round(signal.peakSmi, 2),
          smi: round(signal.smi, 2),
          smiSignal: round(signal.smiSignal, 2),
          entryPrice,
          bestTimeIst: sq.bestTimeIst,
          bestExitPrice: sq.bestExitPrice,
          bestProfitPct,
          qualifies,
        });
      }
    }

    const hits = allTrades.filter((t) => t.qualifies);
    return { symbol, tradeDaysUsed, allSignals, hits, allTrades, error: null };
  } catch (error) {
    return {
      symbol,
      tradeDaysUsed: [],
      allSignals: 0,
      hits: [],
      allTrades: [],
      error: formatUnknownError(error),
    };
  }
}

async function main(): Promise<void> {
  const { symbols, tradeDays, minProfitPct } = parseArgs(process.argv.slice(2));
  mkdirSync(REPORTS_DIR, { recursive: true });

  console.log(
    JSON.stringify({
      phase: "start",
      symbols,
      tradeDays,
      minProfitPct,
      signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
      lengthEma: config.deeppro.smi.lengthEma,
      minSellSmiAngleDeg: config.deeppro.minSellSmiAngleDeg,
      minBuySmiAngleDeg: config.deeppro.minBuySmiAngleDeg,
    }),
  );

  const results = [];
  for (const symbol of symbols) {
    const result = await scanSymbol(symbol, tradeDays, minProfitPct);
    console.log(
      `[ok] ${symbol} signals=${result.allSignals} hits>=${minProfitPct}%=${result.hits.length}${result.error ? ` ERROR ${result.error}` : ""}`,
    );
    results.push(result);
  }

  const sortTrades = (rows: TradeHit[]) =>
    [...rows].sort((a, b) => {
      const d = a.dateKey.localeCompare(b.dateKey);
      if (d !== 0) return d;
      const s = a.symbol.localeCompare(b.symbol);
      if (s !== 0) return s;
      return (b.bestProfitPct ?? 0) - (a.bestProfitPct ?? 0);
    });

  const allTrades = sortTrades(results.flatMap((r) => r.allTrades));
  const hits = sortTrades(results.flatMap((r) => r.hits));

  const tradeDaysUnion = [
    ...new Set(results.flatMap((r) => r.tradeDaysUsed)),
  ].sort();
  const generatedAtUtc = new Date().toISOString();
  const tag = `5stocks-${tradeDays}d-gte${minProfitPct}`;
  const jsonPath = resolve(REPORTS_DIR, `deeppro-angle-${tag}.json`);
  const mdPath = resolve(REPORTS_DIR, `deeppro-angle-${tag}.md`);

  const sells = hits.filter((h) => h.side === "SELL");
  const buys = hits.filter((h) => h.side === "BUY");
  const avgProfit =
    hits.length === 0
      ? null
      : round(hits.reduce((s, h) => s + (h.bestProfitPct ?? 0), 0) / hits.length);

  const payload = {
    rule: "deeppro",
    signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
    smi: config.deeppro.smi,
    minSellSmiAngleDeg: config.deeppro.minSellSmiAngleDeg,
    minBuySmiAngleDeg: config.deeppro.minBuySmiAngleDeg,
    symbols,
    tradeDaysRequested: tradeDays,
    tradeDaysObserved: tradeDaysUnion,
    minProfitPct,
    generatedAtUtc,
    totalSignalsAcrossSymbols: results.reduce((s, r) => s + r.allSignals, 0),
    hitCount: hits.length,
    sellCount: sells.length,
    buyCount: buys.length,
    avgBestProfitPct: avgProfit,
    perSymbol: results.map((r) => ({
      symbol: r.symbol,
      tradeDays: r.tradeDaysUsed,
      allSignals: r.allSignals,
      hitsGteMin: r.hits.length,
      error: r.error,
    })),
    allTrades,
    hits,
  };

  const lines = [
    `# Deeppro angle-gate study — 5 stocks × ${tradeDays} trade days (profit ≥ ${minProfitPct}%)`,
    "",
    `- **Stocks:** ${symbols.join(", ")}`,
    `- **Trade days (last ${tradeDays} sessions per symbol):** ${tradeDaysUnion[0] ?? "—"} → ${tradeDaysUnion[tradeDaysUnion.length - 1] ?? "—"} (${tradeDaysUnion.length} dates)`,
    `- **Rules:** SMI↔signal cross/touch · signal EMA(10) · SELL cut ≥${config.deeppro.minSellSmiAngleDeg}° · BUY slope ≥${config.deeppro.minBuySmiAngleDeg}° · quality gates on`,
    `- **Hit:** best same-day SQ mid before ${SESSION_END} IST ≥ **${minProfitPct}%**`,
    `- **Raw deeppro signals (all 5 stocks):** ${payload.totalSignalsAcrossSymbols}`,
    `- **Hits ≥ ${minProfitPct}%:** ${hits.length} (${sells.length} SELL · ${buys.length} BUY)`,
    `- **Avg best profit (hits):** ${avgProfit == null ? "—" : `${avgProfit.toFixed(2)}%`}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Per-symbol summary",
    "",
    "| Stock | Sessions | Raw signals | Hits ≥ min |",
    "|-------|----------|-------------|------------|",
  ];

  for (const r of results) {
    lines.push(
      `| ${r.symbol} | ${r.tradeDaysUsed.length} | ${r.allSignals} | ${r.hits.length}${r.error ? ` (error)` : ""} |`,
    );
  }

  lines.push(
    "",
    "## Hits (profit ≥ " + minProfitPct + "%)",
    "",
    "| Stock | Date | Side | Cross IST | Kind | SMI / Signal | Peak/Trough | Entry | Best SQ | Profit % |",
    "|-------|------|------|-----------|------|--------------|-------------|-------|---------|----------|",
  );

  if (hits.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | — | *none* |");
  } else {
    for (const h of hits) {
      lines.push(
        `| ${h.symbol} | ${h.dateLabel} | ${h.side} | ${h.eventTimeIst} | ${h.eventKind} | ${h.smi} / ${h.smiSignal} | ${h.peakSmi} | ${h.entryPrice.toFixed(2)} | ${h.bestTimeIst ?? "—"} | **${h.bestProfitPct?.toFixed(2)}%** |`,
      );
    }
  }

  lines.push(
    "",
    "## All deeppro signals in window (with best SQ %)",
    "",
    "| Stock | Date | Side | Cross IST | Entry | Best SQ | Profit % | ≥ min? |",
    "|-------|------|------|-----------|-------|---------|----------|--------|",
  );
  if (allTrades.length === 0) {
    lines.push("| — | — | — | — | — | — | — | *none* |");
  } else {
    for (const t of allTrades) {
      const profit =
        t.bestProfitPct == null ? "—" : `${t.bestProfitPct.toFixed(2)}%`;
      lines.push(
        `| ${t.symbol} | ${t.dateLabel} | ${t.side} | ${t.eventTimeIst} | ${t.entryPrice.toFixed(2)} | ${t.bestTimeIst ?? "—"} | ${profit} | ${t.qualifies ? "YES" : "no"} |`,
      );
    }
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- Same-day square-off only; profit = best later mid before 15:15 IST.",
    "- Uses current Deeppro engine (cross/touch + angle gate + quality).",
    "- Kite Connect historical 15m only.",
    "",
  );

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(mdPath, `${lines.join("\n")}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        hitCount: hits.length,
        sellCount: sells.length,
        buyCount: buys.length,
        avgBestProfitPct: avgProfit,
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
