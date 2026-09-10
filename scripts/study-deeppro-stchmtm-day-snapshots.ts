#!/usr/bin/env node
/**
 * Deeppro ≥0.75% hits for first N sector-watchlist stocks on one session date,
 * exporting Stch Mtm series for SMI↔signal cross snapshots.
 *
 * Uses current deeppro rules (`signalOnSmiCrossOnly` → eventKind smi_cross).
 *
 * Usage:
 *   npx tsx scripts/study-deeppro-stchmtm-day-snapshots.ts --date 2026-08-03 --limit 50
 */
import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { computeStochasticMomentum } from "../src/indicators/stochasticMomentum.js";
import { evaluateDeepproDay } from "../src/rules/deepproDecision.js";
import { SECTOR_WATCHLIST } from "../src/symbols/sectorWatchlist.js";
import type { IndicatorSnapshot } from "../src/types.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";
import { formatUnknownError } from "../src/utils/formatError.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const ARTIFACTS_DIR = resolve("/opt/cursor/artifacts/deeppro-stchmtm-snapshots");
const SESSION_END = "15:15";

function parseArgs(argv: string[]): {
  date: string;
  minProfitPct: number;
  limit: number;
} {
  let date = "2026-08-03";
  let minProfitPct = 0.75;
  let limit = 50;

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
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid --date ${date}. Use YYYY-MM-DD.`);
  }

  return { date, minProfitPct, limit };
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

interface SessionBar {
  timeIst: string;
  open: number;
  high: number;
  low: number;
  close: number;
  smi: number | null;
  signal: number | null;
  rsi: number | null;
  bbUpper: number | null;
  bbLower: number | null;
}

interface HitSnapshot {
  symbol: string;
  sector: string;
  dateKey: string;
  side: "BUY" | "SELL";
  crossTimeIst: string;
  eventTimeIst: string;
  eventKind: string;
  eventRsi: number;
  peakSmi: number;
  crossSmi: number;
  crossSignal: number;
  entryPrice: number;
  bestTimeIst: string | null;
  bestExitPrice: number | null;
  bestProfitPct: number | null;
  sessionBars: SessionBar[];
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
  const { date, minProfitPct, limit } = parseArgs(process.argv.slice(2));
  const watchlist = SECTOR_WATCHLIST.slice(0, limit);
  const concurrency = Math.max(1, config.dayScanConcurrency);

  mkdirSync(REPORTS_DIR, { recursive: true });
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  console.log(
    JSON.stringify({
      phase: "start",
      date,
      minProfitPct,
      stocks: watchlist.length,
      concurrency,
      signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
    }),
  );

  type ScanResult = {
    hits: HitSnapshot[];
    signalCount: number;
    error: string | null;
    symbol: string;
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
      const highs = snapshots.map((s) => s.high);
      const lows = snapshots.map((s) => s.low);
      const closes = snapshots.map((s) => s.close);
      const smiSeries = computeStochasticMomentum(
        highs,
        lows,
        closes,
        config.deeppro.smi.lengthK,
        config.deeppro.smi.lengthD,
        config.deeppro.smi.lengthEma,
      );

      const day = evaluateDeepproDay(snapshots, date);
      const hits: HitSnapshot[] = [];

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
        if (sq.bestProfitPct == null || sq.bestProfitPct < minProfitPct) {
          continue;
        }

        const sessionBars: SessionBar[] = [];
        for (let i = 0; i < snapshots.length; i++) {
          const snapshot = snapshots[i];
          const parts = getIstTimeParts(snapshot.timestamp);
          if (parts.dateKey !== date) continue;
          const smi = smiSeries[i];
          sessionBars.push({
            timeIst: formatIstTime(snapshot.timestamp),
            open: round(snapshot.open),
            high: round(snapshot.high),
            low: round(snapshot.low),
            close: round(snapshot.close),
            smi: Number.isFinite(smi.smi) ? round(smi.smi, 2) : null,
            signal: Number.isFinite(smi.signal) ? round(smi.signal, 2) : null,
            rsi: Number.isFinite(snapshot.rsi) ? round(snapshot.rsi, 2) : null,
            bbUpper: snapshot.bollinger ? round(snapshot.bollinger.upper, 2) : null,
            bbLower: snapshot.bollinger ? round(snapshot.bollinger.lower, 2) : null,
          });
        }

        hits.push({
          symbol: entry.tradingSymbol,
          sector: entry.sector,
          dateKey: date,
          side: signal.side,
          crossTimeIst: signal.timeIst,
          eventTimeIst: signal.eventTimeIst,
          eventKind: signal.eventKind,
          eventRsi: round(signal.eventRsi),
          peakSmi: round(signal.peakSmi, 2),
          crossSmi: round(signal.smi, 2),
          crossSignal: round(signal.smiSignal, 2),
          entryPrice,
          bestTimeIst: sq.bestTimeIst,
          bestExitPrice: sq.bestExitPrice,
          bestProfitPct: sq.bestProfitPct,
          sessionBars,
        });
      }

      if ((index + 1) % 5 === 0 || index === 0 || index === watchlist.length - 1) {
        console.log(
          `[deeppro-day-snap] ${index + 1}/${watchlist.length} ${entry.tradingSymbol} hits=${hits.length} signals=${day.signals.length}`,
        );
      }

      return {
        hits,
        signalCount: day.signals.length,
        error: null,
        symbol: entry.tradingSymbol,
      } satisfies ScanResult;
    } catch (error) {
      const message = formatUnknownError(error);
      console.log(
        `[deeppro-day-snap] ${index + 1}/${watchlist.length} ${entry.tradingSymbol} ERROR ${message}`,
      );
      return {
        hits: [],
        signalCount: 0,
        error: message,
        symbol: entry.tradingSymbol,
      } satisfies ScanResult;
    }
  });

  const hits = results
    .flatMap((r) => r.hits)
    .sort((a, b) => {
      const profitDiff = (b.bestProfitPct ?? 0) - (a.bestProfitPct ?? 0);
      if (profitDiff !== 0) return profitDiff;
      return a.symbol.localeCompare(b.symbol);
    });

  const errors = results
    .filter((r) => r.error)
    .map((r) => ({ symbol: r.symbol, error: r.error }));
  const stocksWithSignals = results.filter((r) => r.signalCount > 0).length;
  const generatedAtUtc = new Date().toISOString();
  const tag = `watchlist50-${date}-gte${minProfitPct}`;

  const payload = {
    rule: "deeppro",
    signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
    date,
    minProfitPct,
    watchlistSize: watchlist.length,
    stocksScanned: results.length,
    stocksWithSignals,
    stocksInReport: new Set(hits.map((h) => h.symbol)).size,
    hitCount: hits.length,
    sellCount: hits.filter((h) => h.side === "SELL").length,
    buyCount: hits.filter((h) => h.side === "BUY").length,
    generatedAtUtc,
    errors,
    hits: hits.map(({ sessionBars, ...rest }) => ({
      ...rest,
      sessionBarCount: sessionBars.length,
    })),
    snapshots: hits,
  };

  const jsonPath = resolve(REPORTS_DIR, `deeppro-stchmtm-${tag}.json`);
  const mdPath = resolve(REPORTS_DIR, `deeppro-stchmtm-${tag}.md`);
  const plotJsonPath = resolve(ARTIFACTS_DIR, `plot-data-${date}.json`);

  const lines = [
    `# Deeppro Stch Mtm snapshots — 50 stocks · ${formatDayLabel(date)} (≥ ${minProfitPct}%)`,
    "",
    `- **Date:** ${date}`,
    `- **Universe:** first ${watchlist.length} SECTOR_WATCHLIST stocks`,
    `- **Rule:** deeppro SMI↔signal cross only (\`signalOnSmiCrossOnly\`)`,
    `- **Hit:** best same-day SQ mid before ${SESSION_END} IST ≥ ${minProfitPct}%`,
    `- **Stocks scanned:** ${results.length} · with signals: ${stocksWithSignals} · in report: ${payload.stocksInReport}`,
    `- **Hits:** ${hits.length} (${payload.sellCount} SELL · ${payload.buyCount} BUY)`,
    `- **Fetch errors:** ${errors.length}`,
    `- **Charts:** Zerodha **Stch Mtm (10,3,3)** recreation from Kite 15m — gold marker = exact SMI↔signal cross`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Hits",
    "",
    "| Stock | Sector | Side | Cross IST | Kind | Cross SMI / Signal | Peak/Trough | Entry | Best SQ | Profit % | Chart |",
    "|-------|--------|------|-----------|------|--------------------|-------------|-------|---------|----------|-------|",
  ];

  for (const hit of hits) {
    const chartName = `${hit.symbol}_${hit.dateKey}_${hit.side}_${hit.crossTimeIst.replace(":", "")}.png`;
    lines.push(
      `| ${hit.symbol} | ${hit.sector} | ${hit.side} | ${hit.crossTimeIst} | ${hit.eventKind} | ${hit.crossSmi} / ${hit.crossSignal} | ${hit.peakSmi} | ${hit.entryPrice.toFixed(2)} | ${hit.bestTimeIst ?? "—"} | ${hit.bestProfitPct?.toFixed(2)}% | \`${chartName}\` |`,
    );
  }

  if (hits.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | — | *none* | — |");
  }

  lines.push(
    "",
    "## Stch Mtm cross snapshots",
    "",
    "Each chart: price (top) · full-session Stch Mtm (middle) · **±8-bar zoom on the SMI↔signal cross** (bottom). White = SMI, red = signal, gold = Deeppro entry.",
    "",
  );

  for (const hit of hits) {
    const chartName = `${hit.symbol}_${hit.dateKey}_${hit.side}_${hit.crossTimeIst.replace(":", "")}.png`;
    lines.push(
      `### ${hit.symbol} · ${hit.dateKey} · ${hit.side} @ ${hit.crossTimeIst} (${hit.bestProfitPct?.toFixed(2)}%)`,
      "",
      `![${hit.symbol} ${hit.dateKey} ${hit.side} Stch Mtm cross](deeppro-stchmtm-snapshots/${chartName})`,
      "",
    );
  }

  lines.push(
    "## How to read the Stch Mtm snapshot",
    "",
    "- Formula matches Zerodha **Stch Mtm (10, 3, 3)** (William Blau SMI) on Kite 15m candles",
    "- **White** = SMI · **Red** = signal line",
    "- Vertical **gold** line + marker = exact SMI↔signal cross (the Deeppro BUY/SELL entry)",
    "- Bottom panel zooms ±8 bars around the cross so the line intersection is clear",
    "- Shaded zone ≈ overbought (≥40) / oversold (≤-40)",
    "",
  );

  if (errors.length > 0) {
    lines.push("## Fetch errors", "");
    for (const err of errors) {
      lines.push(`- \`${err.symbol}\`: ${err.error}`);
    }
    lines.push("");
  }

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(mdPath, `${lines.join("\n")}\n`);
  writeFileSync(plotJsonPath, `${JSON.stringify({ hits }, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        date,
        hitCount: hits.length,
        sellCount: payload.sellCount,
        buyCount: payload.buyCount,
        stocksWithSignals,
        errorCount: errors.length,
        json: jsonPath,
        markdown: mdPath,
        plotData: plotJsonPath,
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
