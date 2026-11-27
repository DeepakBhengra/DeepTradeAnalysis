#!/usr/bin/env node
/**
 * RuleSUNPHARMA same-day square-off report for SUNPHARMA only.
 *
 * Entry: RuleSUNPHARMA signal mid (high+low)/2
 * Square-off: best later same-day mid before 15:15 IST
 *
 * Usage:
 *   npx tsx scripts/study-rulesunpharma-squareoff.ts --from 2026-07-01 --to 2026-07-31
 *   npx tsx scripts/study-rulesunpharma-squareoff.ts --from 2026-07-01 --to 2026-07-31 --source yahoo
 */
import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import {
  assertRuleSunpharmaSymbol,
  evaluateRuleSunpharmaDay,
} from "../src/rules/ruleSunpharmaDecision.js";
import type {
  Candle,
  IndicatorSnapshot,
  RuleSunpharmaSignal,
} from "../src/types.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SESSION_START = "09:15";
const SESSION_END = "15:15";

function parseArgs(argv: string[]): {
  fromDate: string;
  toDate: string;
  outSuffix: string | null;
  source: "auto" | "kite" | "yahoo";
} {
  let fromDate = "2026-07-01";
  let toDate = "2026-07-31";
  let outSuffix: string | null = null;
  let source: "auto" | "kite" | "yahoo" = "auto";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--from" && argv[i + 1]) {
      fromDate = argv[++i];
      continue;
    }
    if (arg === "--to" && argv[i + 1]) {
      toDate = argv[++i];
      continue;
    }
    if (arg === "--out-suffix" && argv[i + 1]) {
      outSuffix = argv[++i];
      continue;
    }
    if (arg === "--source" && argv[i + 1]) {
      const value = argv[++i].toLowerCase();
      if (value !== "auto" && value !== "kite" && value !== "yahoo") {
        throw new Error("--source must be auto, kite, or yahoo.");
      }
      source = value;
      continue;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new Error("Use YYYY-MM-DD for --from / --to.");
  }
  if (fromDate > toDate) {
    throw new Error("--from must be on or before --to.");
  }

  return { fromDate, toDate, outSuffix, source };
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
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function weekdayName(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });
}

function isWeekday(dateKey: string): boolean {
  const weekday = weekdayName(dateKey);
  return weekday !== "Saturday" && weekday !== "Sunday";
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

async function fetchYahooCandles(symbol: string, range = "60d"): Promise<Candle[]> {
  const ysym = `${symbol.toUpperCase()}.NS`;
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

async function loadCandles(
  symbol: string,
  exchange: string,
  segment: string,
  fromDate: string,
  toDate: string,
  source: "auto" | "kite" | "yahoo",
): Promise<{ candles: Candle[]; dataSource: string }> {
  if (source === "yahoo") {
    return {
      candles: await fetchYahooCandles(symbol, "60d"),
      dataSource: `yahoo:${symbol}.NS:15m:60d`,
    };
  }

  try {
    const candles = await fetchPnbCandles({
      symbol,
      exchange,
      segment,
      fromDate,
      toDate,
    });
    return { candles, dataSource: "kite:15m" };
  } catch (error) {
    if (source === "kite") {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      JSON.stringify({
        phase: "kite-fallback-yahoo",
        reason: message,
      }),
    );
    return {
      candles: await fetchYahooCandles(symbol, "60d"),
      dataSource: `yahoo:${symbol}.NS:15m:60d (kite fallback)`,
    };
  }
}

function collectTradingDates(
  snapshots: IndicatorSnapshot[],
  fromDate: string,
  toDate: string,
): string[] {
  const dates = new Set<string>();
  for (const snapshot of snapshots) {
    const dateKey = getIstTimeParts(snapshot.timestamp).dateKey;
    if (dateKey >= fromDate && dateKey <= toDate && isWeekday(dateKey)) {
      dates.add(dateKey);
    }
  }
  return [...dates].sort();
}

function bestSquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryTimeIst: string,
  side: "BUY" | "SELL",
  entryPrice: number,
): {
  hasExitWindow: boolean;
  squareOffTimeIst: string | null;
  squareOffPrice: number | null;
  profitPct: number | null;
  eodTimeIst: string | null;
  eodPrice: number | null;
  eodProfitPct: number | null;
} {
  const after = snapshots.filter((snapshot) => {
    const parts = getIstTimeParts(snapshot.timestamp);
    if (parts.dateKey !== dateKey) {
      return false;
    }
    const timeIst = formatIstTime(snapshot.timestamp);
    return timeIst > entryTimeIst && timeIst <= SESSION_END;
  });

  if (after.length === 0) {
    return {
      hasExitWindow: false,
      squareOffTimeIst: null,
      squareOffPrice: null,
      profitPct: null,
      eodTimeIst: null,
      eodPrice: null,
      eodProfitPct: null,
    };
  }

  let squareOffTimeIst: string | null = null;
  let squareOffPrice: number | null = null;
  let profitPct: number | null = null;

  for (const snapshot of after) {
    const exitPrice = midPrice(snapshot);
    const pct =
      side === "SELL"
        ? ((entryPrice - exitPrice) / entryPrice) * 100
        : ((exitPrice - entryPrice) / entryPrice) * 100;
    if (profitPct == null || pct > profitPct) {
      profitPct = pct;
      squareOffPrice = exitPrice;
      squareOffTimeIst = formatIstTime(snapshot.timestamp);
    }
  }

  const eod = after[after.length - 1];
  const eodPrice = midPrice(eod);
  const eodProfitPct =
    side === "SELL"
      ? ((entryPrice - eodPrice) / entryPrice) * 100
      : ((eodPrice - entryPrice) / entryPrice) * 100;

  return {
    hasExitWindow: true,
    squareOffTimeIst,
    squareOffPrice: squareOffPrice == null ? null : round(squareOffPrice),
    profitPct: profitPct == null ? null : round(profitPct),
    eodTimeIst: formatIstTime(eod.timestamp),
    eodPrice: round(eodPrice),
    eodProfitPct: round(eodProfitPct),
  };
}

interface TradeRow {
  dateKey: string;
  dayLabel: string;
  weekday: string;
  side: "BUY" | "SELL";
  scenarioKey: string;
  entryTimeIst: string;
  entryPrice: number;
  squareOffTimeIst: string | null;
  squareOffPrice: number | null;
  profitPct: number | null;
  eodTimeIst: string | null;
  eodPrice: number | null;
  eodProfitPct: number | null;
  rsi: number;
  smi: number;
  reasons: string[];
}

async function main(): Promise<void> {
  const { fromDate, toDate, outSuffix, source } = parseArgs(process.argv.slice(2));
  assertRuleSunpharmaSymbol(config.ruleSunpharma.tradingSymbol);
  const dash = resolveDashboardSymbol(config.ruleSunpharma.tradingSymbol);

  // Warm indicators before window start (Kite path). Yahoo 60d already includes lookback.
  const warmFrom = new Date(`${fromDate}T12:00:00+05:30`);
  warmFrom.setDate(warmFrom.getDate() - 45);
  const fetchFrom = warmFrom.toISOString().slice(0, 10);

  console.log(
    JSON.stringify({
      phase: "start",
      rule: "ruleSunpharma",
      symbol: dash.tradingSymbol,
      fromDate,
      toDate,
      fetchFrom,
      source,
    }),
  );

  const { candles, dataSource } = await loadCandles(
    dash.tradingSymbol,
    dash.exchange,
    dash.segment,
    fetchFrom,
    toDate,
    source,
  );
  const snapshots = buildIndicatorSnapshots(candles);
  const tradingDates = collectTradingDates(snapshots, fromDate, toDate);

  const trades: TradeRow[] = [];

  for (const dateKey of tradingDates) {
    const day = evaluateRuleSunpharmaDay(snapshots, dateKey);
    for (const signal of day.signals as RuleSunpharmaSignal[]) {
      const sq = bestSquareOff(
        snapshots,
        dateKey,
        signal.timeIst,
        signal.side,
        signal.price,
      );
      trades.push({
        dateKey,
        dayLabel: formatDayLabel(dateKey),
        weekday: weekdayName(dateKey),
        side: signal.side,
        scenarioKey: signal.scenarioKey,
        entryTimeIst: signal.timeIst,
        entryPrice: round(signal.price),
        squareOffTimeIst: sq.squareOffTimeIst,
        squareOffPrice: sq.squareOffPrice,
        profitPct: sq.profitPct,
        eodTimeIst: sq.eodTimeIst,
        eodPrice: sq.eodPrice,
        eodProfitPct: sq.eodProfitPct,
        rsi: round(signal.rsi, 1),
        smi: round(signal.smi, 1),
        reasons: signal.reasons,
      });
    }
  }

  const buys = trades.filter((t) => t.side === "BUY");
  const sells = trades.filter((t) => t.side === "SELL");
  const withProfit = trades.filter((t) => t.profitPct != null);
  const positive = withProfit
    .filter((t) => (t.profitPct ?? 0) > 0)
    .sort((a, b) => (b.profitPct ?? 0) - (a.profitPct ?? 0));
  const positiveBuys = positive.filter((t) => t.side === "BUY");
  const positiveSells = positive.filter((t) => t.side === "SELL");
  const avg = (values: number[]) =>
    values.length === 0
      ? null
      : round(values.reduce((sum, value) => sum + value, 0) / values.length);

  const generatedAtUtc = new Date().toISOString();
  const suffix =
    outSuffix ??
    `${fromDate.replace(/-/g, "").slice(0, 6)}`;
  mkdirSync(REPORTS_DIR, { recursive: true });
  const mdPath = resolve(
    REPORTS_DIR,
    `rulesunpharma-sunpharma-squareoff-${suffix}.md`,
  );
  const jsonPath = resolve(
    REPORTS_DIR,
    `rulesunpharma-sunpharma-squareoff-${suffix}.json`,
  );
  const positiveMdPath = resolve(
    REPORTS_DIR,
    `rulesunpharma-sunpharma-positive-${suffix}.md`,
  );
  const positiveJsonPath = resolve(
    REPORTS_DIR,
    `rulesunpharma-sunpharma-positive-${suffix}.json`,
  );

  const scenarioLabel = (key: string) => key.replace(/_/g, " ");

  const lines = [
    `# RuleSUNPHARMA — SUNPHARMA square-off report (${fromDate} → ${toDate})`,
    "",
    `- **Rule:** RuleSUNPHARMA (SUNPHARMA-only; separate from Deepak / Deeppro / RulePNB)`,
    `- **Symbol:** ${dash.tradingSymbol}`,
    `- **Window:** ${tradingDates.length} trade days (${fromDate} → ${toDate})`,
    `- **Entry:** RuleSUNPHARMA signal candle mid \`(high+low)/2\``,
    `- **Square-off:** best later same-day mid before \`${SESSION_END}\` IST`,
    `- **BUY profit %:** \`(sq - entry) / entry × 100\``,
    `- **SELL profit %:** \`(entry - sq) / entry × 100\``,
    `- **Signals:** ${trades.length} (${buys.length} BUY · ${sells.length} SELL)`,
    `- **Positive best-SQ:** ${positive.length}/${withProfit.length}`,
    `- **Avg best-SQ % (all signals):** ${avg(withProfit.map((t) => t.profitPct!))?.toFixed(2) ?? "—"}%`,
    `- **Avg best-SQ % (positive only):** ${avg(positive.map((t) => t.profitPct!))?.toFixed(2) ?? "—"}%`,
    `- **Data:** ${dataSource}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Positive profit trades (best same-day square-off)",
    "",
    "| Rank | Day | Weekday | Side | Scenario | Entry time | Entry price | SQ time | SQ price | Profit % | RSI | SMI |",
    "|------|-----|---------|------|----------|------------|-------------|---------|----------|----------|-----|-----|",
  ];

  positive.forEach((trade, index) => {
    lines.push(
      `| ${index + 1} | ${trade.dayLabel} | ${trade.weekday} | ${trade.side} | ${scenarioLabel(trade.scenarioKey)} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | **${trade.profitPct!.toFixed(2)}%** | ${trade.rsi.toFixed(1)} | ${trade.smi.toFixed(1)} |`,
    );
  });
  if (positive.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | — | *none* | — | — |");
  }

  lines.push(
    "",
    "### Positive BUY",
    "",
    "| Day | Entry time | Entry price | SQ time | SQ price | Profit % | Scenario |",
    "|-----|------------|-------------|---------|----------|----------|----------|",
  );
  for (const trade of positiveBuys) {
    lines.push(
      `| ${trade.dayLabel} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | **${trade.profitPct!.toFixed(2)}%** | ${scenarioLabel(trade.scenarioKey)} |`,
    );
  }
  if (positiveBuys.length === 0) {
    lines.push("| — | — | — | — | — | *none* | — |");
  }

  lines.push(
    "",
    "### Positive SELL",
    "",
    "| Day | Entry time | Entry price | SQ time | SQ price | Profit % | Scenario |",
    "|-----|------------|-------------|---------|----------|----------|----------|",
  );
  for (const trade of positiveSells) {
    lines.push(
      `| ${trade.dayLabel} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | **${trade.profitPct!.toFixed(2)}%** | ${scenarioLabel(trade.scenarioKey)} |`,
    );
  }
  if (positiveSells.length === 0) {
    lines.push("| — | — | — | — | — | *none* | — |");
  }

  lines.push(
    "",
    "## All RuleSUNPHARMA trades (chronological)",
    "",
    "| Day | Weekday | Side | Scenario | Entry time | Entry price | SQ time | SQ price | Profit % | RSI | SMI |",
    "|-----|---------|------|----------|------------|-------------|---------|----------|----------|-----|-----|",
  );

  for (const trade of trades) {
    const profit =
      trade.profitPct == null
        ? "—"
        : trade.profitPct > 0
          ? `**${trade.profitPct.toFixed(2)}%**`
          : `${trade.profitPct.toFixed(2)}%`;
    lines.push(
      `| ${trade.dayLabel} | ${trade.weekday} | ${trade.side} | ${scenarioLabel(trade.scenarioKey)} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | ${profit} | ${trade.rsi.toFixed(1)} | ${trade.smi.toFixed(1)} |`,
    );
  }

  if (trades.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | *no signals* | — | — |");
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- RuleSUNPHARMA only evaluates **SUNPHARMA**.",
    "- One earliest BUY (quality preferred over extended) and one earliest SELL quality signal per day.",
    "- Square-off is the **best later mid** before 15:15 (hindsight study metric, not a live fill guarantee).",
    `- Config: BUY quality RSI ${config.ruleSunpharma.buyQuality.minRsi}–${config.ruleSunpharma.buyQuality.maxRsi}, SMI ≤ ${config.ruleSunpharma.buyQuality.maxSmi}, BB lower ≤ ${config.ruleSunpharma.buyQuality.maxBbLowerGapPct}%; SELL quality RSI ${config.ruleSunpharma.sellQuality.minRsi}–${config.ruleSunpharma.sellQuality.maxRsi}, SMI ≥ ${config.ruleSunpharma.sellQuality.minSmi}, BB upper ≤ ${config.ruleSunpharma.sellQuality.maxBbUpperGapPct}%; BUY extended mid SMI ≤ ${config.ruleSunpharma.buyExtended.maxSmi}, BB lower ≤ ${config.ruleSunpharma.buyExtended.maxBbLowerGapPct}%.`,
    "",
  );

  const positiveLines = [
    `# RuleSUNPHARMA — SUNPHARMA positive square-off (${fromDate} → ${toDate})`,
    "",
    `- **Rule:** RuleSUNPHARMA (SUNPHARMA-only)`,
    `- **Symbol:** ${dash.tradingSymbol}`,
    `- **Window:** ${tradingDates.length} trade days (${fromDate} → ${toDate})`,
    `- **Filter:** best same-day square-off profit **> 0%** only`,
    `- **Entry:** RuleSUNPHARMA signal candle mid \`(high+low)/2\``,
    `- **Square-off:** best later same-day mid before \`${SESSION_END}\` IST`,
    `- **Positive trades:** ${positive.length} (${positiveBuys.length} BUY · ${positiveSells.length} SELL)`,
    `- **Avg positive %:** ${avg(positive.map((t) => t.profitPct!))?.toFixed(2) ?? "—"}%`,
    `- **Best trade:** ${
      positive[0]
        ? `${positive[0].side} ${positive[0].dayLabel} ${positive[0].entryTimeIst} → ${positive[0].squareOffTimeIst} **+${positive[0].profitPct!.toFixed(2)}%**`
        : "—"
    }`,
    `- **Data:** ${dataSource}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Positive trades (sorted by profit %)",
    "",
    "| Rank | Day | Weekday | Side | Scenario | Entry time | Entry price | SQ time | SQ price | Profit % |",
    "|------|-----|---------|------|----------|------------|-------------|---------|----------|----------|",
  ];

  positive.forEach((trade, index) => {
    positiveLines.push(
      `| ${index + 1} | ${trade.dayLabel} | ${trade.weekday} | ${trade.side} | ${scenarioLabel(trade.scenarioKey)} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | **${trade.profitPct!.toFixed(2)}%** |`,
    );
  });
  if (positive.length === 0) {
    positiveLines.push("| — | — | — | — | — | — | — | — | — | *none* |");
  }

  positiveLines.push(
    "",
    "### Positive BUY",
    "",
    "| Day | Entry time | Entry price | SQ time | SQ price | Profit % | Scenario | RSI | SMI |",
    "|-----|------------|-------------|---------|----------|----------|----------|-----|-----|",
  );
  for (const trade of positiveBuys) {
    positiveLines.push(
      `| ${trade.dayLabel} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | **${trade.profitPct!.toFixed(2)}%** | ${scenarioLabel(trade.scenarioKey)} | ${trade.rsi.toFixed(1)} | ${trade.smi.toFixed(1)} |`,
    );
  }
  if (positiveBuys.length === 0) {
    positiveLines.push("| — | — | — | — | — | *none* | — | — | — |");
  }

  positiveLines.push(
    "",
    "### Positive SELL",
    "",
    "| Day | Entry time | Entry price | SQ time | SQ price | Profit % | Scenario | RSI | SMI |",
    "|-----|------------|-------------|---------|----------|----------|----------|-----|-----|",
  );
  for (const trade of positiveSells) {
    positiveLines.push(
      `| ${trade.dayLabel} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | **${trade.profitPct!.toFixed(2)}%** | ${scenarioLabel(trade.scenarioKey)} | ${trade.rsi.toFixed(1)} | ${trade.smi.toFixed(1)} |`,
    );
  }
  if (positiveSells.length === 0) {
    positiveLines.push("| — | — | — | — | — | *none* | — | — | — |");
  }

  positiveLines.push(
    "",
    "## Notes",
    "",
    "- Positive only = best later same-day mid before 15:15 produced profit % > 0.",
    "- Hindsight square-off metric — not a live fill guarantee.",
    "",
  );

  writeFileSync(mdPath, `${lines.join("\n")}\n`);
  writeFileSync(positiveMdPath, `${positiveLines.join("\n")}\n`);
  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        rule: "ruleSunpharma",
        symbol: dash.tradingSymbol,
        window: { from: fromDate, to: toDate },
        tradeDaysScanned: tradingDates.length,
        dataSource,
        signalCount: trades.length,
        buyCount: buys.length,
        sellCount: sells.length,
        positiveBestSqCount: positive.length,
        avgBestSqPct: avg(withProfit.map((t) => t.profitPct!)),
        avgPositiveSqPct: avg(positive.map((t) => t.profitPct!)),
        trades,
        positiveTrades: positive,
        generatedAtUtc,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    positiveJsonPath,
    `${JSON.stringify(
      {
        rule: "ruleSunpharma",
        symbol: dash.tradingSymbol,
        window: { from: fromDate, to: toDate },
        tradeDaysScanned: tradingDates.length,
        dataSource,
        positiveCount: positive.length,
        positiveBuyCount: positiveBuys.length,
        positiveSellCount: positiveSells.length,
        avgPositiveSqPct: avg(positive.map((t) => t.profitPct!)),
        positiveTrades: positive,
        generatedAtUtc,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        tradeDaysScanned: tradingDates.length,
        signalCount: trades.length,
        buyCount: buys.length,
        sellCount: sells.length,
        positiveBestSqCount: positive.length,
        avgPositiveSqPct: avg(positive.map((t) => t.profitPct!)),
        dataSource,
        markdown: mdPath,
        positiveMarkdown: positiveMdPath,
        json: jsonPath,
        positiveJson: positiveJsonPath,
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
