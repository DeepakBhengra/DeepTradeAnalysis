#!/usr/bin/env node
/**
 * Pattern study: 3×15m candles + RSI before SMI black↓red crosses,
 * bucketed by same-day Drop %.
 *
 * Buckets:
 *   A: 3%–1%
 *   B: 0.95%–0.4%
 *   C: 0.35%–0.15%
 *
 * Usage:
 *   npx tsx scripts/analyze-sunpharma-smi-precross-patterns.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
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
const YAHOO = "SUNPHARMA.NS";
const SMI = { lengthK: 10, lengthD: 3, lengthEma: 3 };
const SESSION_START = "09:15";
const SESSION_END = "15:30";
const TRADE_DAYS = 60;

type BucketKey = "A_3_to_1" | "B_0_95_to_0_4" | "C_0_35_to_0_15";

const BUCKETS: Record<
  BucketKey,
  { label: string; min: number; max: number }
> = {
  A_3_to_1: { label: "3%–1%", min: 1, max: 3 },
  B_0_95_to_0_4: { label: "0.95%–0.4%", min: 0.4, max: 0.95 },
  C_0_35_to_0_15: { label: "0.35%–0.15%", min: 0.15, max: 0.35 },
};

type PreBar = {
  timeIst: string;
  open: number;
  high: number;
  low: number;
  close: number;
  mid: number;
  rangePct: number;
  bodyPct: number;
  direction: "green" | "red" | "doji";
  upperWickPct: number;
  lowerWickPct: number;
  rsi: number;
  smi: number;
  signal: number;
};

type EventRow = {
  dateKey: string;
  dayLabel: string;
  crossTime: string;
  crossMid: number;
  dropPct: number;
  bucket: BucketKey;
  crossRsi: number;
  crossSmi: number;
  crossSignal: number;
  pre: PreBar[]; // length 3, oldest → newest (t-3, t-2, t-1)
  pattern3: string;
  avgPreRsi: number;
  maxPreRsi: number;
  minPreRsi: number;
  rsiSlope: number; // last pre RSI − first pre RSI
  redCount: number;
  greenCount: number;
  preRangeAvgPct: number;
  lastPreVsCrossMidPct: number; // (pre[-1].mid − crossMid)/crossMid*100
  crossedNearHigh: boolean; // cross mid near max of last 4 mids
};

function round(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
function mid(s: IndicatorSnapshot): number {
  return (s.high + s.low) / 2;
}
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

function bucketOf(drop: number): BucketKey | null {
  for (const [key, b] of Object.entries(BUCKETS) as Array<
    [BucketKey, (typeof BUCKETS)[BucketKey]]
  >) {
    if (drop >= b.min && drop <= b.max) return key;
  }
  return null;
}

function barFeatures(s: IndicatorSnapshot, smi: number, signal: number): PreBar {
  const range = s.high - s.low;
  const body = Math.abs(s.close - s.open);
  const upper = s.high - Math.max(s.open, s.close);
  const lower = Math.min(s.open, s.close) - s.low;
  const denom = s.close || 1;
  let direction: PreBar["direction"] = "doji";
  if (s.close > s.open * 1.0002) direction = "green";
  else if (s.close < s.open * 0.9998) direction = "red";
  return {
    timeIst: formatIstTime(s.timestamp),
    open: round(s.open),
    high: round(s.high),
    low: round(s.low),
    close: round(s.close),
    mid: round(mid(s)),
    rangePct: round((range / denom) * 100, 3),
    bodyPct: round((body / denom) * 100, 3),
    direction,
    upperWickPct: round((upper / denom) * 100, 3),
    lowerWickPct: round((lower / denom) * 100, 3),
    rsi: round(s.rsi, 1),
    smi: round(smi, 2),
    signal: round(signal, 2),
  };
}

async function fetchYahoo15m(): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${YAHOO}?range=60d&interval=15m`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const j = (await res.json()) as any;
  const r = j.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  const ts = r?.timestamp ?? [];
  const out: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i],
      h = q.high?.[i],
      l = q.low?.[i],
      c = q.close?.[i];
    if ([o, h, l, c].some((v) => v == null || !Number.isFinite(v))) continue;
    out.push({
      timestamp: new Date(ts[i] * 1000),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: q.volume?.[i] ?? 0,
    });
  }
  return out.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function avg(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function pct(n: number, d: number): number {
  return d ? round((n / d) * 100, 1) : 0;
}

function summarize(events: EventRow[]) {
  const n = events.length;
  const patterns = new Map<string, number>();
  for (const e of events) {
    patterns.set(e.pattern3, (patterns.get(e.pattern3) ?? 0) + 1);
  }
  const topPatterns = [...patterns.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([p, c]) => ({ pattern: p, count: c, pct: pct(c, n) }));

  const allRed = events.filter((e) => e.redCount === 3).length;
  const allGreen = events.filter((e) => e.greenCount === 3).length;
  const majorityRed = events.filter((e) => e.redCount >= 2).length;
  const majorityGreen = events.filter((e) => e.greenCount >= 2).length;
  const rsiRising = events.filter((e) => e.rsiSlope > 1).length;
  const rsiFalling = events.filter((e) => e.rsiSlope < -1).length;
  const rsiFlat = n - rsiRising - rsiFalling;

  const crossRsis = events.map((e) => e.crossRsi);
  const avgPreRsis = events.map((e) => e.avgPreRsi);
  const maxPreRsis = events.map((e) => e.maxPreRsi);
  const minPreRsis = events.map((e) => e.minPreRsi);
  const slopes = events.map((e) => e.rsiSlope);
  const preRanges = events.map((e) => e.preRangeAvgPct);
  const lastBodies = events.map((e) => e.pre[2]?.bodyPct ?? 0);

  const rsiBins = {
    "RSI≥70": events.filter((e) => e.crossRsi >= 70).length,
    "RSI 60–70": events.filter((e) => e.crossRsi >= 60 && e.crossRsi < 70)
      .length,
    "RSI 50–60": events.filter((e) => e.crossRsi >= 50 && e.crossRsi < 60)
      .length,
    "RSI 40–50": events.filter((e) => e.crossRsi >= 40 && e.crossRsi < 50)
      .length,
    "RSI<40": events.filter((e) => e.crossRsi < 40).length,
  };
  const maxPreBins = {
    "maxPreRSI≥70": events.filter((e) => e.maxPreRsi >= 70).length,
    "maxPreRSI 60–70": events.filter(
      (e) => e.maxPreRsi >= 60 && e.maxPreRsi < 70,
    ).length,
    "maxPreRSI<60": events.filter((e) => e.maxPreRsi < 60).length,
  };

  return {
    n,
    topPatterns,
    candle: {
      allRed3: { count: allRed, pct: pct(allRed, n) },
      allGreen3: { count: allGreen, pct: pct(allGreen, n) },
      majorityRed: { count: majorityRed, pct: pct(majorityRed, n) },
      majorityGreen: { count: majorityGreen, pct: pct(majorityGreen, n) },
      avgPreRangePct: avg(preRanges),
      medianPreRangePct: median(preRanges),
      avgLastPreBodyPct: avg(lastBodies),
    },
    rsi: {
      avgCrossRsi: avg(crossRsis),
      medianCrossRsi: median(crossRsis),
      avgPreRsi: avg(avgPreRsis),
      medianPreRsi: median(avgPreRsis),
      avgMaxPreRsi: avg(maxPreRsis),
      avgMinPreRsi: avg(minPreRsis),
      avgRsiSlope: avg(slopes),
      medianRsiSlope: median(slopes),
      rsiRising: { count: rsiRising, pct: pct(rsiRising, n) },
      rsiFalling: { count: rsiFalling, pct: pct(rsiFalling, n) },
      rsiFlat: { count: rsiFlat, pct: pct(rsiFlat, n) },
      crossBins: Object.fromEntries(
        Object.entries(rsiBins).map(([k, c]) => [k, { count: c, pct: pct(c, n) }]),
      ),
      maxPreBins: Object.fromEntries(
        Object.entries(maxPreBins).map(([k, c]) => [
          k,
          { count: c, pct: pct(c, n) },
        ]),
      ),
    },
  };
}

async function main() {
  mkdirSync(REPORTS, { recursive: true });
  const candles = await fetchYahoo15m();
  const snaps = buildIndicatorSnapshots(candles);
  const smiSeries = computeStochasticMomentum(
    snaps.map((s) => s.high),
    snaps.map((s) => s.low),
    snaps.map((s) => s.close),
    SMI.lengthK,
    SMI.lengthD,
    SMI.lengthEma,
  );

  const dates = [
    ...new Set(
      snaps
        .filter((s) =>
          isWithinIstSessionWindow(s.timestamp, SESSION_START, SESSION_END),
        )
        .map((s) => getIstTimeParts(s.timestamp).dateKey),
    ),
  ].sort();
  const target = new Set(dates.slice(-TRADE_DAYS));

  // index session bars for finding prior same-day bars
  const sessionIdx: number[] = [];
  for (let i = 0; i < snaps.length; i++) {
    if (isWithinIstSessionWindow(snaps[i].timestamp, SESSION_START, SESSION_END)) {
      sessionIdx.push(i);
    }
  }

  const events: EventRow[] = [];

  for (let si = 1; si < sessionIdx.length; si++) {
    const i = sessionIdx[si];
    const parts = getIstTimeParts(snaps[i].timestamp);
    if (!target.has(parts.dateKey)) continue;
    const prev = smiSeries[i - 1];
    const cur = smiSeries[i];
    if (
      ![prev.smi, prev.signal, cur.smi, cur.signal].every(Number.isFinite)
    ) {
      continue;
    }
    if (!(prev.smi >= prev.signal && cur.smi < cur.signal)) continue;

    // find drop after cross (same day)
    const crossMid = mid(snaps[i]);
    let lowest: number | null = null;
    for (let j = si + 1; j < sessionIdx.length; j++) {
      const k = sessionIdx[j];
      if (getIstTimeParts(snaps[k].timestamp).dateKey !== parts.dateKey) break;
      const m = mid(snaps[k]);
      if (m < crossMid && (lowest == null || m < lowest)) lowest = m;
    }
    if (lowest == null) continue;
    const dropPct = round(((crossMid - lowest) / crossMid) * 100);
    const bucket = bucketOf(dropPct);
    if (!bucket) continue;

    // 3 prior session bars (prefer same day; allow prior day if needed for early crosses)
    if (si < 3) continue;
    const preIdx = [sessionIdx[si - 3], sessionIdx[si - 2], sessionIdx[si - 1]];
    const pre = preIdx.map((idx) =>
      barFeatures(snaps[idx], smiSeries[idx].smi, smiSeries[idx].signal),
    );
    const pattern3 = pre.map((b) => (b.direction === "green" ? "G" : b.direction === "red" ? "R" : "D")).join("");
    const redCount = pre.filter((b) => b.direction === "red").length;
    const greenCount = pre.filter((b) => b.direction === "green").length;

    events.push({
      dateKey: parts.dateKey,
      dayLabel: dayLabel(parts.dateKey),
      crossTime: formatIstTime(snaps[i].timestamp),
      crossMid: round(crossMid),
      dropPct,
      bucket,
      crossRsi: round(snaps[i].rsi, 1),
      crossSmi: round(cur.smi, 2),
      crossSignal: round(cur.signal, 2),
      pre,
      pattern3,
      avgPreRsi: round(avg(pre.map((b) => b.rsi))!, 1),
      maxPreRsi: round(Math.max(...pre.map((b) => b.rsi)), 1),
      minPreRsi: round(Math.min(...pre.map((b) => b.rsi)), 1),
      rsiSlope: round(pre[2].rsi - pre[0].rsi, 1),
      redCount,
      greenCount,
      preRangeAvgPct: round(avg(pre.map((b) => b.rangePct))!, 3),
      lastPreVsCrossMidPct: round(
        ((pre[2].mid - crossMid) / crossMid) * 100,
        3,
      ),
      crossedNearHigh:
        crossMid >= Math.max(...pre.map((b) => b.mid), crossMid) * 0.998,
    });
  }

  const byBucket: Record<BucketKey, EventRow[]> = {
    A_3_to_1: [],
    B_0_95_to_0_4: [],
    C_0_35_to_0_15: [],
  };
  for (const e of events) byBucket[e.bucket].push(e);

  const summaries = Object.fromEntries(
    (Object.keys(BUCKETS) as BucketKey[]).map((k) => [k, summarize(byBucket[k])]),
  ) as Record<BucketKey, ReturnType<typeof summarize>>;

  // Find distinctive patterns: pattern freq delta vs other buckets
  function contrastNotes(): string[] {
    const notes: string[] = [];
    const A = summaries.A_3_to_1;
    const B = summaries.B_0_95_to_0_4;
    const C = summaries.C_0_35_to_0_15;
    if (!A.n || !B.n || !C.n) return notes;

    // RSI
    if ((A.rsi.avgCrossRsi ?? 0) - (C.rsi.avgCrossRsi ?? 0) >= 5) {
      notes.push(
        `**RSI at cross is higher in big drops (A):** avg ${round(A.rsi.avgCrossRsi!)} vs mid ${round(B.rsi.avgCrossRsi!)} vs small ${round(C.rsi.avgCrossRsi!)}.`,
      );
    } else if ((C.rsi.avgCrossRsi ?? 0) - (A.rsi.avgCrossRsi ?? 0) >= 5) {
      notes.push(
        `**RSI at cross is higher in small drops (C):** avg ${round(C.rsi.avgCrossRsi!)} vs mid ${round(B.rsi.avgCrossRsi!)} vs big ${round(A.rsi.avgCrossRsi!)}.`,
      );
    } else {
      notes.push(
        `**RSI at cross is similar across buckets** (A ${round(A.rsi.avgCrossRsi!)} · B ${round(B.rsi.avgCrossRsi!)} · C ${round(C.rsi.avgCrossRsi!)}) — not a strong separator.`,
      );
    }

    if ((A.rsi.avgMaxPreRsi ?? 0) - (C.rsi.avgMaxPreRsi ?? 0) >= 5) {
      notes.push(
        `**Max RSI in the 3 pre-bars is elevated for A** (${round(A.rsi.avgMaxPreRsi!)} vs C ${round(C.rsi.avgMaxPreRsi!)}).`,
      );
    }

    // candle color
    if (A.candle.majorityRed.pct - C.candle.majorityRed.pct >= 15) {
      notes.push(
        `**Pre-cross candles are redder before big drops:** majority-red ${A.candle.majorityRed.pct}% (A) vs ${C.candle.majorityRed.pct}% (C).`,
      );
    } else if (C.candle.majorityRed.pct - A.candle.majorityRed.pct >= 15) {
      notes.push(
        `**Paradox:** small drops (C) show more majority-red pre-bars (${C.candle.majorityRed.pct}% vs A ${A.candle.majorityRed.pct}%).`,
      );
    } else {
      notes.push(
        `**3-candle color mix is not sharply different** (majority-red A ${A.candle.majorityRed.pct}% · B ${B.candle.majorityRed.pct}% · C ${C.candle.majorityRed.pct}%).`,
      );
    }

    // range
    if ((A.candle.avgPreRangePct ?? 0) - (C.candle.avgPreRangePct ?? 0) >= 0.05) {
      notes.push(
        `**Pre-cross ranges are wider before big drops** (avg range% A ${round(A.candle.avgPreRangePct!, 3)} vs C ${round(C.candle.avgPreRangePct!, 3)}).`,
      );
    }

    // RSI slope
    if ((A.rsi.rsiFalling.pct ?? 0) - (C.rsi.rsiFalling.pct ?? 0) >= 15) {
      notes.push(
        `**RSI more often rolling over before A drops** (falling slope ${A.rsi.rsiFalling.pct}% vs C ${C.rsi.rsiFalling.pct}%).`,
      );
    } else if ((A.rsi.rsiRising.pct ?? 0) - (C.rsi.rsiRising.pct ?? 0) >= 15) {
      notes.push(
        `**RSI still rising into the cross more often for A** (${A.rsi.rsiRising.pct}% vs C ${C.rsi.rsiRising.pct}%) — classic late overbought fade.`,
      );
    }

    // last candle before cross (exhaustion vs already rolling)
    const endsGreen = (evs: EventRow[]) =>
      pct(evs.filter((e) => e.pattern3.endsWith("G")).length, evs.length);
    const endsRed = (evs: EventRow[]) =>
      pct(evs.filter((e) => e.pattern3.endsWith("R")).length, evs.length);
    const aEndG = endsGreen(byBucket.A_3_to_1);
    const cEndG = endsGreen(byBucket.C_0_35_to_0_15);
    const aEndR = endsRed(byBucket.A_3_to_1);
    const cEndR = endsRed(byBucket.C_0_35_to_0_15);
    if (aEndG - cEndG >= 15) {
      notes.push(
        `**Last pre-candle is green far more often before big drops** (ends-G A ${aEndG}% vs C ${cEndG}%; ends-R A ${aEndR}% vs C ${cEndR}%) — looks like a late push that fails after the SMI cross.`,
      );
    }

    // bipolar RSI in A
    const aHi = A.rsi.crossBins["RSI≥70"]?.pct ?? 0;
    const cHi = C.rsi.crossBins["RSI≥70"]?.pct ?? 0;
    const aLo =
      (A.rsi.crossBins["RSI 40–50"]?.pct ?? 0) +
      (A.rsi.crossBins["RSI<40"]?.pct ?? 0);
    const cLo =
      (C.rsi.crossBins["RSI 40–50"]?.pct ?? 0) +
      (C.rsi.crossBins["RSI<40"]?.pct ?? 0);
    if (aHi - cHi >= 10) {
      notes.push(
        `**RSI≥70 at cross is more common in A** (${aHi}% vs C ${cHi}%), but A is also often mid/low (RSI<50 ≈ ${round(aLo)}% vs C ${round(cLo)}%) — bipolar, not a clean overbought filter.`,
      );
    }

    // top pattern uniqueness
    const aTop = A.topPatterns[0];
    if (aTop && aTop.pct >= 25) {
      notes.push(
        `**Most common 3-candle pattern in A (\`${aTop.pattern}\`)** appears in ${aTop.pct}% of big-drop crosses.`,
      );
    }

    notes.push(
      `**Caveat:** bucket A has only ${A.n} events — treat A-specific patterns as suggestive, not statistically strong.`,
    );

    return notes;
  }

  const notes = contrastNotes();

  const md: string[] = [
    `# SUNPHARMA · Pre-cross pattern study (3×15m + RSI) by Drop % bucket`,
    "",
    `- **Source crosses:** SMI black↓red, Stch Mtm (10,3,3), same window as \`sunpharma-smi-down-cross-60d\``,
    `- **Buckets:** A = **3%–1%** · B = **0.95%–0.4%** · C = **0.35%–0.15%** (inclusive)`,
    `- **Pre-window:** three session 15m candles immediately before the cross (t−3, t−2, t−1)`,
    `- **Pattern code:** G=green, R=red, D=doji`,
    `- **RSI slope:** RSI(t−1) − RSI(t−3); rising if >+1, falling if <−1`,
    `- **Events in buckets:** A **${summaries.A_3_to_1.n}** · B **${summaries.B_0_95_to_0_4.n}** · C **${summaries.C_0_35_to_0_15.n}**`,
    `- **Generated (UTC):** ${new Date().toISOString()}`,
    "",
    "## Takeaways",
    "",
  ];
  if (notes.length === 0) {
    md.push("- No strong contrasts detected with these sample sizes.");
  } else {
    for (const n of notes) md.push(`- ${n}`);
  }
  md.push("");

  md.push(
    "## Bucket comparison",
    "",
    "| Metric | A 3%–1% | B 0.95%–0.4% | C 0.35%–0.15% |",
    "|--------|--------:|-------------:|--------------:|",
    `| Count | ${summaries.A_3_to_1.n} | ${summaries.B_0_95_to_0_4.n} | ${summaries.C_0_35_to_0_15.n} |`,
    `| Avg RSI @ cross | ${round(summaries.A_3_to_1.rsi.avgCrossRsi!)} | ${round(summaries.B_0_95_to_0_4.rsi.avgCrossRsi!)} | ${round(summaries.C_0_35_to_0_15.rsi.avgCrossRsi!)} |`,
    `| Median RSI @ cross | ${round(summaries.A_3_to_1.rsi.medianCrossRsi!)} | ${round(summaries.B_0_95_to_0_4.rsi.medianCrossRsi!)} | ${round(summaries.C_0_35_to_0_15.rsi.medianCrossRsi!)} |`,
    `| Avg max RSI in pre-3 | ${round(summaries.A_3_to_1.rsi.avgMaxPreRsi!)} | ${round(summaries.B_0_95_to_0_4.rsi.avgMaxPreRsi!)} | ${round(summaries.C_0_35_to_0_15.rsi.avgMaxPreRsi!)} |`,
    `| Avg RSI slope (pre) | ${round(summaries.A_3_to_1.rsi.avgRsiSlope!)} | ${round(summaries.B_0_95_to_0_4.rsi.avgRsiSlope!)} | ${round(summaries.C_0_35_to_0_15.rsi.avgRsiSlope!)} |`,
    `| RSI rising into cross | ${summaries.A_3_to_1.rsi.rsiRising.pct}% | ${summaries.B_0_95_to_0_4.rsi.rsiRising.pct}% | ${summaries.C_0_35_to_0_15.rsi.rsiRising.pct}% |`,
    `| RSI falling into cross | ${summaries.A_3_to_1.rsi.rsiFalling.pct}% | ${summaries.B_0_95_to_0_4.rsi.rsiFalling.pct}% | ${summaries.C_0_35_to_0_15.rsi.rsiFalling.pct}% |`,
    `| Majority red (≥2/3) | ${summaries.A_3_to_1.candle.majorityRed.pct}% | ${summaries.B_0_95_to_0_4.candle.majorityRed.pct}% | ${summaries.C_0_35_to_0_15.candle.majorityRed.pct}% |`,
    `| Majority green (≥2/3) | ${summaries.A_3_to_1.candle.majorityGreen.pct}% | ${summaries.B_0_95_to_0_4.candle.majorityGreen.pct}% | ${summaries.C_0_35_to_0_15.candle.majorityGreen.pct}% |`,
    `| All 3 red | ${summaries.A_3_to_1.candle.allRed3.pct}% | ${summaries.B_0_95_to_0_4.candle.allRed3.pct}% | ${summaries.C_0_35_to_0_15.candle.allRed3.pct}% |`,
    `| All 3 green | ${summaries.A_3_to_1.candle.allGreen3.pct}% | ${summaries.B_0_95_to_0_4.candle.allGreen3.pct}% | ${summaries.C_0_35_to_0_15.candle.allGreen3.pct}% |`,
    `| Avg pre range % | ${round(summaries.A_3_to_1.candle.avgPreRangePct!, 3)} | ${round(summaries.B_0_95_to_0_4.candle.avgPreRangePct!, 3)} | ${round(summaries.C_0_35_to_0_15.candle.avgPreRangePct!, 3)} |`,
    "",
  );

  for (const key of Object.keys(BUCKETS) as BucketKey[]) {
    const b = BUCKETS[key];
    const s = summaries[key];
    const rows = byBucket[key].sort((a, c) => c.dropPct - a.dropPct);
    md.push(`## Bucket ${b.label} (n=${s.n})`, "");
    md.push("### Top 3-candle patterns", "");
    md.push("| Pattern | Count | % |", "|---------|------:|--:|");
    for (const p of s.topPatterns) {
      md.push(`| \`${p.pattern}\` | ${p.count} | ${p.pct}% |`);
    }
    md.push("");
    md.push("### RSI @ cross bins", "");
    md.push("| Bin | Count | % |", "|-----|------:|--:|");
    for (const [name, v] of Object.entries(s.rsi.crossBins)) {
      md.push(`| ${name} | ${v.count} | ${v.pct}% |`);
    }
    md.push("");
    md.push("### Events", "");
    md.push(
      "| Day | Cross | Drop % | Pattern | RSI@x | avgPreRSI | maxPreRSI | RSI slope | pre ranges % |",
      "|-----|-------|-------:|---------|------:|----------:|----------:|----------:|-------------|",
    );
    for (const e of rows) {
      md.push(
        `| ${e.dayLabel} | ${e.crossTime} | ${e.dropPct.toFixed(2)}% | \`${e.pattern3}\` | ${e.crossRsi.toFixed(1)} | ${e.avgPreRsi.toFixed(1)} | ${e.maxPreRsi.toFixed(1)} | ${e.rsiSlope.toFixed(1)} | ${e.pre.map((p) => p.rangePct.toFixed(2)).join(" · ")} |`,
      );
    }
    md.push("");
  }

  const mdPath = resolve(REPORTS, "sunpharma-smi-precross-patterns-by-drop.md");
  const jsonPath = resolve(
    REPORTS,
    "sunpharma-smi-precross-patterns-by-drop.json",
  );
  writeFileSync(mdPath, md.join("\n"));
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        buckets: BUCKETS,
        summaries,
        notes,
        events,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${mdPath}`);
  console.log(
    `A=${summaries.A_3_to_1.n} B=${summaries.B_0_95_to_0_4.n} C=${summaries.C_0_35_to_0_15.n}`,
  );
  for (const n of notes) console.log("-", n.replace(/\*\*/g, ""));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
