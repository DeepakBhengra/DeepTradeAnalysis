#!/usr/bin/env node
/**
 * Compare deeppro Day Scan signals vs same-day best SQ profit for one or more dates.
 * Used to find forward-looking quality gates (no look-ahead) that drop losers.
 */
import "../src/loadEnv.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { evaluateDeepproDay } from "../src/rules/deepproDecision.js";
import { SECTOR_WATCHLIST } from "../src/symbols/sectorWatchlist.js";
import type { DeepproSignal, IndicatorSnapshot } from "../src/types.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";

const SESSION_END = "15:15";
const DATES = process.argv.slice(2);
const dates = DATES.length > 0 ? DATES : ["2026-06-01", "2026-06-29"];

function mid(s: IndicatorSnapshot): number {
  return (s.high + s.low) / 2;
}

function bestSq(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  eventTimeIst: string,
  side: "BUY" | "SELL",
  entry: number,
): { bestProfitPct: number | null; bestTimeIst: string | null } {
  let bestProfitPct: number | null = null;
  let bestTimeIst: string | null = null;
  for (const snapshot of snapshots) {
    const parts = getIstTimeParts(snapshot.timestamp);
    if (parts.dateKey !== dateKey) continue;
    const t = formatIstTime(snapshot.timestamp);
    if (t <= eventTimeIst || t > SESSION_END) continue;
    const exit = mid(snapshot);
    const profit =
      side === "SELL"
        ? ((entry - exit) / entry) * 100
        : ((exit - entry) / entry) * 100;
    if (bestProfitPct == null || profit > bestProfitPct) {
      bestProfitPct = profit;
      bestTimeIst = t;
    }
  }
  return { bestProfitPct, bestTimeIst };
}

async function scanDate(date: string) {
  const rows = [];
  for (const entry of SECTOR_WATCHLIST.slice(0, 50)) {
    const dash = resolveDashboardSymbol(entry.tradingSymbol);
    const candles = await fetchPnbCandles({
      symbol: dash.tradingSymbol,
      exchange: dash.exchange,
      segment: dash.segment,
      fromDate: date,
      toDate: date,
      kiteRetries: config.dayScanKiteRetries,
    });
    const snapshots = buildIndicatorSnapshots(candles);
    const day = evaluateDeepproDay(snapshots, date);
    for (const signal of day.signals) {
      const eventSnapshot = snapshots.find((snapshot) => {
        const parts = getIstTimeParts(snapshot.timestamp);
        return (
          parts.dateKey === signal.dateKey &&
          formatIstTime(snapshot.timestamp) === signal.eventTimeIst
        );
      });
      if (!eventSnapshot) continue;
      const entryPrice = mid(eventSnapshot);
      const sq = bestSq(
        snapshots,
        signal.dateKey,
        signal.eventTimeIst,
        signal.side,
        entryPrice,
      );
      rows.push({
        date,
        symbol: entry.tradingSymbol,
        sector: entry.sector,
        side: signal.side,
        eventKind: signal.eventKind,
        eventTimeIst: signal.eventTimeIst,
        crossTimeIst: signal.timeIst,
        eventRsi: Number(signal.eventRsi.toFixed(2)),
        crossRsi: Number(signal.rsi.toFixed(2)),
        peakSmi: Number(signal.peakSmi.toFixed(2)),
        smi: Number(signal.smi.toFixed(2)),
        bbUpperGap: Number(signal.bbUpperProximity.gapPct.toFixed(3)),
        bbUpperMatch: signal.bbUpperProximity.matchType,
        bbLowerGap: Number(signal.bbLowerProximity.gapPct.toFixed(3)),
        bbLowerMatch: signal.bbLowerProximity.matchType,
        macdHist: Number(signal.macdHistogram.toFixed(4)),
        entryPrice: Number(entryPrice.toFixed(2)),
        bestProfitPct:
          sq.bestProfitPct == null
            ? null
            : Number(sq.bestProfitPct.toFixed(3)),
        bestTimeIst: sq.bestTimeIst,
        winner075: (sq.bestProfitPct ?? -999) >= 0.75,
        winner0: (sq.bestProfitPct ?? -999) >= 0,
      });
    }
    process.stdout.write(".");
  }
  process.stdout.write("\n");
  return rows;
}

function summarize(rows: Awaited<ReturnType<typeof scanDate>>, date: string) {
  const day = rows.filter((r) => r.date === date);
  const buys = day.filter((r) => r.side === "BUY");
  const sells = day.filter((r) => r.side === "SELL");
  const fmt = (arr: typeof day) => ({
    n: arr.length,
    win075: arr.filter((r) => r.winner075).length,
    win0: arr.filter((r) => r.winner0).length,
    avgProfit:
      arr.length === 0
        ? null
        : Number(
            (
              arr.reduce((s, r) => s + (r.bestProfitPct ?? 0), 0) / arr.length
            ).toFixed(3),
          ),
  });
  return {
    date,
    all: fmt(day),
    buy: fmt(buys),
    sell: fmt(sells),
    buyLosers: buys
      .filter((r) => !r.winner0)
      .map((r) => ({
        symbol: r.symbol,
        event: r.eventTimeIst,
        kind: r.eventKind,
        rsi: r.eventRsi,
        bbL: r.bbLowerGap,
        bbLmatch: r.bbLowerMatch,
        peakSmi: r.peakSmi,
        profit: r.bestProfitPct,
      })),
    buyWinners075: buys
      .filter((r) => r.winner075)
      .map((r) => ({
        symbol: r.symbol,
        event: r.eventTimeIst,
        kind: r.eventKind,
        rsi: r.eventRsi,
        bbL: r.bbLowerGap,
        bbLmatch: r.bbLowerMatch,
        peakSmi: r.peakSmi,
        profit: r.bestProfitPct,
      })),
    sellRows: sells.map((r) => ({
      symbol: r.symbol,
      event: r.eventTimeIst,
      kind: r.eventKind,
      rsi: r.eventRsi,
      bbU: r.bbUpperGap,
      profit: r.bestProfitPct,
    })),
  };
}

async function main() {
  const all = [];
  for (const date of dates) {
    console.log(`scanning ${date}`);
    all.push(...(await scanDate(date)));
  }
  mkdirSync(resolve("reports"), { recursive: true });
  const out = resolve("reports/deeppro-quality-gap-analysis.json");
  const summary = Object.fromEntries(dates.map((d) => [d, summarize(all, d)]));
  writeFileSync(
    out,
    JSON.stringify({ generatedAtUtc: new Date().toISOString(), summary, rows: all }, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log(`wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
