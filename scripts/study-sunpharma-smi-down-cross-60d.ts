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
import { config } from "../src/config.js";
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
  const smiCfg = config.deeppro.smi;
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

    crosses.push({
      dateKey: parts.dateKey,
      dayLabel: dayLabel(parts.dateKey),
      timeIst: formatIstTime(snapshot.timestamp),
      midPrice: round(mid(snapshot)),
      closePrice: round(snapshot.close),
      openPrice: round(snapshot.open),
      highPrice: round(snapshot.high),
      lowPrice: round(snapshot.low),
      smi: round(cur.smi, 2),
      signal: round(cur.signal, 2),
      prevSmi: round(prev.smi, 2),
      prevSignal: round(prev.signal, 2),
      rsi: round(snapshot.rsi, 1),
    });
  }

  const daysWithCross = new Set(crosses.map((c) => c.dateKey)).size;
  const md: string[] = [
    `# SUNPHARMA · SMI black ↓ red (signal) crosses · last ${TRADE_DAYS} trade days`,
    "",
    `- **Symbol:** ${SYMBOL}`,
    `- **Indicator:** Kite Stch Mtm — black = SMI, red = signal EMA`,
    `- **Params:** %K=${smiCfg.lengthK}, %K smooth=${smiCfg.lengthD}, signal EMA=${smiCfg.lengthEma}`,
    `- **Downward cross:** previous bar \`SMI ≥ signal\` and current bar \`SMI < signal\``,
    `- **Price at cross:** 15m candle mid \`(high+low)/2\` (also close listed)`,
    `- **Session:** ${SESSION_START}–${SESSION_END} IST`,
    `- **Window:** ${targetDates[0]} → ${targetDates[targetDates.length - 1]} (${targetDates.length} trade days)`,
    `- **Crosses found:** **${crosses.length}** on **${daysWithCross}** days`,
    `- **Data:** Yahoo Finance 15m (\`${YAHOO}\`)`,
    `- **Generated (UTC):** ${new Date().toISOString()}`,
    "",
    "## Crosses",
    "",
    "| # | Day | Date | Time (IST) | Mid ₹ | Close ₹ | SMI (black) | Signal (red) | Prev SMI | Prev signal | RSI |",
    "|--:|-----|------|------------|------:|--------:|------------:|-------------:|---------:|------------:|----:|",
  ];

  crosses.forEach((c, idx) => {
    md.push(
      `| ${idx + 1} | ${c.dayLabel} | ${c.dateKey} | ${c.timeIst} | ${c.midPrice.toFixed(2)} | ${c.closePrice.toFixed(2)} | ${c.smi.toFixed(2)} | ${c.signal.toFixed(2)} | ${c.prevSmi.toFixed(2)} | ${c.prevSignal.toFixed(2)} | ${c.rsi.toFixed(1)} |`,
    );
  });

  md.push(
    "",
    "## Compact (date · time · price)",
    "",
    "| Day | Time | Price ₹ |",
    "|-----|------|--------:|",
  );
  for (const c of crosses) {
    md.push(`| ${c.dayLabel} | ${c.timeIst} | ${c.midPrice.toFixed(2)} |`);
  }
  md.push("");

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
        crosses,
        source: `Yahoo 15m ${YAHOO}`,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log(`Crosses: ${crosses.length} on ${daysWithCross} days`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  for (const c of crosses.slice(0, 8)) {
    console.log(
      `  ${c.dateKey} ${c.timeIst} mid=${c.midPrice} SMI ${c.prevSmi}→${c.smi} vs sig ${c.prevSignal}→${c.signal}`,
    );
  }
  if (crosses.length > 8) console.log(`  … +${crosses.length - 8} more`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
