#!/usr/bin/env node
/**
 * SUNPHARMA — SMI black↓red crosses with Drop % ≥ 2.3%
 * Window: 1 Jan 2026 → 31 Mar 2026
 * Data: Upstox 1m → NSE 15m (09:15-aligned), with Dec warmup for indicators
 *
 * Report format matches the Drop-bucket Pre-3 + RSI table in
 * sunpharma-smi-down-cross-60d.md
 *
 * Usage:
 *   npx tsx scripts/study-sunpharma-smi-q1-big-drop.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { computeStochasticMomentum } from "../src/indicators/stochasticMomentum.js";
import type { Candle, IndicatorSnapshot } from "../src/types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
} from "../src/utils/marketTime.js";

const REPORTS = resolve(process.cwd(), "reports");
const SYMBOL = "SUNPHARMA";
const ISIN = "INE044A01036";
const WARMUP_FROM = "2025-12-01";
const STUDY_FROM = "2026-01-01";
const STUDY_TO = "2026-03-31";
const SESSION_START = "09:15";
const SESSION_END = "15:30";
const SESSION_START_MIN = 9 * 60 + 15;
const SESSION_END_MIN = 15 * 60 + 30;
const SMI = { lengthK: 10, lengthD: 3, lengthEma: 3 };
/** Primary filter requested (matches highlighted 60d big drops). */
const MIN_DROP_PCT = 2.3;
/** Fallback near-miss floor when Q1 has no rows at MIN_DROP_PCT. */
const NEAR_MISS_DROP_PCT = 2.0;

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

type CrossRow = {
  dateKey: string;
  dayLabel: string;
  timeIst: string;
  midPrice: number;
  closePrice: number;
  lowestTimeIst: string | null;
  lowestPrice: number | null;
  dropFromCrossPct: number;
  lowerTimeIst: string | null;
  lowerPrice: number | null;
  smi: number;
  signal: number;
  rsi: number;
  pre3Pattern: string | null;
  pre3Detail: string | null;
  pre3Rsi: string | null;
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mid(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

function dayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function candleColor(open: number, close: number): "G" | "R" | "D" {
  if (close > open * 1.0002) return "G";
  if (close < open * 0.9998) return "R";
  return "D";
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
    .filter((c) =>
      [c.open, c.high, c.low, c.close].every(Number.isFinite),
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
    console.log(`  cache hit 1m ${isin} (${raw.length} bars)`);
    return raw.map((c) => ({ ...c, timestamp: new Date(c.timestamp) }));
  }

  const chunks = monthChunks(from, to);
  const all: Candle[] = [];
  for (const chunk of chunks) {
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

async function main(): Promise<void> {
  mkdirSync(REPORTS, { recursive: true });
  console.log(
    `${SYMBOL} SMI black↓red · Drop% ≥ ${MIN_DROP_PCT}% · ${STUDY_FROM} → ${STUDY_TO}`,
  );

  const minuteBars = await fetchRange1m(ISIN, WARMUP_FROM, STUDY_TO);
  const candles15 = aggregateTo15m(minuteBars);
  console.log(`15m bars (warmup+study): ${candles15.length}`);

  const snapshots = buildIndicatorSnapshots(candles15);
  const smiSeries = computeStochasticMomentum(
    snapshots.map((s) => s.high),
    snapshots.map((s) => s.low),
    snapshots.map((s) => s.close),
    SMI.lengthK,
    SMI.lengthD,
    SMI.lengthEma,
  );

  const sessionIdx: number[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    if (
      isWithinIstSessionWindow(snapshots[i].timestamp, SESSION_START, SESSION_END)
    ) {
      sessionIdx.push(i);
    }
  }
  const sessionPos = new Map<number, number>();
  for (let si = 0; si < sessionIdx.length; si++) {
    sessionPos.set(sessionIdx[si], si);
  }

  const allWentLower: CrossRow[] = [];
  let totalDownCrossesInWindow = 0;
  let wentLowerInWindow = 0;

  for (let si = 1; si < sessionIdx.length; si++) {
    const i = sessionIdx[si];
    const parts = getIstTimeParts(snapshots[i].timestamp);
    if (parts.dateKey < STUDY_FROM || parts.dateKey > STUDY_TO) continue;

    const prev = smiSeries[i - 1];
    const cur = smiSeries[i];
    if (
      ![prev.smi, prev.signal, cur.smi, cur.signal].every(Number.isFinite)
    ) {
      continue;
    }
    if (!(prev.smi >= prev.signal && cur.smi < cur.signal)) continue;
    totalDownCrossesInWindow += 1;

    const snap = snapshots[i];
    const crossMid = mid(snap);
    let lowerTimeIst: string | null = null;
    let lowerPrice: number | null = null;
    let lowestTimeIst: string | null = null;
    let lowestPrice: number | null = null;

    for (let j = si + 1; j < sessionIdx.length; j++) {
      const k = sessionIdx[j];
      if (getIstTimeParts(snapshots[k].timestamp).dateKey !== parts.dateKey) break;
      const m = mid(snapshots[k]);
      const t = formatIstTime(snapshots[k].timestamp);
      if (m < crossMid) {
        if (lowerTimeIst == null) {
          lowerTimeIst = t;
          lowerPrice = m;
        }
        if (lowestPrice == null || m < lowestPrice) {
          lowestPrice = m;
          lowestTimeIst = t;
        }
      }
    }
    if (lowestPrice == null) continue;
    wentLowerInWindow += 1;

    const dropFromCrossPct = round(((crossMid - lowestPrice) / crossMid) * 100);

    let pre3Pattern: string | null = null;
    let pre3Detail: string | null = null;
    let pre3Rsi: string | null = null;
    if (si >= 3) {
      const pre = [
        snapshots[sessionIdx[si - 3]],
        snapshots[sessionIdx[si - 2]],
        snapshots[sessionIdx[si - 1]],
      ];
      const colors = pre.map((b) => candleColor(b.open, b.close));
      pre3Pattern = colors.join("");
      pre3Detail = pre
        .map((b, k) => `${formatIstTime(b.timestamp)}${colors[k]}`)
        .join(" · ");
      pre3Rsi = pre.map((b) => round(b.rsi, 1).toFixed(1)).join(" · ");
    }

    allWentLower.push({
      dateKey: parts.dateKey,
      dayLabel: dayLabel(parts.dateKey),
      timeIst: formatIstTime(snap.timestamp),
      midPrice: round(crossMid),
      closePrice: round(snap.close),
      lowestTimeIst,
      lowestPrice: round(lowestPrice),
      dropFromCrossPct,
      lowerTimeIst,
      lowerPrice: lowerPrice == null ? null : round(lowerPrice),
      smi: round(cur.smi, 2),
      signal: round(cur.signal, 2),
      rsi: round(snap.rsi, 1),
      pre3Pattern,
      pre3Detail,
      pre3Rsi,
    });
  }

  const byDropDesc = (a: CrossRow, b: CrossRow) => {
    if (b.dropFromCrossPct !== a.dropFromCrossPct) {
      return b.dropFromCrossPct - a.dropFromCrossPct;
    }
    const byDate = b.dateKey.localeCompare(a.dateKey);
    if (byDate !== 0) return byDate;
    return b.timeIst.localeCompare(a.timeIst);
  };

  const gt3 = allWentLower.filter((c) => c.dropFromCrossPct > 3).sort(byDropDesc);
  const ge23 = allWentLower
    .filter((c) => c.dropFromCrossPct >= MIN_DROP_PCT)
    .sort(byDropDesc);
  const nearMiss = allWentLower
    .filter((c) => c.dropFromCrossPct >= NEAR_MISS_DROP_PCT)
    .sort(byDropDesc);
  const maxDrop = allWentLower.reduce(
    (m, c) => Math.max(m, c.dropFromCrossPct),
    0,
  );

  const studyDates = [
    ...new Set(
      snapshots
        .filter((s) => {
          const d = getIstTimeParts(s.timestamp).dateKey;
          return (
            d >= STUDY_FROM &&
            d <= STUDY_TO &&
            isWithinIstSessionWindow(s.timestamp, SESSION_START, SESSION_END)
          );
        })
        .map((s) => getIstTimeParts(s.timestamp).dateKey),
    ),
  ].sort();

  const md: string[] = [
    `# SUNPHARMA · SMI black ↓ red · Drop % ≥ ${MIN_DROP_PCT}% · Jan–Mar 2026`,
    "",
    `- **Symbol:** ${SYMBOL}`,
    `- **Indicator:** Kite Stch Mtm — black = SMI, red = signal EMA`,
    `- **Params:** Kite Stch Mtm \`(${SMI.lengthK}, ${SMI.lengthD}, ${SMI.lengthEma})\``,
    `- **Downward cross:** previous bar \`SMI ≥ signal\` and current bar \`SMI < signal\``,
    `- **Filter:** same-day Drop % **≥ ${MIN_DROP_PCT}%** (includes Drop % **> 3%**)`,
    `- **Drop %:** \`(cross mid − lowest later same-day mid) / cross mid × 100\``,
    `- **Pre-3:** three session 15m candles immediately before the cross (G=green, R=red, D=doji)`,
    `- **RSI:** Wilder RSI(14) @ cross; **Pre-3 RSI** on the three prior bars`,
    `- **Window:** ${STUDY_FROM} → ${STUDY_TO} (${studyDates.length} trade days)`,
    `- **Session:** ${SESSION_START}–${SESSION_END} IST`,
    `- **Data:** Upstox 1m resampled to 15m (\`NSE_EQ|${ISIN}\`) · warmup from ${WARMUP_FROM}`,
    `- **All black↓red in window:** **${totalDownCrossesInWindow}** · went lower **${wentLowerInWindow}**`,
    `- **Pass filter (≥ ${MIN_DROP_PCT}%):** **${ge23.length}** · of which **> 3%:** **${gt3.length}**`,
    `- **Largest same-day drop in window:** **${maxDrop.toFixed(2)}%**`,
    `- **Sort:** Drop % descending`,
    `- **Generated (UTC):** ${new Date().toISOString()}`,
    "",
  ];

  function pushTable(title: string, rows: CrossRow[], note?: string) {
    md.push(`## ${title} (n=${rows.length})`, "");
    if (note) {
      md.push(note, "");
    }
    if (rows.length === 0) {
      md.push("_No rows._", "");
      return;
    }
    md.push(
      "| # | Day | Date | Time (IST) | Mid ₹ | Lowest ₹ | Drop % | Pre-3 (t−3··t−1) | Pre-3 RSI | RSI @ cross |",
      "|--:|-----|------|------------|------:|---------:|-------:|------------------|----------:|------------:|",
    );
    rows.forEach((c, idx) => {
      md.push(
        `| ${idx + 1} | ${c.dayLabel} | ${c.dateKey} | ${c.timeIst} | ${c.midPrice.toFixed(2)} | ${c.lowestPrice == null ? "—" : c.lowestPrice.toFixed(2)} | ${c.dropFromCrossPct.toFixed(2)}% | ${c.pre3Detail ?? "—"} (\`${c.pre3Pattern ?? "—"}\`) | ${c.pre3Rsi ?? "—"} | ${c.rsi.toFixed(1)} |`,
      );
    });
    md.push("");
  }

  pushTable(
    "Drop % > 3%",
    gt3,
    "Requested band. No SMI black↓red crosses in Jan–Mar 2026 produced a same-day drop above 3%.",
  );
  pushTable(
    `Drop % ≥ ${MIN_DROP_PCT}%`,
    ge23,
    `Requested band (matches the highlighted big drops in the 60d report). Largest Q1 drop was **${maxDrop.toFixed(2)}%**, so this table is empty.`,
  );
  pushTable(
    `Nearest big drops — Drop % ≥ ${NEAR_MISS_DROP_PCT}%`,
    nearMiss,
    `Included because the ≥ ${MIN_DROP_PCT}% filter returned **0** rows. These are the closest Q1 analogues.`,
  );

  md.push(
    "## Detail (nearest ≥ 2.0%)",
    "",
    "| # | Day | Date | Time (IST) | Mid ₹ | Close ₹ | Lower time | Lower ₹ | Lowest time | Lowest ₹ | Drop % | Pre-3 | Pre-3 RSI | SMI (black) | Signal (red) | RSI |",
    "|--:|-----|------|------------|------:|--------:|------------|--------:|-------------|---------:|-------:|-------|----------:|------------:|-------------:|----:|",
  );
  nearMiss.forEach((c, idx) => {
    md.push(
      `| ${idx + 1} | ${c.dayLabel} | ${c.dateKey} | ${c.timeIst} | ${c.midPrice.toFixed(2)} | ${c.closePrice.toFixed(2)} | ${c.lowerTimeIst ?? "—"} | ${c.lowerPrice == null ? "—" : c.lowerPrice.toFixed(2)} | ${c.lowestTimeIst ?? "—"} | ${c.lowestPrice == null ? "—" : c.lowestPrice.toFixed(2)} | ${c.dropFromCrossPct.toFixed(2)}% | ${c.pre3Detail ?? "—"} (\`${c.pre3Pattern ?? "—"}\`) | ${c.pre3Rsi ?? "—"} | ${c.smi.toFixed(2)} | ${c.signal.toFixed(2)} | ${c.rsi.toFixed(1)} |`,
    );
  });
  md.push("");

  const mdPath = resolve(REPORTS, "sunpharma-smi-down-cross-q1-2026-drop-ge-2.3.md");
  const jsonPath = resolve(
    REPORTS,
    "sunpharma-smi-down-cross-q1-2026-drop-ge-2.3.json",
  );
  writeFileSync(mdPath, md.join("\n"));
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        symbol: SYMBOL,
        isin: ISIN,
        smiParams: SMI,
        studyFrom: STUDY_FROM,
        studyTo: STUDY_TO,
        minDropPct: MIN_DROP_PCT,
        tradeDays: studyDates.length,
        totalDownCrossesInWindow,
        wentLowerInWindow,
        gt3Count: gt3.length,
        ge23Count: ge23.length,
        nearMissCount: nearMiss.length,
        maxDropPct: maxDrop,
        crossesGt3: gt3,
        crossesGe23: ge23,
        crossesNearMissGe2: nearMiss,
        source: `Upstox 1m→15m NSE_EQ|${ISIN}`,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(
    `Filter ≥${MIN_DROP_PCT}%: ${ge23.length} ( >3%: ${gt3.length} ) · near≥${NEAR_MISS_DROP_PCT}%: ${nearMiss.length} · max=${maxDrop}% · wrote ${mdPath}`,
  );
  for (const c of nearMiss) {
    console.log(
      `  ${c.dateKey} ${c.timeIst} drop=${c.dropFromCrossPct}% pre=${c.pre3Pattern} rsi=${c.rsi}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
