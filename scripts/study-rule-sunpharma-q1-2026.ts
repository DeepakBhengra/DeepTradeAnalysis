#!/usr/bin/env node
/**
 * RuleSUNPHARMA square-off report — SUNPHARMA, 2026-01-01 → 2026-03-30.
 *
 * Format matches Day Scan post-mortem trade table:
 *   Day | Side | Entry | Entry ₹ | SQ | SQ ₹ | Profit
 *
 * Data: Upstox public historical 1m → resampled NSE 15m (09:15-aligned).
 * Entry: RuleSUNPHARMA signal mid before 14:00.
 * SQ: best later same-day mid before 15:15 IST.
 *
 * Usage:
 *   npx tsx scripts/study-rule-sunpharma-q1-2026.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { evaluateRuleSunpharmaDay } from "../src/rules/ruleSunpharmaDecision.js";
import type { Candle, IndicatorSnapshot, RuleSunpharmaSignal } from "../src/types.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const ISIN = "INE044A01036";
const SYMBOL = "SUNPHARMA";
const STUDY_FROM = "2026-01-01";
const STUDY_TO = "2026-03-30";
const WARMUP_FROM = "2025-12-01";
const SESSION_START_MIN = 9 * 60 + 15;
const SESSION_END_MIN = 15 * 60 + 30;
const SQUARE_OFF_END = "15:15";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type TradeRow = {
  dateKey: string;
  dayLabel: string;
  side: "BUY" | "SELL";
  scenarioKey: string;
  entryTimeIst: string;
  entryPrice: number;
  sqTimeIst: string | null;
  sqPrice: number | null;
  profitPct: number | null;
  eodProfitPct: number | null;
  positive: boolean;
  hasExitWindow: boolean;
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function midPrice(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return getIstTimeParts(d).dateKey;
}

function dayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  const weekday = WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  return `${weekday} ${day} ${month}`;
}

function monthChunks(from: string, to: string): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const [y, m] = cursor.split("-").map(Number);
    const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
    const monthEnd = `${String(nextMonth.y).padStart(4, "0")}-${String(nextMonth.m).padStart(2, "0")}-01`;
    const endDate = addDays(monthEnd, -1);
    const chunkTo = endDate < to ? endDate : to;
    chunks.push({ from: cursor, to: chunkTo });
    cursor = monthEnd;
    if (cursor > to) break;
  }
  return chunks;
}

async function fetchUpstox1m(isin: string, from: string, to: string): Promise<Candle[]> {
  const instrumentKey = encodeURIComponent(`NSE_EQ|${isin}`);
  const url = `https://api.upstox.com/v2/historical-candle/${instrumentKey}/1minute/${to}/${from}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Upstox ${isin} ${from}→${to}: HTTP ${res.status}`);
  }
  const payload = (await res.json()) as {
    status?: string;
    message?: string;
    data?: { candles?: Array<[string, number, number, number, number, number, number]> };
  };
  if (payload.status !== "success") {
    throw new Error(`Upstox ${isin} ${from}→${to}: ${payload.message ?? "failed"}`);
  }
  const rows = payload.data?.candles ?? [];
  return rows
    .map((row) => ({
      timestamp: new Date(row[0]),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5] ?? 0,
    }))
    .filter(
      (c) =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close),
    );
}

async function fetchRange1m(isin: string, from: string, to: string): Promise<Candle[]> {
  const cacheDir = resolve(process.cwd(), ".cache/upstox-1m");
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = resolve(cacheDir, `${isin}_${from}_${to}.json`);
  if (existsSync(cachePath)) {
    const raw = JSON.parse(readFileSync(cachePath, "utf8")) as Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    console.log(`cache hit 1m ${isin} (${raw.length} bars)`);
    return raw.map((c) => ({ ...c, timestamp: new Date(c.timestamp) }));
  }

  const chunks = monthChunks(from, to);
  const all: Candle[] = [];
  for (const chunk of chunks) {
    process.stdout.write(`fetch 1m ${isin} ${chunk.from}→${chunk.to} ... `);
    const bars = await fetchUpstox1m(isin, chunk.from, chunk.to);
    console.log(`${bars.length} bars`);
    all.push(...bars);
    await new Promise((r) => setTimeout(r, 250));
  }
  all.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const seen = new Set<number>();
  const deduped = all.filter((c) => {
    const t = c.timestamp.getTime();
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
  writeFileSync(
    cachePath,
    JSON.stringify(
      deduped.map((c) => ({
        ...c,
        timestamp: c.timestamp.toISOString(),
      })),
    ),
  );
  return deduped;
}

function aggregateTo15m(minuteBars: Candle[]): Candle[] {
  type Bucket = {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: Date;
  };
  const buckets = new Map<string, Bucket>();

  for (const bar of minuteBars) {
    const parts = getIstTimeParts(bar.timestamp);
    const mins = parts.minutesOfDay;
    if (mins < SESSION_START_MIN || mins > SESSION_END_MIN) continue;
    const offset = mins - SESSION_START_MIN;
    const bucketMins = SESSION_START_MIN + Math.floor(offset / 15) * 15;
    if (bucketMins > SESSION_END_MIN) continue;
    const bucketHm = minutesToHm(bucketMins);
    const key = `${parts.dateKey}T${bucketHm}`;
    const existing = buckets.get(key);
    if (!existing) {
      const ts = new Date(`${parts.dateKey}T${bucketHm}:00+05:30`);
      buckets.set(key, {
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        timestamp: ts,
      });
    } else {
      existing.high = Math.max(existing.high, bar.high);
      existing.low = Math.min(existing.low, bar.low);
      existing.close = bar.close;
      existing.volume += bar.volume;
    }
  }

  return [...buckets.values()].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
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
  eodProfitPct: number | null;
  positive: boolean;
} {
  const after = snapshots.filter((snapshot) => {
    const parts = getIstTimeParts(snapshot.timestamp);
    if (parts.dateKey !== dateKey) return false;
    const timeIst = formatIstTime(snapshot.timestamp);
    return timeIst > eventTimeIst && timeIst <= SQUARE_OFF_END;
  });

  if (after.length === 0) {
    return {
      hasExitWindow: false,
      bestTimeIst: null,
      bestExitPrice: null,
      bestProfitPct: null,
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
  const eodExit = midPrice(eod);
  const eodProfitPct =
    side === "SELL"
      ? ((entryPrice - eodExit) / entryPrice) * 100
      : ((eodExit - entryPrice) / entryPrice) * 100;

  return {
    hasExitWindow: true,
    bestTimeIst,
    bestExitPrice: bestExitPrice == null ? null : round(bestExitPrice),
    bestProfitPct: bestProfitPct == null ? null : round(bestProfitPct),
    eodProfitPct: round(eodProfitPct),
    positive: (bestProfitPct ?? 0) > 0,
  };
}

function collectTradingDates(snapshots: IndicatorSnapshot[]): string[] {
  const dates = new Set<string>();
  for (const snapshot of snapshots) {
    const parts = getIstTimeParts(snapshot.timestamp);
    if (
      parts.minutesOfDay >= SESSION_START_MIN &&
      parts.minutesOfDay <= SESSION_END_MIN &&
      parts.dateKey >= STUDY_FROM &&
      parts.dateKey <= STUDY_TO
    ) {
      dates.add(parts.dateKey);
    }
  }
  return [...dates].sort();
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function profitCell(pct: number | null): string {
  if (pct == null) return "—";
  const formatted = `${pct.toFixed(2)}%`;
  return pct > 0 ? `**${formatted}**` : formatted;
}

async function main(): Promise<void> {
  mkdirSync(REPORTS_DIR, { recursive: true });
  console.log(`RuleSUNPHARMA · ${SYMBOL} · ${STUDY_FROM} → ${STUDY_TO}`);
  console.log(`Fetching Upstox 1m (warmup ${WARMUP_FROM})…`);

  const minuteBars = await fetchRange1m(ISIN, WARMUP_FROM, STUDY_TO);
  const candles15m = aggregateTo15m(minuteBars);
  console.log(`15m bars: ${candles15m.length}`);
  const snapshots = buildIndicatorSnapshots(candles15m);
  const dates = collectTradingDates(snapshots);
  console.log(`Trading days in window: ${dates.length}`);

  const trades: TradeRow[] = [];
  for (const dateKey of dates) {
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
        dayLabel: dayLabel(dateKey),
        side: signal.side,
        scenarioKey: signal.scenarioKey,
        entryTimeIst: signal.timeIst,
        entryPrice: round(signal.price),
        sqTimeIst: sq.bestTimeIst,
        sqPrice: sq.bestExitPrice,
        profitPct: sq.bestProfitPct,
        eodProfitPct: sq.eodProfitPct,
        positive: sq.positive,
        hasExitWindow: sq.hasExitWindow,
      });
    }
  }

  const withExit = trades.filter((t) => t.hasExitWindow && t.profitPct != null);
  const positive = withExit.filter((t) => t.positive);
  const buys = withExit.filter((t) => t.side === "BUY");
  const sells = withExit.filter((t) => t.side === "SELL");
  const byScenario = new Map<string, number>();
  for (const t of trades) {
    byScenario.set(t.scenarioKey, (byScenario.get(t.scenarioKey) ?? 0) + 1);
  }

  const mdLines: string[] = [
    `# RuleSUNPHARMA · SUNPHARMA · ${STUDY_FROM} → ${STUDY_TO}`,
    "",
    `- **Symbol:** ${SYMBOL}`,
    `- **Rule:** RuleSUNPHARMA (quality / extended / cascade + turn guards)`,
    `- **Entry price:** signal candle mid \`(high + low) / 2\``,
    `- **Square-off:** best later same-day candle mid before \`${SQUARE_OFF_END}\` IST`,
    `- **BUY profit %:** \`(sq − entry) / entry × 100\``,
    `- **SELL profit %:** \`(entry − sq) / entry × 100\``,
    `- **Trading days scanned:** ${dates.length}`,
    `- **Signals:** ${trades.length} (${trades.filter((t) => t.side === "BUY").length} BUY · ${trades.filter((t) => t.side === "SELL").length} SELL)`,
    `- **Best-SQ positive:** ${positive.length}/${withExit.length} (${withExit.length ? round((positive.length / withExit.length) * 100) : 0}%)`,
    `- **Avg best SQ %:** ${avg(withExit.map((t) => t.profitPct!)) == null ? "—" : `${round(avg(withExit.map((t) => t.profitPct!))!)}%`}`,
    `- **BUY avg / +%:** ${avg(buys.map((t) => t.profitPct!)) == null ? "—" : `${round(avg(buys.map((t) => t.profitPct!))!)}%`} · ${buys.length ? round((buys.filter((t) => t.positive).length / buys.length) * 100) : 0}% positive`,
    `- **SELL avg / +%:** ${avg(sells.map((t) => t.profitPct!)) == null ? "—" : `${round(avg(sells.map((t) => t.profitPct!))!)}%`} · ${sells.length ? round((sells.filter((t) => t.positive).length / sells.length) * 100) : 0}% positive`,
    `- **Data:** Upstox public 1m → resampled 15m (ISIN ${ISIN})`,
    `- **Generated (UTC):** ${new Date().toISOString()}`,
    "",
    "## By scenario",
    "",
    "| Scenario | Count |",
    "|----------|------:|",
  ];

  for (const key of [...byScenario.keys()].sort()) {
    mdLines.push(`| ${key.replace(/_/g, " ")} | ${byScenario.get(key)} |`);
  }

  mdLines.push(
    "",
    "## Trades",
    "",
    "| Day | Side | Entry | Entry ₹ | SQ | SQ ₹ | Profit | Scenario |",
    "|-----|------|-------|--------:|----|-----:|-------:|----------|",
  );

  for (const t of trades) {
    mdLines.push(
      `| ${t.dayLabel} | ${t.side} | ${t.entryTimeIst} | ${t.entryPrice.toFixed(2)} | ${t.sqTimeIst ?? "—"} | ${t.sqPrice == null ? "—" : t.sqPrice.toFixed(2)} | ${profitCell(t.profitPct)} | ${t.scenarioKey.replace(/_/g, " ")} |`,
    );
  }

  mdLines.push("");

  const mdPath = resolve(REPORTS_DIR, "sunpharma-rulesunpharma-jan-mar-2026.md");
  const jsonPath = resolve(
    REPORTS_DIR,
    "sunpharma-rulesunpharma-jan-mar-2026.json",
  );
  writeFileSync(mdPath, mdLines.join("\n"));
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        symbol: SYMBOL,
        rule: "ruleSunpharma",
        from: STUDY_FROM,
        to: STUDY_TO,
        tradingDays: dates.length,
        summary: {
          signals: trades.length,
          buyCount: trades.filter((t) => t.side === "BUY").length,
          sellCount: trades.filter((t) => t.side === "SELL").length,
          withExit: withExit.length,
          positiveBestSq: positive.length,
          positivePct: withExit.length
            ? round((positive.length / withExit.length) * 100)
            : 0,
          avgBestSqPct: avg(withExit.map((t) => t.profitPct!)),
          avgBuyBestSqPct: avg(buys.map((t) => t.profitPct!)),
          avgSellBestSqPct: avg(sells.map((t) => t.profitPct!)),
          byScenario: Object.fromEntries(byScenario),
        },
        trades,
        source: `Upstox 1m→15m ISIN ${ISIN}`,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(
    `Signals ${trades.length} · best-SQ+ ${positive.length}/${withExit.length} · avg ${avg(withExit.map((t) => t.profitPct!)) == null ? "—" : `${round(avg(withExit.map((t) => t.profitPct!))!)}%`}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
