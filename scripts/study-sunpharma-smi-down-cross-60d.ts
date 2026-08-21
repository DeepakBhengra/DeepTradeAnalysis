#!/usr/bin/env node
/**
 * SUNPHARMA — Stch Mtm (SMI) black-line downward crosses of red signal line.
 *
 * Black = SMI, Red = SMI signal (Kite Stch Mtm %K=10, %D smooth=3, signal EMA=10).
 * Downward cross: previous bar SMI ≥ signal AND current bar SMI < signal.
 *
 * Window: last 60 NSE trade days (Yahoo 15m).
 *
 * Usage:
 *   npx tsx scripts/study-sunpharma-smi-down-cross-60d.ts
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

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SYMBOL = "SUNPHARMA";
const YAHOO = "SUNPHARMA.NS";
const TRADE_DAYS = 60;
const SESSION_START = "09:15";
const SESSION_END = "15:30";
/**
 * Match Kite chart Stch Mtm label (10, 3, 3):
 * %K=10, double-smooth D=3, signal EMA=3.
 * (Verified vs 30 Jul 2026 chart: black↓red at 12:45 — signal EMA=10 shifts that cross to 13:00.)
 */
const SMI = { lengthK: 10, lengthD: 3, lengthEma: 3 };
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
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  smi: number;
  signal: number;
  prevSmi: number;
  prevSignal: number;
  rsi: number;
  /** First later same-day bar mid strictly below cross mid. */
  lowerTimeIst: string | null;
  lowerPrice: number | null;
  /** Lowest same-day mid after the cross (only when below cross mid). */
  lowestTimeIst: string | null;
  lowestPrice: number | null;
  /** Positive when price went lower after cross. */
  dropFromCrossPct: number | null;
  /** First later same-day bar mid strictly above cross mid. */
  higherTimeIst: string | null;
  higherPrice: number | null;
  /** Highest same-day mid after the cross (only when above cross mid). */
  highestTimeIst: string | null;
  highestPrice: number | null;
  /** Positive when price went higher after cross. */
  riseFromCrossPct: number | null;
  /**
   * Signed move vs cross using extremes after the print:
   * +drop when a lower mid exists, else −rise when only higher, else null (no later bars).
   */
  signedDropPct: number | null;
  /** G/R/D pattern of 3 session 15m candles before the cross (oldest→newest). */
  pre3Pattern: string | null;
  /** Timed pre-3 summary, e.g. `12:00R · 12:15G · 12:30G`. */
  pre3Detail: string | null;
  /** RSI on those 3 pre candles (oldest→newest). */
  pre3Rsi: string | null;
};

type DropBucket = {
  key: string;
  label: string;
  min: number;
  max: number;
};

const DROP_BUCKETS: DropBucket[] = [
  { key: "A_3_to_1", label: "3%–1%", min: 1, max: 3 },
  { key: "B_0_95_to_0_4", label: "0.95%–0.4%", min: 0.4, max: 0.95 },
  { key: "C_0_35_to_0_15", label: "0.35%–0.15%", min: 0.15, max: 0.35 },
];

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function candleColor(open: number, close: number): "G" | "R" | "D" {
  if (close > open * 1.0002) return "G";
  if (close < open * 0.9998) return "R";
  return "D";
}

function mid(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

function dayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

async function fetchYahoo15m(): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${YAHOO}?range=60d&interval=15m`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Yahoo ${YAHOO}: HTTP ${res.status}`);
  }
  const payload = (await res.json()) as {
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
    };
  };
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp ?? [];
  if (!result || !quote || timestamps.length === 0) {
    throw new Error(`Yahoo ${YAHOO}: empty chart`);
  }

  const out: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
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
    out.push({
      timestamp: new Date(timestamps[i] * 1000),
      open,
      high,
      low,
      close,
      volume: quote.volume?.[i] ?? 0,
    });
  }
  return out.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function collectTradeDates(snapshots: IndicatorSnapshot[]): string[] {
  const dates = new Set<string>();
  for (const snapshot of snapshots) {
    if (
      isWithinIstSessionWindow(snapshot.timestamp, SESSION_START, SESSION_END)
    ) {
      dates.add(getIstTimeParts(snapshot.timestamp).dateKey);
    }
  }
  return [...dates].sort();
}

async function main(): Promise<void> {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const smiCfg = SMI;
  console.log(
    `${SYMBOL} SMI black↓red cross · last ${TRADE_DAYS} trade days · Stch Mtm(${smiCfg.lengthK},${smiCfg.lengthD},${smiCfg.lengthEma})`,
  );

  const candles = await fetchYahoo15m();
  console.log(`Yahoo 15m bars: ${candles.length}`);
  const snapshots = buildIndicatorSnapshots(candles);
  const smiSeries = computeStochasticMomentum(
    snapshots.map((s) => s.high),
    snapshots.map((s) => s.low),
    snapshots.map((s) => s.close),
    smiCfg.lengthK,
    smiCfg.lengthD,
    smiCfg.lengthEma,
  );
  const allDates = collectTradeDates(snapshots);
  const targetDates = allDates.slice(-TRADE_DAYS);
  const dateSet = new Set(targetDates);
  console.log(
    `Trade days available: ${allDates.length} · using ${targetDates[0]} → ${targetDates[targetDates.length - 1]} (${targetDates.length} days)`,
  );

  function findMoveAfterCross(
    crossIndex: number,
    dateKey: string,
    crossMid: number,
  ): {
    lowerTimeIst: string | null;
    lowerPrice: number | null;
    lowestTimeIst: string | null;
    lowestPrice: number | null;
    dropFromCrossPct: number | null;
    higherTimeIst: string | null;
    higherPrice: number | null;
    highestTimeIst: string | null;
    highestPrice: number | null;
    riseFromCrossPct: number | null;
    signedDropPct: number | null;
    laterBarCount: number;
  } {
    let lowerTimeIst: string | null = null;
    let lowerPrice: number | null = null;
    let lowestTimeIst: string | null = null;
    let lowestPrice: number | null = null;
    let higherTimeIst: string | null = null;
    let higherPrice: number | null = null;
    let highestTimeIst: string | null = null;
    let highestPrice: number | null = null;
    let laterBarCount = 0;

    for (let j = crossIndex + 1; j < snapshots.length; j++) {
      const later = snapshots[j];
      if (
        !isWithinIstSessionWindow(later.timestamp, SESSION_START, SESSION_END)
      ) {
        continue;
      }
      const laterParts = getIstTimeParts(later.timestamp);
      if (laterParts.dateKey !== dateKey) break;

      laterBarCount += 1;
      const laterMid = mid(later);
      const laterTime = formatIstTime(later.timestamp);

      if (laterMid < crossMid) {
        if (lowerTimeIst == null) {
          lowerTimeIst = laterTime;
          lowerPrice = laterMid;
        }
        if (lowestPrice == null || laterMid < lowestPrice) {
          lowestPrice = laterMid;
          lowestTimeIst = laterTime;
        }
      } else if (laterMid > crossMid) {
        if (higherTimeIst == null) {
          higherTimeIst = laterTime;
          higherPrice = laterMid;
        }
        if (highestPrice == null || laterMid > highestPrice) {
          highestPrice = laterMid;
          highestTimeIst = laterTime;
        }
      }
    }

    const dropFromCrossPct =
      lowestPrice == null
        ? null
        : round(((crossMid - lowestPrice) / crossMid) * 100);
    const riseFromCrossPct =
      highestPrice == null
        ? null
        : round(((highestPrice - crossMid) / crossMid) * 100);
    const signedDropPct =
      dropFromCrossPct != null
        ? dropFromCrossPct
        : riseFromCrossPct != null
          ? round(-riseFromCrossPct)
          : null;

    return {
      lowerTimeIst,
      lowerPrice: lowerPrice == null ? null : round(lowerPrice),
      lowestTimeIst,
      lowestPrice: lowestPrice == null ? null : round(lowestPrice),
      dropFromCrossPct,
      higherTimeIst,
      higherPrice: higherPrice == null ? null : round(higherPrice),
      highestTimeIst,
      highestPrice: highestPrice == null ? null : round(highestPrice),
      riseFromCrossPct,
      signedDropPct,
      laterBarCount,
    };
  }
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

  const crosses: CrossRow[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    if (
      !isWithinIstSessionWindow(snapshot.timestamp, SESSION_START, SESSION_END)
    ) {
      continue;
    }
    const parts = getIstTimeParts(snapshot.timestamp);
    if (!dateSet.has(parts.dateKey)) continue;

    const prev = smiSeries[i - 1];
    const cur = smiSeries[i];
    if (
      !Number.isFinite(prev.smi) ||
      !Number.isFinite(prev.signal) ||
      !Number.isFinite(cur.smi) ||
      !Number.isFinite(cur.signal)
    ) {
      continue;
    }

    const downCross = prev.smi >= prev.signal && cur.smi < cur.signal;
    if (!downCross) continue;

    const crossMid = mid(snapshot);
    const move = findMoveAfterCross(i, parts.dateKey, crossMid);

    let pre3Pattern: string | null = null;
    let pre3Detail: string | null = null;
    let pre3Rsi: string | null = null;
    const si = sessionPos.get(i);
    if (si != null && si >= 3) {
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

    crosses.push({
      dateKey: parts.dateKey,
      dayLabel: dayLabel(parts.dateKey),
      timeIst: formatIstTime(snapshot.timestamp),
      midPrice: round(crossMid),
      closePrice: round(snapshot.close),
      openPrice: round(snapshot.open),
      highPrice: round(snapshot.high),
      lowPrice: round(snapshot.low),
      smi: round(cur.smi, 2),
      signal: round(cur.signal, 2),
      prevSmi: round(prev.smi, 2),
      prevSignal: round(prev.signal, 2),
      rsi: round(snapshot.rsi, 1),
      lowerTimeIst: move.lowerTimeIst,
      lowerPrice: move.lowerPrice,
      lowestTimeIst: move.lowestTimeIst,
      lowestPrice: move.lowestPrice,
      dropFromCrossPct: move.dropFromCrossPct,
      higherTimeIst: move.higherTimeIst,
      higherPrice: move.higherPrice,
      highestTimeIst: move.highestTimeIst,
      highestPrice: move.highestPrice,
      riseFromCrossPct: move.riseFromCrossPct,
      signedDropPct: move.signedDropPct,
      pre3Pattern,
      pre3Detail,
      pre3Rsi,
    });
  }

  const daysWithCross = new Set(crosses.map((c) => c.dateKey)).size;
  const withLower = crosses.filter((c) => c.lowerPrice != null);
  /** Price never printed a lower mid after the cross (rose and/or held only). */
  const noLower = crosses.filter((c) => c.dropFromCrossPct == null);
  const adverseRose = noLower.filter((c) => c.riseFromCrossPct != null);
  /** Largest same-day drop first; rows with no lower print last. */
  const sorted = [...crosses].sort((a, b) => {
    const aDrop = a.dropFromCrossPct;
    const bDrop = b.dropFromCrossPct;
    if (aDrop == null && bDrop == null) {
      const aRise = a.riseFromCrossPct ?? -1;
      const bRise = b.riseFromCrossPct ?? -1;
      if (bRise !== aRise) return bRise - aRise;
      const byDate = b.dateKey.localeCompare(a.dateKey);
      if (byDate !== 0) return byDate;
      return b.timeIst.localeCompare(a.timeIst);
    }
    if (aDrop == null) return 1;
    if (bDrop == null) return -1;
    if (bDrop !== aDrop) return bDrop - aDrop;
    const byDate = b.dateKey.localeCompare(a.dateKey);
    if (byDate !== 0) return byDate;
    return b.timeIst.localeCompare(a.timeIst);
  });
  /** Adverse: no lower mid — sort by largest rise (most negative signed drop) first. */
  const adverseSorted = [...noLower].sort((a, b) => {
    const aRise = a.riseFromCrossPct ?? -1;
    const bRise = b.riseFromCrossPct ?? -1;
    if (bRise !== aRise) return bRise - aRise;
    const byDate = b.dateKey.localeCompare(a.dateKey);
    if (byDate !== 0) return byDate;
    return b.timeIst.localeCompare(a.timeIst);
  });

  function dropCell(c: CrossRow): string {
    if (c.dropFromCrossPct != null) return `${c.dropFromCrossPct.toFixed(2)}%`;
    if (c.signedDropPct != null) return `${c.signedDropPct.toFixed(2)}%`;
    return "—";
  }

  const bucketed = DROP_BUCKETS.map((b) => ({
    ...b,
    rows: sorted.filter(
      (c) =>
        c.dropFromCrossPct != null &&
        c.dropFromCrossPct >= b.min &&
        c.dropFromCrossPct <= b.max,
    ),
  }));

  const md: string[] = [
    `# SUNPHARMA · SMI black ↓ red (signal) crosses · last ${TRADE_DAYS} trade days`,
    "",
    `- **Symbol:** ${SYMBOL}`,
    `- **Indicator:** Kite Stch Mtm — black = SMI, red = signal EMA`,
    `- **Params:** Kite Stch Mtm \`(${smiCfg.lengthK}, ${smiCfg.lengthD}, ${smiCfg.lengthEma})\` — %K=${smiCfg.lengthK}, double-smooth=${smiCfg.lengthD}, signal EMA=${smiCfg.lengthEma}`,
    `- **Downward cross:** previous bar \`SMI ≥ signal\` and current bar \`SMI < signal\``,
    `- **Price at cross:** 15m candle mid \`(high+low)/2\` (also close listed)`,
    `- **Lower after cross:** first later same-day mid **strictly below** cross mid; also lowest mid after cross`,
    `- **Negative Drop %:** no later mid below cross — price only rose/held; Drop % = \`−Rise %\` from highest later mid`,
    `- **Pre-3:** three session 15m candles immediately before the cross (G=green, R=red, D=doji); times IST`,
    `- **RSI:** Wilder RSI(14) on the cross bar; **Pre-3 RSI** = RSI on those three prior bars`,
    `- **Drop buckets:** **3%–1%** · **0.95%–0.4%** · **0.35%–0.15%** (inclusive; went-lower only)`,
    `- **Note:** signal EMA=3 matches Kite chart pink-circle timing (e.g. 30 Jul 2026 cross @ 12:45)`,
    `- **Sort (main table):** **Drop % descending** (adverse / no-lower rows last)`,
    `- **Session:** ${SESSION_START}–${SESSION_END} IST`,
    `- **Window:** ${targetDates[0]} → ${targetDates[targetDates.length - 1]} (${targetDates.length} trade days)`,
    `- **Crosses found:** **${crosses.length}** on **${daysWithCross}** days`,
    `- **Went lower same day:** **${withLower.length}/${crosses.length}** (${crosses.length ? round((withLower.length / crosses.length) * 100) : 0}%)`,
    `- **No lower / rose or held:** **${noLower.length}/${crosses.length}** (${crosses.length ? round((noLower.length / crosses.length) * 100) : 0}%) · of which **${adverseRose.length}** printed a higher mid`,
    `- **Bucket counts:** ${bucketed.map((b) => `${b.label} **${b.rows.length}**`).join(" · ")}`,
    `- **Data:** Yahoo Finance 15m (\`${YAHOO}\`)`,
    `- **Generated (UTC):** ${new Date().toISOString()}`,
    "",
    "## By Drop % bucket (Pre-3 + RSI)",
    "",
  ];

  for (const b of bucketed) {
    md.push(
      `### ${b.label} (n=${b.rows.length})`,
      "",
      "| # | Day | Date | Time (IST) | Mid ₹ | Lowest ₹ | Drop % | Pre-3 (t−3··t−1) | Pre-3 RSI | RSI @ cross |",
      "|--:|-----|------|------------|------:|---------:|-------:|------------------|----------:|------------:|",
    );
    b.rows.forEach((c, idx) => {
      md.push(
        `| ${idx + 1} | ${c.dayLabel} | ${c.dateKey} | ${c.timeIst} | ${c.midPrice.toFixed(2)} | ${c.lowestPrice == null ? "—" : c.lowestPrice.toFixed(2)} | ${dropCell(c)} | ${c.pre3Detail ?? "—"} (\`${c.pre3Pattern ?? "—"}\`) | ${c.pre3Rsi ?? "—"} | ${c.rsi.toFixed(1)} |`,
      );
    });
    md.push("");
  }

  md.push(
    "## Crosses (by Drop % ↓)",
    "",
    "| # | Day | Date | Time (IST) | Mid ₹ | Close ₹ | Lower time | Lower ₹ | Lowest time | Lowest ₹ | Drop % | Pre-3 | Pre-3 RSI | SMI (black) | Signal (red) | RSI |",
    "|--:|-----|------|------------|------:|--------:|------------|--------:|-------------|---------:|-------:|-------|----------:|------------:|-------------:|----:|",
  );

  sorted.forEach((c, idx) => {
    md.push(
      `| ${idx + 1} | ${c.dayLabel} | ${c.dateKey} | ${c.timeIst} | ${c.midPrice.toFixed(2)} | ${c.closePrice.toFixed(2)} | ${c.lowerTimeIst ?? "—"} | ${c.lowerPrice == null ? "—" : c.lowerPrice.toFixed(2)} | ${c.lowestTimeIst ?? "—"} | ${c.lowestPrice == null ? "—" : c.lowestPrice.toFixed(2)} | ${dropCell(c)} | ${c.pre3Detail ?? "—"} (\`${c.pre3Pattern ?? "—"}\`) | ${c.pre3Rsi ?? "—"} | ${c.smi.toFixed(2)} | ${c.signal.toFixed(2)} | ${c.rsi.toFixed(1)} |`,
    );
  });

  md.push(
    "",
    "## Compact (by Drop % ↓)",
    "",
    "| Day | Cross time | Cross ₹ | Lowest ₹ | Drop % | Pre-3 | RSI |",
    "|-----|------------|--------:|---------:|-------:|-------|----:|",
  );
  for (const c of sorted) {
    md.push(
      `| ${c.dayLabel} | ${c.timeIst} | ${c.midPrice.toFixed(2)} | ${c.lowestPrice == null ? "—" : c.lowestPrice.toFixed(2)} | ${dropCell(c)} | \`${c.pre3Pattern ?? "—"}\` | ${c.rsi.toFixed(1)} |`,
    );
  }
  md.push("");

  md.push(
    "## Adverse: no same-day lower (price rose / held after black↓red)",
    "",
    `These **${noLower.length}** crosses never printed a mid **below** the cross mid later that session. Drop % is **negative** (= −Rise % to the highest later mid). Sorted by largest rise first.`,
    "",
    "| # | Day | Date | Time (IST) | Mid ₹ | Close ₹ | Higher time | Higher ₹ | Highest time | Highest ₹ | Drop % (neg) | Rise % | Pre-3 | Pre-3 RSI | SMI (black) | Signal (red) | RSI |",
    "|--:|-----|------|------------|------:|--------:|-------------|---------:|--------------|----------:|-------------:|-------:|-------|----------:|------------:|-------------:|----:|",
  );
  adverseSorted.forEach((c, idx) => {
    md.push(
      `| ${idx + 1} | ${c.dayLabel} | ${c.dateKey} | ${c.timeIst} | ${c.midPrice.toFixed(2)} | ${c.closePrice.toFixed(2)} | ${c.higherTimeIst ?? "—"} | ${c.higherPrice == null ? "—" : c.higherPrice.toFixed(2)} | ${c.highestTimeIst ?? "—"} | ${c.highestPrice == null ? "—" : c.highestPrice.toFixed(2)} | ${c.signedDropPct == null ? "—" : `${c.signedDropPct.toFixed(2)}%`} | ${c.riseFromCrossPct == null ? "—" : `${c.riseFromCrossPct.toFixed(2)}%`} | ${c.pre3Detail ?? "—"} (\`${c.pre3Pattern ?? "—"}\`) | ${c.pre3Rsi ?? "—"} | ${c.smi.toFixed(2)} | ${c.signal.toFixed(2)} | ${c.rsi.toFixed(1)} |`,
    );
  });
  md.push(
    "",
    "### Compact adverse",
    "",
    "| Day | Cross time | Cross ₹ | Highest ₹ | Drop % (neg) | Rise % | Pre-3 | RSI |",
    "|-----|------------|--------:|----------:|-------------:|-------:|-------|----:|",
  );
  for (const c of adverseSorted) {
    md.push(
      `| ${c.dayLabel} | ${c.timeIst} | ${c.midPrice.toFixed(2)} | ${c.highestPrice == null ? "—" : c.highestPrice.toFixed(2)} | ${c.signedDropPct == null ? "—" : `${c.signedDropPct.toFixed(2)}%`} | ${c.riseFromCrossPct == null ? "—" : `${c.riseFromCrossPct.toFixed(2)}%`} | \`${c.pre3Pattern ?? "—"}\` | ${c.rsi.toFixed(1)} |`,
    );
  }
  md.push("");

  const jul30 = crosses.filter((c) => c.dateKey === "2026-07-30");
  if (jul30.length > 0) {
    md.push(
      "## Example: Thu 30 Jul 2026 (Kite chart pink circle)",
      "",
      "Black SMI crossed below red signal, then price sold off into the lower Bollinger band:",
      "",
    );
    for (const c of jul30) {
      md.push(
        `- **Cross:** ${c.timeIst} IST @ mid **₹${c.midPrice.toFixed(2)}** (SMI ${c.prevSmi.toFixed(2)}→${c.smi.toFixed(2)}, signal ${c.prevSignal.toFixed(2)}→${c.signal.toFixed(2)})`,
        `- **First lower mid:** ${c.lowerTimeIst ?? "—"} @ **₹${c.lowerPrice == null ? "—" : c.lowerPrice.toFixed(2)}**`,
        `- **Lowest mid after:** ${c.lowestTimeIst ?? "—"} @ **₹${c.lowestPrice == null ? "—" : c.lowestPrice.toFixed(2)}** (${c.dropFromCrossPct == null ? "—" : `${c.dropFromCrossPct.toFixed(2)}%`} below cross)`,
        "",
      );
    }
  }
  const mdPath = resolve(REPORTS_DIR, "sunpharma-smi-down-cross-60d.md");
  const jsonPath = resolve(REPORTS_DIR, "sunpharma-smi-down-cross-60d.json");
  writeFileSync(mdPath, md.join("\n"));
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        symbol: SYMBOL,
        definition:
          "SMI (black) crosses below signal (red): prev SMI≥signal and cur SMI<signal",
        smiParams: smiCfg,
        tradeDays: targetDates.length,
        from: targetDates[0] ?? null,
        to: targetDates[targetDates.length - 1] ?? null,
        crossCount: crosses.length,
        daysWithCross,
        wentLowerCount: withLower.length,
        wentLowerPct: crosses.length
          ? round((withLower.length / crosses.length) * 100)
          : 0,
        noLowerCount: noLower.length,
        adverseRoseCount: adverseRose.length,
        sort: "dropFromCrossPct descending; adverse no-lower by rise descending",
        dropBuckets: bucketed.map((b) => ({
          key: b.key,
          label: b.label,
          min: b.min,
          max: b.max,
          count: b.rows.length,
          crosses: b.rows,
        })),
        crosses: sorted,
        adverseNoLower: adverseSorted,
        source: `Yahoo 15m ${YAHOO}`,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );  console.log(
    `Crosses: ${crosses.length} on ${daysWithCross} days · went lower ${withLower.length}/${crosses.length}`,
  );
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  for (const c of crosses.slice(0, 8)) {
    console.log(
      `  ${c.dateKey} ${c.timeIst} mid=${c.midPrice} → lower ${c.lowerTimeIst ?? "—"} ${c.lowerPrice ?? "—"} (lowest ${c.lowestTimeIst ?? "—"} ${c.lowestPrice ?? "—"})`,
    );
  }
  if (crosses.length > 8) console.log(`  … +${crosses.length - 8} more`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
