#!/usr/bin/env node
/**
 * RulePNB1 backtest report — PNB, 1 Jan → 31 Mar 2026, qty 100.
 *
 * Data: Upstox 1m → NSE 15m (warmup from Dec 2025 for SMI).
 *
 * Usage:
 *   npx tsx scripts/study-rule-pnb1-q1-2026.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../src/config.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { runRulePnb1Backtest } from "../src/backtest/runRulePnb1Backtest.js";
import type { Candle, DeepakBacktestTrade } from "../src/types.js";
import { getIstTimeParts } from "../src/utils/marketTime.js";

const REPORTS = resolve(process.cwd(), "reports");
const ISIN = "INE160A01022";
const WARMUP_FROM = "2025-12-01";
const STUDY_FROM = "2026-01-01";
const STUDY_TO = "2026-03-31";
const QTY = 100;
const SESSION_START_MIN = 9 * 60 + 15;
const SESSION_END_MIN = 15 * 60 + 30;

function round(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  d.setDate(d.getDate() + days);
  return getIstTimeParts(d).dateKey;
}

function minutesToHm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
  if (!res.ok) throw new Error(`Upstox ${isin} ${from}→${to}: HTTP ${res.status}`);
  const payload = (await res.json()) as {
    status?: string;
    message?: string;
    data?: { candles?: Array<[string, number, number, number, number, number, number]> };
  };
  if (payload.status !== "success") {
    throw new Error(`Upstox ${isin} ${from}→${to}: ${payload.message ?? "failed"}`);
  }
  return (payload.data?.candles ?? [])
    .map((row) => ({
      timestamp: new Date(row[0]),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5] ?? 0,
    }))
    .filter((c) => [c.open, c.high, c.low, c.close].every(Number.isFinite));
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
    console.log(`  cache hit 1m ${isin} (${raw.length} bars)`);
    return raw.map((c) => ({ ...c, timestamp: new Date(c.timestamp) }));
  }

  const all: Candle[] = [];
  for (const chunk of monthChunks(from, to)) {
    process.stdout.write(`  fetch 1m ${isin} ${chunk.from}→${chunk.to} ... `);
    const bars = await fetchUpstox1m(isin, chunk.from, chunk.to);
    console.log(`${bars.length} bars`);
    all.push(...bars);
    await new Promise((r) => setTimeout(r, 200));
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
      deduped.map((c) => ({ ...c, timestamp: c.timestamp.toISOString() })),
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
    const bucketMins = SESSION_START_MIN + Math.floor((mins - SESSION_START_MIN) / 15) * 15;
    if (bucketMins > SESSION_END_MIN) continue;
    const bucketHm = minutesToHm(bucketMins);
    const key = `${parts.dateKey}T${bucketHm}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        timestamp: new Date(`${parts.dateKey}T${bucketHm}:00+05:30`),
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

type TradeRow = DeepakBacktestTrade & {
  qty: number;
  pnlInr: number | null;
  movePct: number | null;
};

function dayLabel(dateKey: string): string {
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
  ];
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

async function main(): Promise<void> {
  mkdirSync(REPORTS, { recursive: true });
  const { squareOffPct, smi } = config.rulePnb1;
  console.log(
    `RulePNB1 · PNB · ${STUDY_FROM}→${STUDY_TO} · qty ${QTY} · SQ ${squareOffPct}%`,
  );

  const minuteBars = await fetchRange1m(ISIN, WARMUP_FROM, STUDY_TO);
  const candles15 = aggregateTo15m(minuteBars);
  console.log(`15m bars: ${candles15.length}`);
  const snapshots = buildIndicatorSnapshots(candles15);
  const { trades, summary } = runRulePnb1Backtest(
    snapshots,
    STUDY_FROM,
    STUDY_TO,
  );

  const rows: TradeRow[] = trades.map((t) => {
    const entryPrice = round(t.entryPrice);
    const exitPrice = t.exitPrice == null ? null : round(t.exitPrice);
    const movePct = t.profit == null ? null : round(t.profit, 2);
    const pnlInr =
      exitPrice == null
        ? null
        : t.side === "BUY"
          ? round((exitPrice - entryPrice) * QTY)
          : round((entryPrice - exitPrice) * QTY);
    return {
      ...t,
      entryPrice,
      exitPrice,
      profit: movePct,
      qty: QTY,
      pnlInr,
      movePct,
    };
  });

  const hit = rows.filter((r) => r.targetHit);
  const miss = rows.filter((r) => !r.targetHit);
  const buy = rows.filter((r) => r.side === "BUY");
  const sell = rows.filter((r) => r.side === "SELL");
  const pnlHit = hit
    .map((r) => r.pnlInr)
    .filter((v): v is number => v != null);
  const totalPnlHit = pnlHit.reduce((a, b) => a + b, 0);
  const avgPnlHit = pnlHit.length ? totalPnlHit / pnlHit.length : null;

  const md: string[] = [
    `# RulePNB1 · PNB · Jan–Mar 2026 · qty ${QTY}`,
    "",
    `- **Rule:** RulePNB1 (SMI black↔red cross + ${squareOffPct}% square-off)`,
    `- **Symbol:** PNB`,
    `- **Quantity:** **${QTY}**`,
    `- **Window:** ${STUDY_FROM} → ${STUDY_TO}`,
    `- **Session:** ${config.rulePnb1.sessionStart}–${config.rulePnb1.sessionEnd} IST`,
    `- **SMI:** Stch Mtm \`(${smi.lengthK}, ${smi.lengthD}, ${smi.lengthEma})\``,
    `- **Entry:** SELL on black↓red · BUY on black↑red · price = 15m mid \`(H+L)/2\``,
    `- **Square-off (SQ):** favourable mid move ≥ **${squareOffPct}%** same day`,
    `- **P&L ₹:** BUY \`(SQ − entry) × ${QTY}\` · SELL \`(entry − SQ) × ${QTY}\` (only when SQ hit)`,
    `- **Data:** Upstox 1m→15m (\`NSE_EQ|${ISIN}\`) · warmup ${WARMUP_FROM}`,
    `- **Trade days scanned:** **${summary.tradingDaysScanned}**`,
    `- **Signals:** **${rows.length}** (BUY **${buy.length}** · SELL **${sell.length}**)`,
    `- **SQ hit:** **${hit.length}** · **No SQ same day:** **${miss.length}**`,
    `- **Total P&L (SQ-hit only):** **₹${round(totalPnlHit).toFixed(2)}** · avg/hit **₹${avgPnlHit == null ? "—" : round(avgPnlHit).toFixed(2)}**`,
    `- **Generated (UTC):** ${new Date().toISOString()}`,
    "",
    "## Trades (chronological)",
    "",
    "| # | Day | Date | Side | Entry time | Entry ₹ | SQ time | SQ ₹ | Move % | P&L ₹ | SQ hit |",
    "|--:|-----|------|------|------------|--------:|---------|-----:|-------:|------:|:------:|",
  ];

  rows.forEach((r, i) => {
    md.push(
      `| ${i + 1} | ${dayLabel(r.date)} | ${r.date} | ${r.side} | ${r.entryTimeIst} | ${r.entryPrice.toFixed(2)} | ${r.exitTimeIst ?? "—"} | ${r.exitPrice == null ? "—" : r.exitPrice.toFixed(2)} | ${r.movePct == null ? "—" : `${r.movePct.toFixed(2)}%`} | ${r.pnlInr == null ? "—" : r.pnlInr.toFixed(2)} | ${r.targetHit ? "Y" : "N"} |`,
    );
  });
  md.push("");

  md.push(
    "## SQ hit only",
    "",
    "| # | Day | Date | Side | Entry time | Entry ₹ | SQ time | SQ ₹ | Move % | P&L ₹ |",
    "|--:|-----|------|------|------------|--------:|---------|-----:|-------:|------:|",
  );
  hit.forEach((r, i) => {
    md.push(
      `| ${i + 1} | ${dayLabel(r.date)} | ${r.date} | ${r.side} | ${r.entryTimeIst} | ${r.entryPrice.toFixed(2)} | ${r.exitTimeIst ?? "—"} | ${r.exitPrice == null ? "—" : r.exitPrice.toFixed(2)} | ${r.movePct == null ? "—" : `${r.movePct.toFixed(2)}%`} | ${r.pnlInr == null ? "—" : r.pnlInr.toFixed(2)} |`,
    );
  });
  md.push("");

  md.push(
    "## Compact",
    "",
    "| Date | Side | Entry | Entry ₹ | SQ | SQ ₹ | P&L ₹ |",
    "|------|------|-------|--------:|----|-----:|------:|",
  );
  for (const r of rows) {
    md.push(
      `| ${r.date} | ${r.side} | ${r.entryTimeIst} | ${r.entryPrice.toFixed(2)} | ${r.exitTimeIst ?? "—"} | ${r.exitPrice == null ? "—" : r.exitPrice.toFixed(2)} | ${r.pnlInr == null ? "—" : r.pnlInr.toFixed(2)} |`,
    );
  }
  md.push("");

  const mdPath = resolve(REPORTS, "rule-pnb1-q1-2026-qty100.md");
  const jsonPath = resolve(REPORTS, "rule-pnb1-q1-2026-qty100.json");
  writeFileSync(mdPath, md.join("\n"));
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        rule: "rulePnb1",
        symbol: "PNB",
        qty: QTY,
        squareOffPct,
        smi,
        from: STUDY_FROM,
        to: STUDY_TO,
        summary: {
          ...summary,
          sqHit: hit.length,
          sqMiss: miss.length,
          totalPnlInrSqHit: round(totalPnlHit),
          avgPnlInrSqHit: avgPnlHit == null ? null : round(avgPnlHit),
        },
        trades: rows,
        source: `Upstox 1m→15m NSE_EQ|${ISIN}`,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(
    `Signals ${rows.length} · SQ hit ${hit.length} · miss ${miss.length} · P&L ₹${round(totalPnlHit)}`,
  );
  console.log(`Wrote ${mdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
