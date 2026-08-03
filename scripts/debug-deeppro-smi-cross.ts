#!/usr/bin/env node
/**
 * Debug LTM (or any symbol) Deeppro SMI vs Signal for one date.
 * Usage: npx tsx scripts/debug-deeppro-smi-cross.ts --symbol LTM --date 2026-08-03
 */
import "../src/loadEnv.js";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { computeStochasticMomentum } from "../src/indicators/stochasticMomentum.js";
import { evaluateDeepproDay } from "../src/rules/deepproDecision.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";

const symbol = process.argv.includes("--symbol")
  ? process.argv[process.argv.indexOf("--symbol") + 1]
  : "LTM";
const date = process.argv.includes("--date")
  ? process.argv[process.argv.indexOf("--date") + 1]
  : "2026-08-03";

const dash = resolveDashboardSymbol(symbol);
const candles = await fetchPnbCandles({
  symbol: dash.tradingSymbol,
  exchange: dash.exchange,
  segment: dash.segment,
  fromDate: date,
  toDate: date,
  kiteRetries: 3,
});
const snapshots = buildIndicatorSnapshots(candles);
const smiSeries = computeStochasticMomentum(
  snapshots.map((s) => s.high),
  snapshots.map((s) => s.low),
  snapshots.map((s) => s.close),
  config.deeppro.smi.lengthK,
  config.deeppro.smi.lengthD,
  config.deeppro.smi.lengthEma,
);

const dayBars: Array<Record<string, unknown>> = [];
for (let i = 0; i < snapshots.length; i++) {
  const parts = getIstTimeParts(snapshots[i].timestamp);
  if (parts.dateKey !== date) continue;
  if (i < 1) continue;
  const prev = smiSeries[i - 1];
  const cur = smiSeries[i];
  const bearish =
    Number.isFinite(prev.smi) &&
    Number.isFinite(prev.signal) &&
    Number.isFinite(cur.smi) &&
    Number.isFinite(cur.signal) &&
    prev.smi >= prev.signal &&
    cur.smi < cur.signal;
  const bullish =
    Number.isFinite(prev.smi) &&
    Number.isFinite(prev.signal) &&
    Number.isFinite(cur.smi) &&
    Number.isFinite(cur.signal) &&
    prev.smi <= prev.signal &&
    cur.smi > cur.signal;
  const touch =
    Number.isFinite(cur.smi) &&
    Number.isFinite(cur.signal) &&
    Math.abs(cur.smi - cur.signal) < 1e-9;
  dayBars.push({
    i,
    timeIst: formatIstTime(snapshots[i].timestamp),
    close: snapshots[i].close,
    smi: Number(cur.smi.toFixed(4)),
    signal: Number(cur.signal.toFixed(4)),
    prevSmi: Number(prev.smi.toFixed(4)),
    prevSignal: Number(prev.signal.toFixed(4)),
    smiMinusSig: Number((cur.smi - cur.signal).toFixed(4)),
    bearishCross: bearish,
    bullishCross: bullish,
    touchEqual: touch,
    rsi: Number(snapshots[i].rsi.toFixed(2)),
    macdHist: Number(snapshots[i].macd.histogram.toFixed(4)),
  });
}

const day = evaluateDeepproDay(snapshots, date);
console.log(
  JSON.stringify(
    {
      symbol,
      date,
      signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
      deepproSignals: day.signals.map((s) => ({
        side: s.side,
        timeIst: s.timeIst,
        eventTimeIst: s.eventTimeIst,
        eventKind: s.eventKind,
        smi: s.smi,
        smiSignal: s.smiSignal,
        eventRsi: s.eventRsi,
        peakSmi: s.peakSmi,
      })),
      rawCrosses: dayBars.filter((b) => b.bearishCross || b.bullishCross),
      sessionBars: dayBars,
    },
    null,
    2,
  ),
);
