#!/usr/bin/env node
/**
 * Study ICICIGI falling-knife → SELL cascade opportunity (Yahoo 15m 60d).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { computeStochasticMomentum } from "../src/indicators/stochasticMomentum.js";
import { config } from "../src/config.js";
import {
  bbMatchGapPct,
  classifyBbBottomMatch,
  pctDistance,
} from "../src/rules/bollingerUtils.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";
import type { Candle, IndicatorSnapshot } from "../src/types.js";

const REPORTS = resolve(process.cwd(), "reports");
const SQUARE_OFF = "15:15";
const ENTRY_DEADLINE = "14:00";

function round(n: number, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
function mid(s: IndicatorSnapshot) {
  return (s.high + s.low) / 2;
}

async function fetchYahoo(): Promise<Candle[]> {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/ICICIGI.NS?range=60d&interval=15m";
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const j = (await res.json()) as any;
  const r = j.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0];
  const out: Candle[] = [];
  for (let i = 0; i < (r?.timestamp?.length ?? 0); i++) {
    const o = q.open?.[i],
      h = q.high?.[i],
      l = q.low?.[i],
      c = q.close?.[i];
    if ([o, h, l, c].some((v) => v == null || !Number.isFinite(v))) continue;
    out.push({
      timestamp: new Date(r.timestamp[i] * 1000),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: q.volume?.[i] ?? 0,
    });
  }
  return out.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function nearLower(s: IndicatorSnapshot, maxGap: number) {
  const m = classifyBbBottomMatch(s.bollinger.lower, s.low, s.close);
  const gap = m
    ? bbMatchGapPct(m, "bottom", s.bollinger.lower, s.low, s.close)
    : pctDistance(s.bollinger.lower, s.low, s.close);
  return { ok: m != null || gap <= maxGap, gap };
}

function sellBest(
  snaps: IndicatorSnapshot[],
  date: string,
  entryTime: string,
  entry: number,
) {
  let best: number | null = null;
  let bestT: string | null = null;
  let eod: number | null = null;
  for (const s of snaps) {
    const p = getIstTimeParts(s.timestamp);
    if (p.dateKey !== date) continue;
    const t = formatIstTime(s.timestamp);
    if (!(t > entryTime && t <= SQUARE_OFF)) continue;
    const pct = ((entry - mid(s)) / entry) * 100; // SELL
    if (best == null || pct > best) {
      best = pct;
      bestT = t;
    }
    eod = pct;
  }
  return { best, bestT, eod };
}

async function main() {
  mkdirSync(REPORTS, { recursive: true });
  const rule = config.favourableSymbolRules.ruleIcicigi;
  const buyQ = rule.buyQuality;
  const snaps = buildIndicatorSnapshots(await fetchYahoo());
  const smi = computeStochasticMomentum(
    snaps.map((s) => s.high),
    snaps.map((s) => s.low),
    snaps.map((s) => s.close),
    rule.smi.lengthK,
    rule.smi.lengthD,
    rule.smi.lengthEma,
  );

  const dates = [
    ...new Set(snaps.map((s) => getIstTimeParts(s.timestamp).dateKey)),
  ].sort();

  type Row = {
    date: string;
    setupTime: string;
    entryTime: string;
    setupMid: number;
    entryMid: number;
    rsi: number;
    smi: number;
    dropFromOpen: number;
    bestPct: number | null;
    eodPct: number | null;
    positiveBest: boolean;
    positiveEod: boolean;
  };
  const rows: Row[] = [];

  for (const date of dates) {
    const idxs: number[] = [];
    for (let i = 0; i < snaps.length; i++) {
      if (getIstTimeParts(snaps[i].timestamp).dateKey !== date) continue;
      idxs.push(i);
    }
    if (!idxs.length) continue;
    const openMid = mid(snaps[idxs[0]]);

    for (const i of idxs) {
      const s = snaps[i];
      const t = formatIstTime(s.timestamp);
      if (t >= ENTRY_DEADLINE) break;
      const sm = smi[i]?.smi;
      if (sm == null || !Number.isFinite(sm) || !Number.isFinite(s.rsi)) continue;
      if (s.rsi < buyQ.minRsi || s.rsi > buyQ.maxRsi) continue;
      if (sm > buyQ.maxSmi) continue;
      const bb = nearLower(s, buyQ.maxBbLowerGapPct);
      if (!bb.ok) continue;

      const prevSm = i > 0 ? smi[i - 1]?.smi : null;
      const prevMac = i > 0 ? snaps[i - 1].macd.histogram : null;
      const pos = idxs.indexOf(i);
      const ni = pos + 1 < idxs.length ? idxs[pos + 1] : null;
      if (ni == null) continue;
      const setupMid = mid(s);
      const nextMid = mid(snaps[ni]);
      const smiFalling = prevSm != null && sm < prevSm;
      const macdFalling =
        prevMac != null &&
        Number.isFinite(prevMac) &&
        Number.isFinite(s.macd.histogram) &&
        s.macd.histogram < prevMac;
      const nextLower = nextMid < setupMid;
      if (!(smiFalling && macdFalling && nextLower)) continue;

      const entryTime = formatIstTime(snaps[ni].timestamp);
      const entryMid = nextMid;
      const sq = sellBest(snaps, date, entryTime, entryMid);
      rows.push({
        date,
        setupTime: t,
        entryTime,
        setupMid: round(setupMid),
        entryMid: round(entryMid),
        rsi: round(s.rsi, 1),
        smi: round(sm, 1),
        dropFromOpen: round(((setupMid - openMid) / openMid) * 100, 2),
        bestPct: sq.best == null ? null : round(sq.best),
        eodPct: sq.eod == null ? null : round(sq.eod),
        positiveBest: (sq.best ?? 0) > 0,
        positiveEod: (sq.eod ?? 0) > 0,
      });
      break; // first cascade of day
    }
  }

  const withExit = rows.filter((r) => r.bestPct != null);
  const posBest = withExit.filter((r) => r.positiveBest);
  const posEod = withExit.filter((r) => r.positiveEod);
  const avgBest =
    withExit.reduce((a, r) => a + (r.bestPct ?? 0), 0) / Math.max(withExit.length, 1);
  const avgEod =
    withExit.reduce((a, r) => a + (r.eodPct ?? 0), 0) / Math.max(withExit.length, 1);

  const md = [
    `# ICICIGI — falling-knife as SELL cascade (60d)`,
    ``,
    `Pattern: BUY-quality levels (RSI 30–50, SMI ≤ −40, BB lower ≤ 0.7%) **but** SMI falling + MACD hist falling + next mid lower → enter **SELL** on confirm bar.`,
    ``,
    `| Metric | Value |`,
    `|---|---:|`,
    `| Cascade SELL days | ${withExit.length} |`,
    `| Best-SQ positive % | ${withExit.length ? round((100 * posBest.length) / withExit.length, 1) : 0}% |`,
    `| EOD positive % | ${withExit.length ? round((100 * posEod.length) / withExit.length, 1) : 0}% |`,
    `| Avg best SQ % | ${round(avgBest)}% |`,
    `| Avg EOD % | ${round(avgEod)}% |`,
    ``,
    `| Date | Setup→Entry | Entry mid | RSI | SMI | Open DD | Best SQ | EOD |`,
    `|---|---|---:|---:|---:|---:|---:|---:|`,
    ...withExit.map(
      (r) =>
        `| ${r.date} | ${r.setupTime}→${r.entryTime} | ${r.entryMid} | ${r.rsi} | ${r.smi} | ${r.dropFromOpen}% | ${r.bestPct}% | ${r.eodPct}% |`,
    ),
    ``,
  ];
  writeFileSync(resolve(REPORTS, "icicigi-sell-cascade-60d.md"), md.join("\n"));
  writeFileSync(
    resolve(REPORTS, "icicigi-sell-cascade-60d.json"),
    JSON.stringify({ summary: { n: withExit.length, posBest: posBest.length, posEod: posEod.length, avgBest, avgEod }, rows }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        n: withExit.length,
        bestPosPct: withExit.length ? (100 * posBest.length) / withExit.length : 0,
        eodPosPct: withExit.length ? (100 * posEod.length) / withExit.length : 0,
        avgBest,
        avgEod,
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
