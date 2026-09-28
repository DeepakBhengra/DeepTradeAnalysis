#!/usr/bin/env node
/**
 * PNB 15m study: 09:15 price vs previous-day close, and that day's trend.
 *
 * Usage:
 *   npx tsx scripts/study-pnb-open-gap-trend-60d.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildPnbOpenGapRows,
  sessionHighLow,
  type PnbOpenGapRow,
  type SessionDayBars,
} from "../src/studies/pnbOpenGapTrend.js";
import { getIstTimeParts } from "../src/utils/marketTime.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SYMBOL = "PNB";
const YAHOO_SYMBOL = "PNB.NS";
const PNB_ISIN = "INE160A01022";
const SESSION_START = "09:15";
const SESSION_END = "15:15";
const TARGET_TRADE_DAYS = 60;

interface RawBar {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatIstParts(date: Date): { dateKey: string; timeIst: string } {
  const parts = getIstTimeParts(date);
  return {
    dateKey: parts.dateKey,
    timeIst: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
  };
}

function weekdayName(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });
}

function isWeekday(dateKey: string): boolean {
  const weekday = weekdayName(dateKey);
  return weekday !== "Saturday" && weekday !== "Sunday";
}

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

async function fetchYahoo15m(): Promise<RawBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(YAHOO_SYMBOL)}?range=3mo&interval=15m`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    throw new Error(`Yahoo ${YAHOO_SYMBOL} failed: HTTP ${response.status}`);
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
          }>;
        };
      }>;
      error?: { description?: string } | null;
    };
  };
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp?.length || !quote) {
    throw new Error(
      `Yahoo returned no 15m bars for ${YAHOO_SYMBOL}: ${payload.chart?.error?.description ?? "empty"}`,
    );
  }

  const bars: RawBar[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      ![open, high, low, close].every(Number.isFinite)
    ) {
      continue;
    }
    bars.push({
      timestamp: new Date(result.timestamp[i] * 1000),
      open,
      high,
      low,
      close,
    });
  }
  return bars;
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return getIstTimeParts(d).dateKey;
}

async function fetchUpstox1m(from: string, to: string): Promise<RawBar[]> {
  const instrumentKey = encodeURIComponent(`NSE_EQ|${PNB_ISIN}`);
  const url = `https://api.upstox.com/v2/historical-candle/${instrumentKey}/1minute/${to}/${from}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Upstox PNB ${from}→${to}: HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    data?: { candles?: Array<[string, number, number, number, number, number]> };
  };
  if (payload.status !== "success") {
    throw new Error(`Upstox PNB ${from}→${to}: ${payload.message ?? "failed"}`);
  }
  return (payload.data?.candles ?? [])
    .map((row) => ({
      timestamp: new Date(row[0]),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
    }))
    .filter((bar) =>
      [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite),
    );
}

function aggregateTo15m(minuteBars: RawBar[]): RawBar[] {
  const sessionStartMin = 9 * 60 + 15;
  const sessionEndMin = 15 * 60 + 30;
  type Bucket = {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const bar of minuteBars) {
    const parts = getIstTimeParts(bar.timestamp);
    const mins = parts.minutesOfDay;
    if (mins < sessionStartMin || mins > sessionEndMin) {
      continue;
    }
    const bucketMins = sessionStartMin + Math.floor((mins - sessionStartMin) / 15) * 15;
    const hour = Math.floor(bucketMins / 60);
    const minute = bucketMins % 60;
    const timeIst = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const key = `${parts.dateKey}T${timeIst}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        timestamp: new Date(`${parts.dateKey}T${timeIst}:00+05:30`),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      });
      continue;
    }
    existing.high = Math.max(existing.high, bar.high);
    existing.low = Math.min(existing.low, bar.low);
    existing.close = bar.close;
  }

  return [...buckets.values()].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
}

async function fetchUpstox15m(): Promise<RawBar[]> {
  const today = getIstTimeParts(new Date()).dateKey;
  const from = addDays(today, -140);
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= today) {
    const [year, month] = cursor.split("-").map(Number);
    const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    const monthEnd = addDays(
      `${String(next.year).padStart(4, "0")}-${String(next.month).padStart(2, "0")}-01`,
      -1,
    );
    const to = monthEnd < today ? monthEnd : today;
    chunks.push({ from: cursor, to });
    cursor = addDays(to, 1);
  }

  const all: RawBar[] = [];
  for (const chunk of chunks) {
    process.stdout.write(`  Upstox 1m ${chunk.from}→${chunk.to} ... `);
    const bars = await fetchUpstox1m(chunk.from, chunk.to);
    console.log(`${bars.length} bars`);
    all.push(...bars);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  all.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return aggregateTo15m(all);
}

function toSessionDays(bars: RawBar[]): SessionDayBars[] {
  const byDay = new Map<string, RawBar[]>();
  for (const bar of bars) {
    const { dateKey, timeIst } = formatIstParts(bar.timestamp);
    if (!isWeekday(dateKey) || timeIst < SESSION_START || timeIst > SESSION_END) {
      continue;
    }
    const list = byDay.get(dateKey) ?? [];
    list.push(bar);
    byDay.set(dateKey, list);
  }

  const days: SessionDayBars[] = [];
  for (const dateKey of [...byDay.keys()].sort()) {
    const list = (byDay.get(dateKey) ?? []).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    const openBar = list.find((bar) => formatIstParts(bar.timestamp).timeIst === SESSION_START);
    const closeBar = list[list.length - 1];
    const extremes = sessionHighLow(
      list.map((bar) => ({
        timeIst: formatIstParts(bar.timestamp).timeIst,
        high: bar.high,
        low: bar.low,
      })),
    );
    if (!openBar || !closeBar || !extremes) {
      continue;
    }
    days.push({
      dateKey,
      open0915: openBar.open,
      close0915: openBar.close,
      high0915: openBar.high,
      low0915: openBar.low,
      close: closeBar.close,
      high: extremes.high,
      highTimeIst: extremes.highTimeIst,
      low: extremes.low,
      lowTimeIst: extremes.lowTimeIst,
    });
  }
  return days;
}

function signedPct(value: number): string {
  const rounded = round(value, 2).toFixed(2);
  return value > 0 ? `+${rounded}%` : `${rounded}%`;
}

function buildMarkdown(input: {
  rows: PnbOpenGapRow[];
  source: string;
  from: string;
  to: string;
}): string {
  const { rows, source, from, to } = input;
  const gapDown = rows.filter((row) => row.openedVsPreviousClose === "lower");
  const gapUp = rows.filter((row) => row.openedVsPreviousClose === "upper");
  const gapDownContinued = rows.filter((row) => row.matchesGapDownAndDowntrend);
  const gapUpContinued = rows.filter((row) => row.matchesGapUpAndUptrend);
  const exampleDown = gapDownContinued[gapDownContinued.length - 1] ?? gapDownContinued[0];
  const exampleUp = gapUpContinued[gapUpContinued.length - 1] ?? gapUpContinued[0];

  const table = [
    "| Date | Stock | Previous day close ₹ | Next day 09:15 price ₹ | 09:15 candle color | 09:15 high ₹ | 09:15 low ₹ | 09:15 close ₹ | 09:15 high vs prev close | 09:15 low vs prev close | Opened vs previous close | That day trend | Next day low ₹ | Low time (IST) | Next day high ₹ | High time (IST) |",
    "|------|-------|---------------------:|-----------------------:|--------------------|-------------:|------------:|--------------:|--------------------------|-------------------------|--------------------------|----------------|---------------:|----------------|----------------:|-----------------|",
    ...rows.map((row) => {
      const mark =
        row.matchesGapDownAndDowntrend || row.matchesGapUpAndUptrend ? " **" : "";
      const highCross = row.candle0915HighCrossedPrevCloseUp
        ? "highest of 09:15 am price crossed upward the prev close price"
        : "no";
      const lowCross = row.candle0915LowCrossedPrevCloseDown
        ? "lowest of 09:15 am price crossed downward the prev close price"
        : "no";
      return `| ${row.date} | ${row.stock} | ${round(row.previousDayClose, 2).toFixed(2)} | ${round(row.nextDay0915Price, 2).toFixed(2)} | ${row.candle0915Color} | ${round(row.candle0915High, 2).toFixed(2)} | ${round(row.candle0915Low, 2).toFixed(2)} | ${round(row.candle0915Close, 2).toFixed(2)} | ${highCross} | ${lowCross} | ${row.openedVsPreviousClose}${mark} | ${row.dayTrend}${mark} | ${round(row.nextDayLow, 2).toFixed(2)} | ${row.nextDayLowTimeIst} | ${round(row.nextDayHigh, 2).toFixed(2)} | ${row.nextDayHighTimeIst} |`;
    }),
  ].join("\n");

  const example = (row: PnbOpenGapRow | undefined, label: string) => {
    if (!row) {
      return `No ${label} day in this window.`;
    }
    return [
      `- **Date:** ${formatDayLabel(row.date)} (\`${row.date}\`)`,
      `- **Previous day close:** ₹${round(row.previousDayClose, 2).toFixed(2)}`,
      `- **09:15 price:** ₹${round(row.nextDay0915Price, 2).toFixed(2)} (${signedPct(row.gapPct)} vs previous close)`,
      `- **Opened:** ${row.openedVsPreviousClose}`,
      `- **Session close:** ₹${round(row.sessionClose, 2).toFixed(2)} (${signedPct(row.trendPct)} from 09:15)`,
      `- **Day trend:** ${row.dayTrend}`,
      `- **Next day low:** ₹${round(row.nextDayLow, 2).toFixed(2)} at ${row.nextDayLowTimeIst} IST`,
      `- **Next day high:** ₹${round(row.nextDayHigh, 2).toFixed(2)} at ${row.nextDayHighTimeIst} IST`,
      `- **09:15 candle color:** ${row.candle0915Color}`,
      `- **09:15 high:** ₹${round(row.candle0915High, 2).toFixed(2)}${row.candle0915HighCrossedPrevCloseUp ? " — highest of 09:15 am price crossed upward the prev close price" : ""}`,
      `- **09:15 low:** ₹${round(row.candle0915Low, 2).toFixed(2)}${row.candle0915LowCrossedPrevCloseDown ? " — lowest of 09:15 am price crossed downward the prev close price" : ""}`,
      `- **09:15 close:** ₹${round(row.candle0915Close, 2).toFixed(2)}`,
    ].join("\n");
  };

  return `# PNB · 09:15 vs previous close · 15m · last ${TARGET_TRADE_DAYS} trading days

- **Stock:** ${SYMBOL}
- **Chart:** 15-minute NSE session bars (09:15–15:15 IST)
- **09:15 price:** open of the 09:15 candle
- **Previous day close:** close of the last 15m bar of the prior session
- **Day trend:** session close versus that day's 09:15 open (downtrend = closed below 09:15, uptrend = closed above 09:15)
- **Next day high / low:** highest high and lowest low of that same session's 15m bars; time is the first 15m candle that printed the extreme (IST)
- **09:15 candle color:** green if that bar's close > open, red if close < open, doji if equal
- **09:15 high / low / close:** high, low, and close of the 09:15 15m candle; crossed upward / downward if that wick goes through the previous close
- **Window:** ${from} → ${to} (${rows.length} comparable sessions; one extra prior day used for the first previous close)
- **Data:** ${source}
- **Generated (UTC):** ${new Date().toISOString()}

## Requested examples

### Gap down at 09:15 and the day was a downtrend

Opened **lower** than the previous close, and closed **below** 09:15.

${example(exampleDown, "gap-down + downtrend")}

- Matches in window: **${gapDownContinued.length}/${gapDown.length}** gap-down days (${gapDown.length === 0 ? "n/a" : `${round((gapDownContinued.length / gapDown.length) * 100, 1)}%`})

### Gap up at 09:15 and the day was an uptrend

Opened **upper** than the previous close, and closed **above** 09:15.

${example(exampleUp, "gap-up + uptrend")}

- Matches in window: **${gapUpContinued.length}/${gapUp.length}** gap-up days (${gapUp.length === 0 ? "n/a" : `${round((gapUpContinued.length / gapUp.length) * 100, 1)}%`})

## All sessions

Rows marked **bold** match one of the two requested patterns (gap down + downtrend, or gap up + uptrend).

${table}
`;
}

async function main(): Promise<void> {
  let source = `Yahoo Finance 15m (${YAHOO_SYMBOL}, range=3mo)`;
  let bars: RawBar[] = [];
  try {
    process.stdout.write("Fetching Yahoo 15m PNB.NS ... ");
    bars = await fetchYahoo15m();
    console.log(`${bars.length} bars`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`failed (${message})`);
    console.log("Falling back to Upstox 1m resampled to 15m");
    source = `Upstox public 1m resampled to 15m (NSE_EQ|${PNB_ISIN})`;
    bars = await fetchUpstox15m();
    console.log(`Upstox 15m bars: ${bars.length}`);
  }

  const allDays = toSessionDays(bars);
  if (allDays.length < 2) {
    throw new Error(`Need at least 2 session days; got ${allDays.length}`);
  }

  const usableDays = allDays.slice(-(TARGET_TRADE_DAYS + 1));
  const rows = buildPnbOpenGapRows(usableDays, SYMBOL);
  const from = rows[0]?.date ?? usableDays[1]?.dateKey ?? "";
  const to = rows[rows.length - 1]?.date ?? "";

  mkdirSync(REPORTS_DIR, { recursive: true });
  const mdPath = resolve(REPORTS_DIR, "pnb-open-gap-trend-60d.md");
  const jsonPath = resolve(REPORTS_DIR, "pnb-open-gap-trend-60d.json");
  writeFileSync(mdPath, buildMarkdown({ rows, source, from, to }));
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        symbol: SYMBOL,
        interval: "15m",
        source,
        from,
        to,
        tradeDays: rows.length,
        definitions: {
          nextDay0915Price: "Open of the 09:15 IST 15m candle",
          previousDayClose: "Close of the last 15m bar of the prior NSE session",
          dayTrend: "Session close vs that day's 09:15 open",
          nextDayHigh: "Highest 15m high on that session; time is the first 15m candle that printed it",
          nextDayLow: "Lowest 15m low on that session; time is the first 15m candle that printed it",
          candle0915Color: "09:15 15m candle body: green if close > open, red if close < open",
          candle0915High: "High of the 09:15 IST 15m candle",
          candle0915Low: "Low of the 09:15 IST 15m candle",
          candle0915Close: "Close of the 09:15 IST 15m candle",
          candle0915HighCrossedPrevCloseUp:
            "True when the 09:15 candle high is above the previous day's close",
          candle0915LowCrossedPrevCloseDown:
            "True when the 09:15 candle low is below the previous day's close",
        },
        rows,
        examples: {
          gapDownAndDowntrend: rows.filter((row) => row.matchesGapDownAndDowntrend),
          gapUpAndUptrend: rows.filter((row) => row.matchesGapUpAndUptrend),
        },
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  const down = rows.filter((row) => row.matchesGapDownAndDowntrend);
  const up = rows.filter((row) => row.matchesGapUpAndUptrend);
  console.log(
    JSON.stringify(
      {
        wrote: [mdPath, jsonPath],
        tradeDays: rows.length,
        source,
        from,
        to,
        gapDownAndDowntrend: down.length,
        gapUpAndUptrend: up.length,
        exampleDown: down.at(-1)?.date ?? null,
        exampleUp: up.at(-1)?.date ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
