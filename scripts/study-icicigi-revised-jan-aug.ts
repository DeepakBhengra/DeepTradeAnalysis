#!/usr/bin/env node
/**
 * Revised RuleICICIGI Jan–Aug run (BUY guards + sell_cascade).
 *
 * Data: Upstox 1m → NSE 15m. Window defaults to 2026-01-01 → 2026-08-31
 * (clips to last available session if the calendar end is in the future).
 *
 * Usage:
 *   npx tsx scripts/study-icicigi-revised-jan-aug.ts
 *   npx tsx scripts/study-icicigi-revised-jan-aug.ts --from 2026-01-01 --to 2026-08-31
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { evaluateFavourableSymbolDay } from "../src/rules/favourableSymbolRule.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";
import type { Candle, IndicatorSnapshot } from "../src/types.js";

const REPORTS = resolve(process.cwd(), "reports");
const ISIN = "INE765G01017";
const SESSION_START_MIN = 9 * 60 + 15;
const SESSION_END_MIN = 15 * 60 + 30;
const SQUARE_OFF = "15:15";
const WARMUP_FROM = "2025-12-01";

function parseArgs(argv: string[]): { from: string; to: string } {
  let from = "2026-01-01";
  let to = "2026-08-31";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from" && argv[i + 1]) from = argv[++i];
    if (argv[i] === "--to" && argv[i + 1]) to = argv[++i];
  }
  return { from, to };
}

function round(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function mid(s: IndicatorSnapshot): number {
  return (s.high + s.low) / 2;
}

function minutesToHm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return getIstTimeParts(d).dateKey;
}

function monthChunks(from: string, to: string): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const [y, m] = cursor.split("-").map(Number);
    const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
    const monthStartNext = `${next.y}-${String(next.m).padStart(2, "0")}-01`;
    const endDate = addDays(monthStartNext, -1);
    const chunkTo = endDate < to ? endDate : to;
    chunks.push({ from: cursor, to: chunkTo });
    cursor = monthStartNext;
    if (cursor > to) break;
  }
  return chunks;
}

async function fetchUpstox1m(from: string, to: string): Promise<Candle[]> {
  const key = encodeURIComponent(`NSE_EQ|${ISIN}`);
  const url = `https://api.upstox.com/v2/historical-candle/${key}/1minute/${to}/${from}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const j = (await res.json()) as {
    status?: string;
    message?: string;
    data?: { candles?: Array<[string, number, number, number, number, number, number]> };
  };
  if (j.status !== "success") {
    throw new Error(`Upstox ${from}→${to}: ${j.message ?? JSON.stringify(j).slice(0, 200)}`);
  }
  return (j.data?.candles ?? []).map((r) => ({
    timestamp: new Date(r[0]),
    open: r[1],
    high: r[2],
    low: r[3],
    close: r[4],
    volume: r[5] ?? 0,
  }));
}

async function fetchRange1m(from: string, to: string): Promise<Candle[]> {
  const cacheDir = resolve(process.cwd(), ".cache/upstox-1m");
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = resolve(cacheDir, `${ISIN}_${from}_${to}.json`);
  if (existsSync(cachePath)) {
    const raw = JSON.parse(readFileSync(cachePath, "utf8")) as Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
    console.log(`cache hit ${raw.length} bars`);
    return raw.map((c) => ({ ...c, timestamp: new Date(c.timestamp) }));
  }

  const all: Candle[] = [];
  for (const chunk of monthChunks(from, to)) {
    process.stdout.write(`fetch 1m ${chunk.from}→${chunk.to} ... `);
    const bars = await fetchUpstox1m(chunk.from, chunk.to);
    console.log(bars.length);
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
    JSON.stringify(deduped.map((c) => ({ ...c, timestamp: c.timestamp.toISOString() }))),
  );
  return deduped;
}

function aggregateTo15m(minuteBars: Candle[]): Candle[] {
  const buckets = new Map<string, Candle>();
  for (const bar of minuteBars) {
    const p = getIstTimeParts(bar.timestamp);
    if (p.minutesOfDay < SESSION_START_MIN || p.minutesOfDay > SESSION_END_MIN) continue;
    const bucketMins =
      SESSION_START_MIN + Math.floor((p.minutesOfDay - SESSION_START_MIN) / 15) * 15;
    const hm = minutesToHm(bucketMins);
    const key = `${p.dateKey}T${hm}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        timestamp: new Date(`${p.dateKey}T${hm}:00+05:30`),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
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

function squareOff(
  snaps: IndicatorSnapshot[],
  dateKey: string,
  entryTime: string,
  entryPrice: number,
  side: "BUY" | "SELL",
): { bestPct: number | null; bestTime: string | null; eodPct: number | null } {
  let bestPct: number | null = null;
  let bestTime: string | null = null;
  let eodPct: number | null = null;
  for (const s of snaps) {
    const p = getIstTimeParts(s.timestamp);
    if (p.dateKey !== dateKey) continue;
    const t = formatIstTime(s.timestamp);
    if (!(t > entryTime && t <= SQUARE_OFF)) continue;
    const exit = mid(s);
    const pct =
      side === "SELL"
        ? ((entryPrice - exit) / entryPrice) * 100
        : ((exit - entryPrice) / entryPrice) * 100;
    if (bestPct == null || pct > bestPct) {
      bestPct = pct;
      bestTime = t;
    }
    eodPct = pct;
  }
  return { bestPct, bestTime, eodPct };
}

function dayLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function weekday(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });
}

type TradeRow = {
  dateKey: string;
  dayLabel: string;
  weekday: string;
  side: "BUY" | "SELL";
  scenarioKey: string;
  entryTimeIst: string;
  entryPrice: number;
  rsi: number;
  smi: number;
  bestTimeIst: string | null;
  bestPct: number | null;
  eodPct: number | null;
  positiveBest: boolean;
  positiveEod: boolean;
  reasons: string[];
};

async function main(): Promise<void> {
  const { from, to: requestedTo } = parseArgs(process.argv.slice(2));
  mkdirSync(REPORTS, { recursive: true });

  console.log(
    JSON.stringify({
      phase: "start",
      symbol: "ICICIGI",
      from,
      requestedTo,
      warmupFrom: WARMUP_FROM,
      source: "upstox-1m-resampled-15m",
      rule: "RuleICICIGI revised (buyGuards + sellCascade)",
    }),
  );

  const minuteBars = await fetchRange1m(WARMUP_FROM, requestedTo);
  const candles = aggregateTo15m(minuteBars);
  const snapshots = buildIndicatorSnapshots(candles);

  const allDates = [
    ...new Set(
      snapshots
        .filter((s) => {
          const m = getIstTimeParts(s.timestamp).minutesOfDay;
          return m >= SESSION_START_MIN && m <= SESSION_END_MIN;
        })
        .map((s) => getIstTimeParts(s.timestamp).dateKey),
    ),
  ]
    .filter((d) => d >= from && d <= requestedTo)
    .sort();

  const effectiveTo = allDates[allDates.length - 1] ?? requestedTo;
  console.log(`trading days ${allDates.length} (${from} → ${effectiveTo})`);

  const trades: TradeRow[] = [];
  for (const dateKey of allDates) {
    const day = evaluateFavourableSymbolDay("ruleIcicigi", snapshots, dateKey);
    for (const signal of day.signals) {
      const sq = squareOff(
        snapshots,
        dateKey,
        signal.timeIst,
        signal.price,
        signal.side,
      );
      trades.push({
        dateKey,
        dayLabel: dayLabel(dateKey),
        weekday: weekday(dateKey),
        side: signal.side,
        scenarioKey: signal.scenarioKey,
        entryTimeIst: signal.timeIst,
        entryPrice: round(signal.price),
        rsi: round(signal.rsi, 1),
        smi: round(signal.smi, 1),
        bestTimeIst: sq.bestTime,
        bestPct: sq.bestPct == null ? null : round(sq.bestPct),
        eodPct: sq.eodPct == null ? null : round(sq.eodPct),
        positiveBest: (sq.bestPct ?? 0) > 0,
        positiveEod: (sq.eodPct ?? 0) > 0,
        reasons: signal.reasons,
      });
    }
  }

  const byScenario = (key: string) => trades.filter((t) => t.scenarioKey === key);
  const withExit = (rows: TradeRow[]) =>
    rows.filter((t) => t.bestPct != null);

  function summarize(rows: TradeRow[]) {
    const ex = withExit(rows);
    const posBest = ex.filter((t) => t.positiveBest);
    const posEod = ex.filter((t) => t.positiveEod);
    const avgBest =
      ex.reduce((a, t) => a + (t.bestPct ?? 0), 0) / Math.max(ex.length, 1);
    const avgEod =
      ex.reduce((a, t) => a + (t.eodPct ?? 0), 0) / Math.max(ex.length, 1);
    return {
      n: rows.length,
      bestPosPct: ex.length ? round((100 * posBest.length) / ex.length, 1) : 0,
      eodPosPct: ex.length ? round((100 * posEod.length) / ex.length, 1) : 0,
      avgBest: round(avgBest),
      avgEod: round(avgEod),
    };
  }

  const cascade = byScenario("sell_cascade");
  const sellQ = byScenario("sell_quality");
  const buyQ = byScenario("buy_quality");
  const buyE = byScenario("buy_extended");
  const allBuy = trades.filter((t) => t.side === "BUY");
  const allSell = trades.filter((t) => t.side === "SELL");

  const cascadeSum = summarize(cascade);
  const sellQSum = summarize(sellQ);
  const buyQSum = summarize(buyQ);
  const buyESum = summarize(buyE);
  const allSum = summarize(trades);
  const buySum = summarize(allBuy);
  const sellSum = summarize(allSell);

  const md: string[] = [
    `# RuleICICIGI revised — Jan–Aug 2026 signal report`,
    ``,
    `- **Symbol:** ICICIGI`,
    `- **Window:** ${from} → ${effectiveTo}${effectiveTo < requestedTo ? ` _(requested ${requestedTo}; data available through ${effectiveTo})_` : ""}`,
    `- **Trading days:** ${allDates.length}`,
    `- **Source:** Upstox 1m resampled to 15m`,
    `- **Rule:** revised RuleICICIGI — BUY quality/extended + **buyGuards** (SMI/MACD turn + next-bar up + open DD ≤ 0.8%); SELL quality + **sell_cascade** (falling-knife short)`,
    `- **Square-off:** best later mid before ${SQUARE_OFF} IST (SELL % = (entry−exit)/entry)`,
    ``,
    `## Summary`,
    ``,
    `| Bucket | Signals | Best-SQ +% | EOD +% | Avg best % | Avg EOD % |`,
    `|---|---:|---:|---:|---:|---:|`,
    `| **All** | ${allSum.n} | ${allSum.bestPosPct}% | ${allSum.eodPosPct}% | ${allSum.avgBest}% | ${allSum.avgEod}% |`,
    `| BUY (all) | ${buySum.n} | ${buySum.bestPosPct}% | ${buySum.eodPosPct}% | ${buySum.avgBest}% | ${buySum.avgEod}% |`,
    `| SELL (all) | ${sellSum.n} | ${sellSum.bestPosPct}% | ${sellSum.eodPosPct}% | ${sellSum.avgBest}% | ${sellSum.avgEod}% |`,
    `| buy_quality | ${buyQSum.n} | ${buyQSum.bestPosPct}% | ${buyQSum.eodPosPct}% | ${buyQSum.avgBest}% | ${buyQSum.avgEod}% |`,
    `| buy_extended | ${buyESum.n} | ${buyESum.bestPosPct}% | ${buyESum.eodPosPct}% | ${buyESum.avgBest}% | ${buyESum.avgEod}% |`,
    `| sell_quality | ${sellQSum.n} | ${sellQSum.bestPosPct}% | ${sellQSum.eodPosPct}% | ${sellQSum.avgBest}% | ${sellQSum.avgEod}% |`,
    `| **sell_cascade** | **${cascadeSum.n}** | **${cascadeSum.bestPosPct}%** | **${cascadeSum.eodPosPct}%** | **${cascadeSum.avgBest}%** | **${cascadeSum.avgEod}%** |`,
    ``,
    `## sell_cascade patterns (falling-knife → short)`,
    ``,
  ];

  if (cascade.length === 0) {
    md.push(`_No sell_cascade signals in this window._`, ``);
  } else {
    md.push(
      `| # | Date | Entry | Mid | RSI | SMI | Best SQ | EOD | +ve |`,
      `|---:|---|---|---:|---:|---:|---:|---:|:---:|`,
    );
    cascade.forEach((t, i) => {
      md.push(
        `| ${i + 1} | ${t.dayLabel} (${t.weekday}) | ${t.entryTimeIst} | ${t.entryPrice.toFixed(2)} | ${t.rsi} | ${t.smi} | ${t.bestPct ?? "—"}% @ ${t.bestTimeIst ?? "—"} | ${t.eodPct ?? "—"}% | ${t.positiveBest ? "Y" : "N"} |`,
      );
    });
    md.push(``);
  }

  md.push(
    `## All signals (chronological)`,
    ``,
    `| Date | Side | Scenario | Entry | Mid | RSI | SMI | Best % | EOD % | +ve |`,
    `|---|---|---|---|---:|---:|---:|---:|---:|:---:|`,
  );
  for (const t of trades) {
    md.push(
      `| ${t.dayLabel} (${t.weekday}) | ${t.side} | ${t.scenarioKey} | ${t.entryTimeIst} | ${t.entryPrice.toFixed(2)} | ${t.rsi} | ${t.smi} | ${t.bestPct ?? "—"}% | ${t.eodPct ?? "—"}% | ${t.positiveBest ? "Y" : "N"} |`,
    );
  }
  md.push(
    ``,
    `## Notes`,
    ``,
    `- **sell_cascade** = oversold BUY-quality levels with SMI+MACD still falling and next mid lower; entry on confirm bar.`,
    `- SELL quality still takes priority if it fires earlier the same day.`,
    `- BUY guards block longing the same cascade (e.g. 29 Jul BUY suppressed; SELL cascade kept).`,
    ``,
  );

  const outMd = resolve(REPORTS, "icicigi-revised-jan-aug-2026.md");
  const outJson = resolve(REPORTS, "icicigi-revised-jan-aug-2026.json");
  writeFileSync(outMd, md.join("\n"));
  writeFileSync(
    outJson,
    JSON.stringify(
      {
        symbol: "ICICIGI",
        from,
        requestedTo,
        effectiveTo,
        tradingDays: allDates.length,
        source: "upstox-1m-resampled-15m",
        summary: {
          all: allSum,
          buy: buySum,
          sell: sellSum,
          buy_quality: buyQSum,
          buy_extended: buyESum,
          sell_quality: sellQSum,
          sell_cascade: cascadeSum,
        },
        trades,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        phase: "done",
        tradingDays: allDates.length,
        effectiveTo,
        summary: {
          all: allSum,
          sell_cascade: cascadeSum,
          sell_quality: sellQSum,
          buy_quality: buyQSum,
          buy_extended: buyESum,
        },
        report: outMd,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
