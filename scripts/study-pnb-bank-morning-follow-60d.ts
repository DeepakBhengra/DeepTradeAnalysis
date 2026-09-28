#!/usr/bin/env node
/**
 * PNB vs bank peers, 15m, 09:15 through 10:30, last 60 trading days.
 *
 * Prefers Zerodha / Kite historical 15m. Falls back to Upstox public 1m
 * resampled to 15m when Kite is not connected.
 *
 * Usage:
 *   npx tsx scripts/study-pnb-bank-morning-follow-60d.ts
 */
import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dashboardSymbols, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { hasValidKiteAccessToken } from "../src/kite/kiteTokenStore.js";
import {
  MORNING_TIMES,
  PEER_STOCKS,
  buildDayFollowRows,
  buildSymbolMorningDays,
  countFollowAppearances,
  countFollowWins,
  timedBarsFromCandles,
  type DayFollowRow,
  type MorningBar,
  type SymbolMorningDay,
} from "../src/studies/pnbBankMorningFollow.js";
import { getIstTimeParts } from "../src/utils/marketTime.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SUBJECT = "PNB";
const TARGET_TRADE_DAYS = 60;

interface UniverseEntry {
  stock: string;
  upstoxKey: string;
}

const UNIVERSE: UniverseEntry[] = [
  { stock: "HDFCBANK", upstoxKey: "NSE_EQ|INE040A01034" },
  { stock: "KOTAKBANK", upstoxKey: "NSE_EQ|INE237A01036" },
  { stock: "INDUSINDBK", upstoxKey: "NSE_EQ|INE095A01012" },
  { stock: "NIFTY BANK", upstoxKey: "NSE_INDEX|Nifty Bank" },
  { stock: "ICICIBANK", upstoxKey: "NSE_EQ|INE090A01021" },
  { stock: SUBJECT, upstoxKey: "NSE_EQ|INE160A01022" },
];

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

function money(value: number): string {
  return round(value, 2).toFixed(2);
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  date.setDate(date.getDate() + days);
  return getIstTimeParts(date).dateKey;
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

function dashboardFor(stock: string) {
  if (stock === "NIFTY BANK") {
    return dashboardSymbols.niftyBank;
  }
  return resolveDashboardSymbol(stock);
}

async function fetchKite15m(stock: string): Promise<RawBar[]> {
  const dash = dashboardFor(stock);
  const today = getIstTimeParts(new Date()).dateKey;
  const fromDate = addDays(today, -140);
  const candles = await fetchPnbCandles({
    symbol: dash.tradingSymbol,
    exchange: dash.exchange,
    segment: dash.segment,
    interval: "15m",
    fromDate,
    toDate: today,
  });
  return candles.map((candle) => ({
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

async function fetchUpstox1m(
  instrumentKey: string,
  from: string,
  to: string,
): Promise<RawBar[]> {
  const url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/1minute/${to}/${from}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Upstox ${instrumentKey} ${from}→${to}: HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    data?: { candles?: Array<[string, number, number, number, number, number]> };
  };
  if (payload.status !== "success") {
    throw new Error(`Upstox ${instrumentKey} ${from}→${to}: ${payload.message ?? "failed"}`);
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
    const bucketMins =
      sessionStartMin + Math.floor((mins - sessionStartMin) / 15) * 15;
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
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );
}

async function fetchUpstox15m(instrumentKey: string, label: string): Promise<RawBar[]> {
  const today = getIstTimeParts(new Date()).dateKey;
  const from = addDays(today, -140);
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= today) {
    const [year, month] = cursor.split("-").map(Number);
    const next =
      month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
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
    process.stdout.write(`  ${label} Upstox 1m ${chunk.from}→${chunk.to} ... `);
    const bars = await fetchUpstox1m(instrumentKey, chunk.from, chunk.to);
    console.log(`${bars.length} bars`);
    all.push(...bars);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  all.sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
  return aggregateTo15m(all);
}

function barAt(day: SymbolMorningDay, time: string): MorningBar | undefined {
  return day.bars.find((bar) => bar.timeIst === time);
}

function ohlc(bar: MorningBar | undefined): string {
  if (!bar) {
    return "—";
  }
  return `${money(bar.open)} / ${money(bar.high)} / ${money(bar.low)} / ${money(bar.close)}`;
}

function colorCell(bar: MorningBar | undefined): string {
  return bar?.color ?? "—";
}

function scoreFor(row: DayFollowRow, peer: string): string {
  const found = row.scores.find((item) => item.peer === peer);
  if (!found) {
    return "—";
  }
  return `${found.score}/${found.maxScore}`;
}

function followedLabel(row: DayFollowRow): string {
  return row.followed.join(" = ") || "—";
}

function buildMarkdown(input: {
  rows: DayFollowRow[];
  source: string;
  from: string;
  to: string;
}): string {
  const { rows, source, from, to } = input;
  const wins = countFollowWins(rows);
  const appearances = countFollowAppearances(rows);
  const ties = rows.filter((row) => row.followed.length > 1).length;
  const ranked = [...PEER_STOCKS].sort((left, right) => {
    const byAppear = (appearances[right] ?? 0) - (appearances[left] ?? 0);
    if (byAppear !== 0) {
      return byAppear;
    }
    return (wins[right] ?? 0) - (wins[left] ?? 0);
  });
  const top = ranked[0];
  const topAppear = appearances[top] ?? 0;
  const topPct =
    rows.length === 0 ? "n/a" : `${round((topAppear / rows.length) * 100, 1)}%`;

  const summaryTable = [
    "| Peer | Best match including ties | Unique-follow days |",
    "|------|--------------------------:|-------------------:|",
    ...ranked.map((peer) => {
      const appear = appearances[peer] ?? 0;
      const unique = wins[peer] ?? 0;
      const appearPct =
        rows.length === 0 ? "n/a" : `${round((appear / rows.length) * 100, 1)}%`;
      return `| ${peer} | ${appear} (${appearPct}) | ${unique} |`;
    }),
    `| Tie (two or more peers) | ${ties} (${rows.length === 0 ? "n/a" : `${round((ties / rows.length) * 100, 1)}%`}) | — |`,
  ].join("\n");

  const compact = [
    "| Date | PNB 09:15 color | PNB vs prev close | PNB 09:15 O / H / L / C | PNB morning 09:15→10:30 | PNB followed through 10:30 | Score |",
    "|------|-----------------|-------------------|-------------------------|-------------------------|----------------------------|-------|",
    ...rows.map((row) => {
      const openBar = barAt(row.pnb, "09:15");
      const best = row.scores
        .filter((item) => row.followed.includes(item.peer))
        .map((item) => `${item.score}/${item.maxScore}`)[0];
      return `| ${row.date} | ${colorCell(openBar)} | ${row.pnb.openedVsPreviousClose} | ${ohlc(openBar)} | ${row.pnb.morningTrend} | ${followedLabel(row)} | ${best ?? "—"} |`;
    }),
  ].join("\n");

  const timeHeaders = MORNING_TIMES.flatMap((time) => [
    `${time} color`,
    `${time} O / H / L / C`,
  ]);
  const detailSections = rows.map((row) => {
    const header = `| Stock | Prev close ₹ | vs prev close | ${timeHeaders.join(" | ")} | Morning 09:15→10:30 | Follow score |`;
    const align = `|---|---:|---|${timeHeaders.map((title) => (title.includes("H / L") ? "---" : "---")).join("|")}|---|---|`;
    const stocks: SymbolMorningDay[] = [row.pnb, ...row.peers];
    const body = stocks
      .map((day) => {
        const cells = MORNING_TIMES.flatMap((time) => {
          const bar = barAt(day, time);
          return [colorCell(bar), ohlc(bar)];
        });
        const mark = row.followed.includes(day.stock) || day.stock === SUBJECT ? " **" : "";
        const score =
          day.stock === SUBJECT ? "subject" : scoreFor(row, day.stock);
        return `| ${day.stock}${mark} | ${money(day.previousDayClose)} | ${day.openedVsPreviousClose} | ${cells.join(" | ")} | ${day.morningTrend} | ${score} |`;
      })
      .join("\n");
    return [
      `### ${formatDayLabel(row.date)} (\`${row.date}\`) — PNB followed **${followedLabel(row)}**`,
      "",
      header,
      align,
      body,
    ].join("\n");
  });

  return `# PNB vs bank peers · 09:15–10:30 · 15m · last ${TARGET_TRADE_DAYS} trading days

- **Subject:** PNB
- **Peers:** HDFCBANK, KOTAKBANK, INDUSINDBK (listed as INDUSINBK in the request), NIFTY BANK index, ICICIBANK
- **Chart:** 15-minute NSE session bars
- **Window:** ${from} → ${to} (${rows.length} comparable sessions)
- **09:15 vs previous close:** 09:15 open compared with the prior session's last 15m close
- **09:15–10:30 fields:** candle color (close vs open), then open / high / low / close
- **Following score:** +3 if the 09:15 gap direction matches, +1 per matching candle color from 09:15 through 10:30, +3 if the 09:15-open-to-10:30-close trend matches (max 12 when all six bars exist)
- **Data:** ${source}
- **Generated (UTC):** ${new Date().toISOString()}

## Who PNB followed through 10:30

PNB's closest morning match was **${top}** on **${topAppear}/${rows.length}** days (${topPct}), counting ties. Unique-follow days are the subset where only that peer tied for first.

${summaryTable}

## All sessions — PNB summary

${compact}

## Day-by-day peer candles

Rows marked **bold** are PNB or the peer(s) it followed that morning.

${detailSections.join("\n\n")}
`;
}

async function loadUniverseBars(): Promise<{
  barsByStock: Record<string, RawBar[]>;
  source: string;
}> {
  const barsByStock: Record<string, RawBar[]> = {};
  if (hasValidKiteAccessToken()) {
    console.log("Kite access token present — fetching Zerodha historical 15m");
    for (const entry of UNIVERSE) {
      process.stdout.write(`  Kite 15m ${entry.stock} ... `);
      barsByStock[entry.stock] = await fetchKite15m(entry.stock);
      console.log(`${barsByStock[entry.stock].length} bars`);
    }
    return {
      barsByStock,
      source: "Kite Connect historical 15m (Zerodha)",
    };
  }

  console.log(
    "Kite not connected (no KITE_ACCESS_TOKEN) — falling back to Upstox public 1m resampled to 15m",
  );
  for (const entry of UNIVERSE) {
    barsByStock[entry.stock] = await fetchUpstox15m(entry.upstoxKey, entry.stock);
    console.log(`  ${entry.stock} 15m bars: ${barsByStock[entry.stock].length}`);
  }
  return {
    barsByStock,
    source:
      "Upstox public 1m resampled to 15m (Kite historical unavailable — no access token)",
  };
}

async function main(): Promise<void> {
  const { barsByStock, source } = await loadUniverseBars();
  const daysByStock = Object.fromEntries(
    UNIVERSE.map((entry) => [
      entry.stock,
      buildSymbolMorningDays(
        timedBarsFromCandles(barsByStock[entry.stock] ?? []),
        entry.stock,
      ),
    ]),
  );
  const allRows = buildDayFollowRows(daysByStock, SUBJECT, PEER_STOCKS);
  const rows = allRows.slice(-TARGET_TRADE_DAYS);
  if (rows.length === 0) {
    throw new Error("No overlapping PNB / peer morning sessions found");
  }

  mkdirSync(REPORTS_DIR, { recursive: true });
  const mdPath = resolve(REPORTS_DIR, "pnb-bank-morning-follow-60d.md");
  const jsonPath = resolve(REPORTS_DIR, "pnb-bank-morning-follow-60d.json");
  const from = rows[0].date;
  const to = rows[rows.length - 1].date;
  const wins = countFollowWins(rows);
  writeFileSync(mdPath, buildMarkdown({ rows, source, from, to }));
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        subject: SUBJECT,
        peers: [...PEER_STOCKS],
        interval: "15m",
        morningTimes: [...MORNING_TIMES],
        source,
        from,
        to,
        tradeDays: rows.length,
        followWins: wins,
        followAppearances: countFollowAppearances(rows),
        ties: rows.filter((row) => row.followed.length > 1).length,
        definitions: {
          openedVsPreviousClose:
            "09:15 open versus previous session last 15m close",
          candleColor: "green if close > open, red if close < open, doji if equal",
          morningTrend: "10:30 close versus that day's 09:15 open",
          followScore:
            "+3 gap match, +1 per matching 15m color 09:15-10:30, +3 morning-trend match",
        },
        rows,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        wrote: [mdPath, jsonPath],
        tradeDays: rows.length,
        source,
        from,
        to,
        followWins: wins,
        followAppearances: countFollowAppearances(rows),
        example: {
          date: rows[rows.length - 1]?.date,
          followed: rows[rows.length - 1]?.followed,
        },
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
