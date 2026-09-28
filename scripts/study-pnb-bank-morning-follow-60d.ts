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
import { config, dashboardSymbols, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { getKiteAuthStatus, getKiteLoginUrl } from "../src/kite/kiteAuth.js";
import { hasValidKiteAccessToken } from "../src/kite/kiteTokenStore.js";
import {
  MORNING_TIMES,
  PEER_STOCKS,
  buildDayFollowRows,
  buildSymbolMorningDays,
  filterRowsFollowingPeer,
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

interface KiteProbe {
  connected: boolean;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasAccessToken: boolean;
  localStatusUrl: string;
  kiteLoginHost: string | null;
  kiteLoginHttp: number | null;
  kiteLoginLocationHost: string | null;
  historicalError: string | null;
}

async function probeKiteConnection(): Promise<KiteProbe> {
  const status = getKiteAuthStatus();
  const probe: KiteProbe = {
    connected: status.connected,
    hasApiKey: Boolean(config.kite.apiKey),
    hasApiSecret: Boolean(config.kite.apiSecret),
    hasAccessToken: hasValidKiteAccessToken(),
    localStatusUrl: "http://localhost:3001/api/kite/status",
    kiteLoginHost: null,
    kiteLoginHttp: null,
    kiteLoginLocationHost: null,
    historicalError: null,
  };

  if (!probe.hasApiKey || !probe.hasApiSecret) {
    probe.historicalError = "Missing KITE_API_KEY or KITE_API_SECRET";
    return probe;
  }

  try {
    const kiteLogin = getKiteLoginUrl();
    probe.kiteLoginHost = new URL(kiteLogin).host;
    const loginResponse = await fetch(kiteLogin, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    probe.kiteLoginHttp = loginResponse.status;
    const location = loginResponse.headers.get("location");
    if (location) {
      probe.kiteLoginLocationHost = new URL(
        location,
        "https://kite.zerodha.com",
      ).host;
    }
  } catch (error) {
    probe.historicalError =
      error instanceof Error ? error.message : String(error);
    return probe;
  }

  if (!probe.hasAccessToken) {
    probe.historicalError =
      "Kite not connected. Click Connect Kite to log in, or set KITE_ACCESS_TOKEN in .env.";
  }
  return probe;
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

function pnb1030Price(row: DayFollowRow): string {
  const bar = barAt(row.pnb, "10:30");
  return bar ? money(bar.close) : "—";
}

function niftyScore(row: DayFollowRow): string {
  return scoreFor(row, "NIFTY BANK");
}

function tiedWith(row: DayFollowRow): string {
  const others = row.followed.filter((peer) => peer !== "NIFTY BANK");
  return others.length === 0 ? "—" : others.join(", ");
}

function kiteProbeMarkdown(probe: KiteProbe): string {
  const connected = probe.connected ? "yes" : "no";
  const login =
    probe.kiteLoginHttp == null
      ? "not checked"
      : `${probe.kiteLoginHttp}${probe.kiteLoginLocationHost ? ` → ${probe.kiteLoginLocationHost}` : ""}`;
  return `## Kite connection

- **Connected:** ${connected}
- **API key:** ${probe.hasApiKey ? "present" : "missing"}
- **API secret:** ${probe.hasApiSecret ? "present" : "missing"}
- **Access token:** ${probe.hasAccessToken ? "present" : "missing"}
- **Local status:** \`${probe.localStatusUrl}\` → connected=${probe.connected}
- **Zerodha login:** ${probe.kiteLoginHost ?? "n/a"} HTTP ${login}
- **Historical 15m:** ${probe.historicalError ?? "ready"}
`;
}

function buildMarkdown(input: {
  rows: DayFollowRow[];
  scannedDays: number;
  source: string;
  from: string;
  to: string;
  kite: KiteProbe;
}): string {
  const { rows, scannedDays, source, from, to, kite } = input;
  const unique = rows.filter((row) => row.followed.length === 1).length;
  const tied = rows.filter((row) => row.followed.length > 1).length;
  const share =
    scannedDays === 0 ? "n/a" : `${round((rows.length / scannedDays) * 100, 1)}%`;

  const compact = [
    "| Date | PNB 09:15 color | PNB vs prev close | PNB 09:15 O / H / L / C | PNB 10:30 price ₹ | PNB morning 09:15→10:30 | Score vs NIFTY BANK | Also tied with |",
    "|------|-----------------|-------------------|-------------------------|------------------:|-------------------------|---------------------|----------------|",
    ...rows.map((row) => {
      const openBar = barAt(row.pnb, "09:15");
      return `| ${row.date} | ${colorCell(openBar)} | ${row.pnb.openedVsPreviousClose} | ${ohlc(openBar)} | ${pnb1030Price(row)} | ${row.pnb.morningTrend} | ${niftyScore(row)} | ${tiedWith(row)} |`;
    }),
  ].join("\n");

  const timeHeaders = MORNING_TIMES.flatMap((time) => [
    `${time} color`,
    `${time} O / H / L / C`,
  ]);
  const detailSections = rows.map((row) => {
    const header = `| Stock | Prev close ₹ | vs prev close | ${timeHeaders.join(" | ")} | 10:30 close ₹ | Morning 09:15→10:30 | Follow score |`;
    const align = `|---|---:|---|${timeHeaders.map(() => "---").join("|")}|---:|---|---|`;
    const nifty = row.peers.find((peer) => peer.stock === "NIFTY BANK");
    const stocks: SymbolMorningDay[] = nifty ? [row.pnb, nifty] : [row.pnb];
    const body = stocks
      .map((day) => {
        const cells = MORNING_TIMES.flatMap((time) => {
          const bar = barAt(day, time);
          return [colorCell(bar), ohlc(bar)];
        });
        const close1030 = barAt(day, "10:30");
        const score =
          day.stock === SUBJECT ? "subject" : scoreFor(row, day.stock);
        return `| ${day.stock} ** | ${money(day.previousDayClose)} | ${day.openedVsPreviousClose} | ${cells.join(" | ")} | ${close1030 ? money(close1030.close) : "—"} | ${day.morningTrend} | ${score} |`;
      })
      .join("\n");
    return [
      `### ${formatDayLabel(row.date)} (\`${row.date}\`) — PNB followed **NIFTY BANK**${tiedWith(row) === "—" ? "" : ` (tied with ${tiedWith(row)})`}`,
      "",
      header,
      align,
      body,
    ].join("\n");
  });

  return `# PNB days that followed NIFTY BANK · 09:15–10:30 · 15m · last ${TARGET_TRADE_DAYS} trading days

- **Subject:** PNB
- **Filter:** only sessions where NIFTY BANK was PNB's closest morning match through 10:30 (ties included)
- **Chart:** 15-minute NSE session bars
- **Scanned window:** last ${scannedDays} trading days; **reported:** ${rows.length} NIFTY BANK-follow days (${share}) from ${from} → ${to}
- **Unique NIFTY BANK follow:** ${unique} · **tied with another peer:** ${tied}
- **09:15 vs previous close:** 09:15 open compared with the prior session's last 15m close
- **PNB 10:30 price:** close of PNB's 10:30 IST 15m candle
- **Following score:** +3 if the 09:15 gap direction matches, +1 per matching candle color from 09:15 through 10:30, +3 if the 09:15-open-to-10:30-close trend matches (max 12 when all six bars exist)
- **Data:** ${source}
- **Generated (UTC):** ${new Date().toISOString()}

${kiteProbeMarkdown(kite)}
## PNB sessions that followed NIFTY BANK

${compact}

## Day-by-day PNB vs NIFTY BANK

${detailSections.join("\n\n")}
`;
}

async function loadUniverseBars(kite: KiteProbe): Promise<{
  barsByStock: Record<string, RawBar[]>;
  source: string;
}> {
  const barsByStock: Record<string, RawBar[]> = {};
  if (kite.hasAccessToken) {
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
  process.stdout.write("Checking Kite connection ... ");
  const kite = await probeKiteConnection();
  console.log(kite.connected ? "connected" : "not connected");
  console.log(JSON.stringify(kite, null, 2));

  const { barsByStock, source } = await loadUniverseBars(kite);
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
  const scanned = allRows.slice(-TARGET_TRADE_DAYS);
  const rows = filterRowsFollowingPeer(scanned, "NIFTY BANK");
  if (rows.length === 0) {
    throw new Error("No PNB sessions followed NIFTY BANK in this window");
  }

  mkdirSync(REPORTS_DIR, { recursive: true });
  const mdPath = resolve(REPORTS_DIR, "pnb-bank-morning-follow-60d.md");
  const jsonPath = resolve(REPORTS_DIR, "pnb-bank-morning-follow-60d.json");
  const from = rows[0].date;
  const to = rows[rows.length - 1].date;
  const scannedFrom = scanned[0]?.date ?? from;
  const scannedTo = scanned[scanned.length - 1]?.date ?? to;
  writeFileSync(
    mdPath,
    buildMarkdown({
      rows,
      scannedDays: scanned.length,
      source,
      from,
      to,
      kite,
    }),
  );
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        subject: SUBJECT,
        filterPeer: "NIFTY BANK",
        peers: [...PEER_STOCKS],
        interval: "15m",
        morningTimes: [...MORNING_TIMES],
        source,
        kite,
        scannedFrom,
        scannedTo,
        scannedDays: scanned.length,
        from,
        to,
        tradeDays: rows.length,
        uniqueNiftyFollow: rows.filter((row) => row.followed.length === 1).length,
        tiedWithOtherPeer: rows.filter((row) => row.followed.length > 1).length,
        definitions: {
          openedVsPreviousClose:
            "09:15 open versus previous session last 15m close",
          candleColor: "green if close > open, red if close < open, doji if equal",
          morningTrend: "10:30 close versus that day's 09:15 open",
          pnb1030Price: "Close of PNB's 10:30 IST 15m candle",
          followScore:
            "+3 gap match, +1 per matching 15m color 09:15-10:30, +3 morning-trend match",
        },
        rows: rows.map((row) => ({
          ...row,
          pnb1030Price: barAt(row.pnb, "10:30")?.close ?? null,
        })),
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
        scannedDays: scanned.length,
        niftyFollowDays: rows.length,
        source,
        kite: { connected: kite.connected, hasAccessToken: kite.hasAccessToken },
        from,
        to,
        example: {
          date: rows[rows.length - 1]?.date,
          followed: rows[rows.length - 1]?.followed,
          pnb1030Price: barAt(rows[rows.length - 1].pnb, "10:30")?.close ?? null,
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
