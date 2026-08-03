#!/usr/bin/env node
/**
 * Analyse RSI, Stch Mtm (SMI), and BB proximity for day-best BUY/SELL
 * trades grouped by profit-range category, using Yahoo Finance 15m bars
 * (fallback when Kite access_token is unavailable).
 *
 * Favourable bands = 25th–75th percentile (IQR) within each category×side.
 *
 * Usage:
 *   npx tsx scripts/analyze-range-indicators-yahoo.ts \
 *     --src reports/sunpharma-best-buy-sell-by-range-60d.json \
 *     --symbol SUNPHARMA --range 60d --out-suffix 60d
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../src/config.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { computeStochasticMomentum } from "../src/indicators/stochasticMomentum.js";
import {
  bbMatchGapPct,
  classifyBbBottomMatch,
  classifyBbTopMatch,
  pctDistance,
} from "../src/rules/bollingerUtils.js";
import type { Candle, IndicatorSnapshot } from "../src/types.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SESSION_START = "09:15";
const SESSION_END = "15:15";

function parseArgs(argv: string[]): {
  rangeSrc: string;
  symbol: string;
  yahooRange: string;
  outSuffix: string;
} {
  let rangeSrc = resolve(REPORTS_DIR, "sunpharma-best-buy-sell-by-range-60d.json");
  let symbol = "SUNPHARMA";
  let yahooRange = "60d";
  let outSuffix = "60d";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--src" && argv[i + 1]) {
      rangeSrc = resolve(process.cwd(), argv[++i]);
      continue;
    }
    if (arg === "--symbol" && argv[i + 1]) {
      symbol = argv[++i].toUpperCase();
      continue;
    }
    if (arg === "--range" && argv[i + 1]) {
      yahooRange = argv[++i];
      continue;
    }
    if (arg === "--out-suffix" && argv[i + 1]) {
      outSuffix = argv[++i];
      continue;
    }
  }
  return { rangeSrc, symbol, yahooRange, outSuffix };
}

type Opp = {
  dateKey: string;
  dayLabel: string;
  weekday: string;
  entryTimeIst: string;
  entryPrice: number;
  squareOffTimeIst: string;
  squareOffPrice: number;
  profitPct: number;
};

type Enriched = Opp & {
  side: "BUY" | "SELL";
  rangeId: string;
  rangeLabel: string;
  rsi: number;
  smi: number;
  smiSignal: number;
  smiMinusSignal: number;
  bbUpperGapPct: number;
  bbUpperMatch: string;
  bbLowerGapPct: number;
  bbLowerMatch: string;
  bbRelevantGapPct: number;
  bbRelevantMatch: string;
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function yahooSymbol(nseSymbol: string): string {
  return `${nseSymbol.toUpperCase()}.NS`;
}

function formatIstParts(date: Date): { dateKey: string; timeIst: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    timeIst: `${get("hour")}:${get("minute")}`,
  };
}

async function fetchYahooCandles(symbol: string, range: string): Promise<Candle[]> {
  const ysym = yahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?range=${encodeURIComponent(range)}&interval=15m`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    throw new Error(`Yahoo chart request failed: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
      error?: { description?: string } | null;
    };
  };

  const result = payload.chart?.result?.[0];
  if (!result?.timestamp?.length) {
    throw new Error(
      `Yahoo returned no 15m bars for ${ysym}: ${payload.chart?.error?.description ?? "empty result"}`,
    );
  }
  const quote = result.indicators?.quote?.[0];
  if (!quote) {
    throw new Error(`Yahoo returned no quote series for ${ysym}`);
  }

  const candles: Candle[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i] ?? 0;
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }
    const timestamp = new Date(result.timestamp[i] * 1000);
    const { timeIst } = formatIstParts(timestamp);
    if (timeIst < SESSION_START || timeIst > SESSION_END) {
      continue;
    }
    candles.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
    });
  }

  return candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  if (next == null) return sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

function stats(values: number[]): {
  n: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
  mean: number;
} {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (finite.length === 0) {
    return { n: 0, min: NaN, p25: NaN, median: NaN, p75: NaN, max: NaN, mean: NaN };
  }
  const mean = finite.reduce((s, v) => s + v, 0) / finite.length;
  return {
    n: finite.length,
    min: round(finite[0]),
    p25: round(quantile(finite, 0.25)),
    median: round(quantile(finite, 0.5)),
    p75: round(quantile(finite, 0.75)),
    max: round(finite[finite.length - 1]),
    mean: round(mean),
  };
}

function bbUpper(snapshot: IndicatorSnapshot): {
  gapPct: number;
  matchType: string;
} {
  const matchType = classifyBbTopMatch(
    snapshot.bollinger.upper,
    snapshot.high,
    snapshot.close,
  );
  const gapPct = matchType
    ? bbMatchGapPct(
        matchType,
        "top",
        snapshot.bollinger.upper,
        snapshot.high,
        snapshot.close,
      )
    : pctDistance(snapshot.bollinger.upper, snapshot.high, snapshot.close);
  return { gapPct: round(gapPct, 3), matchType: matchType ?? "none" };
}

function bbLower(snapshot: IndicatorSnapshot): {
  gapPct: number;
  matchType: string;
} {
  const matchType = classifyBbBottomMatch(
    snapshot.bollinger.lower,
    snapshot.low,
    snapshot.close,
  );
  const gapPct = matchType
    ? bbMatchGapPct(
        matchType,
        "bottom",
        snapshot.bollinger.lower,
        snapshot.low,
        snapshot.close,
      )
    : pctDistance(snapshot.bollinger.lower, snapshot.low, snapshot.close);
  return { gapPct: round(gapPct, 3), matchType: matchType ?? "none" };
}

function formatBand(s: { p25: number; median: number; p75: number }): string {
  if (!Number.isFinite(s.median)) return "—";
  return `${s.p25.toFixed(2)} – ${s.p75.toFixed(2)} (med ${s.median.toFixed(2)})`;
}

function matchShare(rows: Enriched[], field: "bbRelevantMatch"): string {
  if (rows.length === 0) return "—";
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row[field];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${round((n / rows.length) * 100, 0)}%`)
    .join(", ");
}

function smiRegimeShare(rows: Enriched[], side: "BUY" | "SELL"): string {
  if (rows.length === 0) return "—";
  let oversold = 0;
  let mid = 0;
  let overbought = 0;
  for (const row of rows) {
    if (row.smi <= -40) oversold += 1;
    else if (row.smi >= 40) overbought += 1;
    else mid += 1;
  }
  const pct = (n: number) => round((n / rows.length) * 100, 0);
  if (side === "BUY") {
    return `SMI≤-40 ${pct(oversold)}% · mid ${pct(mid)}% · SMI≥40 ${pct(overbought)}%`;
  }
  return `SMI≥40 ${pct(overbought)}% · mid ${pct(mid)}% · SMI≤-40 ${pct(oversold)}%`;
}

function rsiRegimeShare(rows: Enriched[], side: "BUY" | "SELL"): string {
  if (rows.length === 0) return "—";
  let low = 0;
  let mid = 0;
  let high = 0;
  for (const row of rows) {
    if (row.rsi < 40) low += 1;
    else if (row.rsi > 60) high += 1;
    else mid += 1;
  }
  const pct = (n: number) => round((n / rows.length) * 100, 0);
  if (side === "BUY") {
    return `RSI<40 ${pct(low)}% · 40–60 ${pct(mid)}% · >60 ${pct(high)}%`;
  }
  return `RSI>60 ${pct(high)}% · 40–60 ${pct(mid)}% · <40 ${pct(low)}%`;
}

async function main(): Promise<void> {
  const { rangeSrc: RANGE_SRC, symbol, yahooRange, outSuffix } = parseArgs(
    process.argv.slice(2),
  );
  const rangePayload = JSON.parse(readFileSync(RANGE_SRC, "utf8")) as {
    symbol?: string;
    window: { from: string; to: string };
    tradeDaysScanned: number;
    categories: Array<{
      id: string;
      label: string;
      buys: Opp[];
      sells: Opp[];
    }>;
  };

  const reportSymbol = (rangePayload.symbol ?? symbol).toUpperCase();
  const slug = reportSymbol.toLowerCase();

  console.log(
    JSON.stringify({
      phase: "start",
      symbol: reportSymbol,
      yahooRange,
      source: "yahoo-finance-15m",
      categories: rangePayload.categories.map((c) => c.label),
    }),
  );

  const candles = await fetchYahooCandles(reportSymbol, yahooRange);
  const snapshots = buildIndicatorSnapshots(candles);
  const smiSeries = computeStochasticMomentum(
    snapshots.map((s) => s.high),
    snapshots.map((s) => s.low),
    snapshots.map((s) => s.close),
    config.deeppro.smi.lengthK,
    config.deeppro.smi.lengthD,
    config.deeppro.smi.lengthEma,
  );

  const byKey = new Map<string, { snapshot: IndicatorSnapshot; index: number }>();
  snapshots.forEach((snapshot, index) => {
    const { dateKey, timeIst } = formatIstParts(snapshot.timestamp);
    byKey.set(`${dateKey}|${timeIst}`, { snapshot, index });
  });

  const enriched: Enriched[] = [];
  let missing = 0;

  for (const category of rangePayload.categories) {
    for (const side of ["BUY", "SELL"] as const) {
      const opps = side === "BUY" ? category.buys : category.sells;
      for (const opp of opps) {
        const hit = byKey.get(`${opp.dateKey}|${opp.entryTimeIst}`);
        if (!hit) {
          missing += 1;
          continue;
        }
        const { snapshot, index } = hit;
        const smi = smiSeries[index];
        if (
          !smi ||
          !Number.isFinite(smi.smi) ||
          !Number.isFinite(smi.signal) ||
          !Number.isFinite(snapshot.rsi) ||
          !Number.isFinite(snapshot.bollinger.upper) ||
          !Number.isFinite(snapshot.bollinger.lower)
        ) {
          missing += 1;
          continue;
        }
        const upper = bbUpper(snapshot);
        const lower = bbLower(snapshot);
        const relevant = side === "BUY" ? lower : upper;
        enriched.push({
          ...opp,
          side,
          rangeId: category.id,
          rangeLabel: category.label,
          rsi: round(snapshot.rsi),
          smi: round(smi.smi, 1),
          smiSignal: round(smi.signal, 1),
          smiMinusSignal: round(smi.smi - smi.signal, 1),
          bbUpperGapPct: upper.gapPct,
          bbUpperMatch: upper.matchType,
          bbLowerGapPct: lower.gapPct,
          bbLowerMatch: lower.matchType,
          bbRelevantGapPct: relevant.gapPct,
          bbRelevantMatch: relevant.matchType,
        });
      }
    }
  }

  type SideStats = {
    side: "BUY" | "SELL";
    count: number;
    rsi: ReturnType<typeof stats>;
    smi: ReturnType<typeof stats>;
    smiSignal: ReturnType<typeof stats>;
    smiMinusSignal: ReturnType<typeof stats>;
    bbRelevantGapPct: ReturnType<typeof stats>;
    bbMatchShare: string;
    rsiRegime: string;
    smiRegime: string;
    favourable: {
      rsi: string;
      stchMtm: string;
      bbProximity: string;
    };
    rows: Enriched[];
  };

  type CategoryAnalysis = {
    id: string;
    label: string;
    buy: SideStats;
    sell: SideStats;
  };

  function analyseSide(side: "BUY" | "SELL", rows: Enriched[]): SideStats {
    const rsi = stats(rows.map((r) => r.rsi));
    const smi = stats(rows.map((r) => r.smi));
    const smiSignal = stats(rows.map((r) => r.smiSignal));
    const smiMinusSignal = stats(rows.map((r) => r.smiMinusSignal));
    const bbRelevantGapPct = stats(rows.map((r) => r.bbRelevantGapPct));
    const bbLabel = side === "BUY" ? "BB lower gap" : "BB upper gap";

    const favourable = {
      rsi:
        side === "BUY"
          ? `RSI ${formatBand(rsi)} — prefer softer/oversold zone`
          : `RSI ${formatBand(rsi)} — prefer firmer/overbought zone`,
      stchMtm: `SMI ${formatBand(smi)}; SMI−signal ${formatBand(smiMinusSignal)}`,
      bbProximity: `${bbLabel} ${formatBand(bbRelevantGapPct)}; match mix: ${matchShare(rows, "bbRelevantMatch")}`,
    };

    return {
      side,
      count: rows.length,
      rsi,
      smi,
      smiSignal,
      smiMinusSignal,
      bbRelevantGapPct,
      bbMatchShare: matchShare(rows, "bbRelevantMatch"),
      rsiRegime: rsiRegimeShare(rows, side),
      smiRegime: smiRegimeShare(rows, side),
      favourable,
      rows: [...rows].sort((a, b) => b.profitPct - a.profitPct),
    };
  }

  const analyses: CategoryAnalysis[] = rangePayload.categories.map((category) => {
    const buyRows = enriched.filter(
      (r) => r.rangeId === category.id && r.side === "BUY",
    );
    const sellRows = enriched.filter(
      (r) => r.rangeId === category.id && r.side === "SELL",
    );
    return {
      id: category.id,
      label: category.label,
      buy: analyseSide("BUY", buyRows),
      sell: analyseSide("SELL", sellRows),
    };
  });

  const generatedAtUtc = new Date().toISOString();
  const lines = [
    `# ${reportSymbol} — RSI / Stch Mtm / BB proximity by profit range (last ${rangePayload.tradeDaysScanned}d)`,
    "",
    `- **Symbol:** ${reportSymbol}`,
    `- **Window:** ${rangePayload.tradeDaysScanned} trade days (${rangePayload.window.from} → ${rangePayload.window.to})`,
    `- **Universe:** day-best BUY/SELL with positive profit, split into \`3%–1.8%\` · \`1.7%–0.9%\` · \`0.8%–0.4%\``,
    `- **Indicators at entry candle:** RSI · Stch Mtm SMI/signal (K=10,D=3,EMA=10) · BB upper/lower gap %`,
    `- **Favourable band:** 25th–75th percentile (IQR) within each category × side`,
    `- **Data:** Yahoo Finance chart (${yahooSymbol(reportSymbol)}, 15m, range=${yahooRange})`,
    `- **Missing entry matches:** ${missing}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Favourable settings summary",
    "",
    "| Profit range | Side | n | Favourable RSI | Favourable Stch Mtm (SMI) | Favourable BB proximity |",
    "|--------------|------|---|----------------|---------------------------|-------------------------|",
  ];

  for (const analysis of analyses) {
    for (const sideStats of [analysis.buy, analysis.sell]) {
      const empty = sideStats.count === 0 || !Number.isFinite(sideStats.rsi.median);
      if (empty) {
        lines.push(
          `| ${analysis.label} | ${sideStats.side} | ${sideStats.count} | — | — | — |`,
        );
        continue;
      }
      const bbShort =
        sideStats.side === "BUY"
          ? `lower gap ${sideStats.bbRelevantGapPct.p25.toFixed(2)}–${sideStats.bbRelevantGapPct.p75.toFixed(2)}%`
          : `upper gap ${sideStats.bbRelevantGapPct.p25.toFixed(2)}–${sideStats.bbRelevantGapPct.p75.toFixed(2)}%`;
      lines.push(
        `| ${analysis.label} | ${sideStats.side} | ${sideStats.count} | ${sideStats.rsi.p25.toFixed(1)}–${sideStats.rsi.p75.toFixed(1)} (med ${sideStats.rsi.median.toFixed(1)}) | SMI ${sideStats.smi.p25.toFixed(1)}–${sideStats.smi.p75.toFixed(1)} (med ${sideStats.smi.median.toFixed(1)}) | ${bbShort}; ${sideStats.bbMatchShare} |`,
      );
    }
  }

  lines.push("", "## Interpretation (what looks favourable)", "");

  for (const analysis of analyses) {
    lines.push(`### ${analysis.label}`, "");
    for (const sideStats of [analysis.buy, analysis.sell]) {
      if (sideStats.count === 0) {
        lines.push(`**${sideStats.side}** (n=0)`, "", "- No trades in this bucket.", "");
        continue;
      }
      lines.push(
        `**${sideStats.side}** (n=${sideStats.count})`,
        "",
        `- RSI: ${sideStats.favourable.rsi}`,
        `- Regime mix: ${sideStats.rsiRegime}`,
        `- Stch Mtm: ${sideStats.favourable.stchMtm}`,
        `- SMI regime mix: ${sideStats.smiRegime}`,
        `- BB: ${sideStats.favourable.bbProximity}`,
        "",
      );
    }
  }

  lines.push("## Detailed stats by category", "");

  for (const analysis of analyses) {
    lines.push(`### Category ${analysis.label}`, "");
    for (const sideStats of [analysis.buy, analysis.sell]) {
      const bbName = sideStats.side === "BUY" ? "BB lower gap %" : "BB upper gap %";
      lines.push(
        `#### ${sideStats.side}`,
        "",
        `| Metric | n | min | p25 | median | p75 | max | mean |`,
        `|--------|---|-----|-----|--------|-----|-----|------|`,
        `| RSI | ${sideStats.rsi.n} | ${sideStats.rsi.min} | ${sideStats.rsi.p25} | ${sideStats.rsi.median} | ${sideStats.rsi.p75} | ${sideStats.rsi.max} | ${sideStats.rsi.mean} |`,
        `| SMI | ${sideStats.smi.n} | ${sideStats.smi.min} | ${sideStats.smi.p25} | ${sideStats.smi.median} | ${sideStats.smi.p75} | ${sideStats.smi.max} | ${sideStats.smi.mean} |`,
        `| SMI signal | ${sideStats.smiSignal.n} | ${sideStats.smiSignal.min} | ${sideStats.smiSignal.p25} | ${sideStats.smiSignal.median} | ${sideStats.smiSignal.p75} | ${sideStats.smiSignal.max} | ${sideStats.smiSignal.mean} |`,
        `| SMI − signal | ${sideStats.smiMinusSignal.n} | ${sideStats.smiMinusSignal.min} | ${sideStats.smiMinusSignal.p25} | ${sideStats.smiMinusSignal.median} | ${sideStats.smiMinusSignal.p75} | ${sideStats.smiMinusSignal.max} | ${sideStats.smiMinusSignal.mean} |`,
        `| ${bbName} | ${sideStats.bbRelevantGapPct.n} | ${sideStats.bbRelevantGapPct.min} | ${sideStats.bbRelevantGapPct.p25} | ${sideStats.bbRelevantGapPct.median} | ${sideStats.bbRelevantGapPct.p75} | ${sideStats.bbRelevantGapPct.max} | ${sideStats.bbRelevantGapPct.mean} |`,
        "",
        "| Day | Entry | Profit % | RSI | SMI | Signal | SMI−sig | BB gap % | BB match |",
        "|-----|-------|----------|-----|-----|--------|---------|----------|----------|",
      );
      if (sideStats.rows.length === 0) {
        lines.push("| — | — | — | — | — | — | — | — | *none* |");
      } else {
        for (const row of sideStats.rows) {
          lines.push(
            `| ${row.dayLabel} | ${row.entryTimeIst} | **${row.profitPct.toFixed(2)}%** | ${row.rsi.toFixed(1)} | ${row.smi.toFixed(1)} | ${row.smiSignal.toFixed(1)} | ${row.smiMinusSignal.toFixed(1)} | ${row.bbRelevantGapPct.toFixed(3)} | ${row.bbRelevantMatch} |`,
          );
        }
      }
      lines.push("");
    }
  }

  lines.push(
    "## Notes",
    "",
    "- Same rule-free day-best trades as the profit-range report (not Deepak/Deeppro filtered).",
    "- Stch Mtm = Kite-style SMI (10,3,10).",
    "- BUY uses **BB lower** proximity; SELL uses **BB upper** proximity.",
    "- Favourable bands are descriptive (IQR of winners in that bucket), not live trade rules.",
    "- Yahoo 15m only retains ~60d, so early-window indicator warmup is limited vs Kite history.",
    "",
  );

  mkdirSync(REPORTS_DIR, { recursive: true });
  const base = `${slug}-range-indicator-analysis-${outSuffix}`;
  const mdPath = resolve(REPORTS_DIR, `${base}.md`);
  const jsonPath = resolve(REPORTS_DIR, `${base}.json`);

  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        symbol: reportSymbol,
        window: rangePayload.window,
        tradeDaysScanned: rangePayload.tradeDaysScanned,
        dataSource: `yahoo:${yahooSymbol(reportSymbol)}:15m:${yahooRange}`,
        missing,
        generatedAtUtc,
        favourableSummary: analyses.map((a) => ({
          range: a.label,
          buy: {
            n: a.buy.count,
            rsiIqr: [a.buy.rsi.p25, a.buy.rsi.p75, a.buy.rsi.median],
            smiIqr: [a.buy.smi.p25, a.buy.smi.p75, a.buy.smi.median],
            bbLowerGapIqr: [
              a.buy.bbRelevantGapPct.p25,
              a.buy.bbRelevantGapPct.p75,
              a.buy.bbRelevantGapPct.median,
            ],
            bbMatchShare: a.buy.bbMatchShare,
            favourable: a.buy.favourable,
          },
          sell: {
            n: a.sell.count,
            rsiIqr: [a.sell.rsi.p25, a.sell.rsi.p75, a.sell.rsi.median],
            smiIqr: [a.sell.smi.p25, a.sell.smi.p75, a.sell.smi.median],
            bbUpperGapIqr: [
              a.sell.bbRelevantGapPct.p25,
              a.sell.bbRelevantGapPct.p75,
              a.sell.bbRelevantGapPct.median,
            ],
            bbMatchShare: a.sell.bbMatchShare,
            favourable: a.sell.favourable,
          },
        })),
        analyses,
        enriched,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(mdPath, `${lines.join("\n")}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        symbol: reportSymbol,
        enriched: enriched.length,
        missing,
        candles: candles.length,
        markdown: mdPath,
        json: jsonPath,
        summary: analyses.map((a) => ({
          range: a.label,
          buy: {
            n: a.buy.count,
            rsi: `${a.buy.rsi.p25}-${a.buy.rsi.p75}`,
            smi: `${a.buy.smi.p25}-${a.buy.smi.p75}`,
            bb: `${a.buy.bbRelevantGapPct.p25}-${a.buy.bbRelevantGapPct.p75}`,
          },
          sell: {
            n: a.sell.count,
            rsi: `${a.sell.rsi.p25}-${a.sell.rsi.p75}`,
            smi: `${a.sell.smi.p25}-${a.sell.smi.p75}`,
            bb: `${a.sell.bbRelevantGapPct.p25}-${a.sell.bbRelevantGapPct.p75}`,
          },
        })),
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
