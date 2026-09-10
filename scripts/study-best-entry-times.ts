#!/usr/bin/env node
/**
 * Rule-free best entry-time study for one symbol over N trade days.
 *
 * No Deepak / Deeppro / strategy rules — only candle mids:
 * - For every 15m bar on each day (with a later exit window), treat it as
 *   a BUY entry and a SELL entry.
 * - Square-off = best later same-day mid before 15:15 IST.
 * - Keep positive profit % only for ranking.
 *
 * Usage:
 *   npx tsx scripts/study-best-entry-times.ts --symbol PNB --trade-days 60
 *   npx tsx scripts/study-best-entry-times.ts --symbol PNB --from 2026-01-01 --to 2026-03-30
 */
import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SESSION_START = "09:15";
const SESSION_END = "15:15";

interface CandleBar {
  timestamp: Date;
  dateKey: string;
  timeIst: string;
  mid: number;
  high: number;
  low: number;
  close: number;
}

interface Opportunity {
  dateKey: string;
  dayLabel: string;
  side: "BUY" | "SELL";
  entryTimeIst: string;
  entryPrice: number;
  squareOffTimeIst: string;
  squareOffPrice: number;
  profitPct: number;
  profitPerShare: number;
}

function parseArgs(argv: string[]): {
  symbol: string;
  tradeDays: number;
  topN: number;
  fromDate: string | null;
  toDate: string | null;
  outSuffix: string | null;
} {
  let symbol = "PNB";
  let tradeDays = 60;
  let topN = 25;
  let fromDate: string | null = null;
  let toDate: string | null = null;
  let outSuffix: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--symbol" && argv[i + 1]) {
      symbol = argv[++i];
      continue;
    }
    if (arg === "--trade-days" && argv[i + 1]) {
      tradeDays = Math.max(1, Math.floor(Number(argv[++i])));
      continue;
    }
    if (arg === "--top" && argv[i + 1]) {
      topN = Math.max(1, Math.floor(Number(argv[++i])));
      continue;
    }
    if (arg === "--from" && argv[i + 1]) {
      fromDate = argv[++i];
      continue;
    }
    if (arg === "--to" && argv[i + 1]) {
      toDate = argv[++i];
      continue;
    }
    if (arg === "--out-suffix" && argv[i + 1]) {
      outSuffix = argv[++i];
      continue;
    }
  }

  if ((fromDate && !toDate) || (!fromDate && toDate)) {
    throw new Error("Provide both --from and --to (YYYY-MM-DD), or neither.");
  }
  if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    throw new Error(`Invalid --from date: ${fromDate}`);
  }
  if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new Error(`Invalid --to date: ${toDate}`);
  }
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error("--from must be on or before --to.");
  }

  return { symbol, tradeDays, topN, fromDate, toDate, outSuffix };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function weekdayName(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00+05:30`);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });
}

function bestExit(
  bars: CandleBar[],
  entryIndex: number,
  side: "BUY" | "SELL",
): {
  exitTimeIst: string;
  exitPrice: number;
  profitPct: number;
  profitPerShare: number;
} | null {
  const entry = bars[entryIndex];
  let best: {
    exitTimeIst: string;
    exitPrice: number;
    profitPct: number;
    profitPerShare: number;
  } | null = null;

  for (let j = entryIndex + 1; j < bars.length; j++) {
    const exit = bars[j];
    if (exit.timeIst > SESSION_END) break;
    const perShare =
      side === "BUY" ? exit.mid - entry.mid : entry.mid - exit.mid;
    const pct = (perShare / entry.mid) * 100;
    if (!best || pct > best.profitPct) {
      best = {
        exitTimeIst: exit.timeIst,
        exitPrice: exit.mid,
        profitPct: pct,
        profitPerShare: perShare,
      };
    }
  }

  return best;
}

function collectSessionBars(
  candles: Array<{
    timestamp: Date;
    high: number;
    low: number;
    close: number;
  }>,
): Map<string, CandleBar[]> {
  const byDay = new Map<string, CandleBar[]>();

  for (const candle of candles) {
    const parts = getIstTimeParts(candle.timestamp);
    const timeIst = formatIstTime(candle.timestamp);
    if (timeIst < SESSION_START || timeIst > SESSION_END) continue;

    const bar: CandleBar = {
      timestamp: candle.timestamp,
      dateKey: parts.dateKey,
      timeIst,
      mid: (candle.high + candle.low) / 2,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    };

    const list = byDay.get(parts.dateKey) ?? [];
    list.push(bar);
    byDay.set(parts.dateKey, list);
  }

  for (const [, list] of byDay) {
    list.sort((a, b) => a.timeIst.localeCompare(b.timeIst));
  }

  return byDay;
}

interface TimeBucketStats {
  timeIst: string;
  side: "BUY" | "SELL";
  positiveCount: number;
  dayCount: number;
  hitRatePct: number;
  avgPositiveProfitPct: number;
  maxProfitPct: number;
  bestDateKey: string;
  bestDayLabel: string;
  bestEntryPrice: number;
  bestSquareOffTimeIst: string;
  bestSquareOffPrice: number;
}

interface DayBest {
  dateKey: string;
  dayLabel: string;
  weekday: string;
  buy: Opportunity | null;
  sell: Opportunity | null;
}

async function main(): Promise<void> {
  const { symbol, tradeDays, topN, fromDate, toDate, outSuffix } = parseArgs(
    process.argv.slice(2),
  );
  const dash = resolveDashboardSymbol(symbol);

  let fromKey: string;
  let toKey: string;
  if (fromDate && toDate) {
    fromKey = fromDate;
    toKey = toDate;
  } else {
    const end = new Date();
    const lookbackDays = Math.min(Math.max(tradeDays * 2 + 20, 100), 180);
    const start = new Date(end.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    fromKey = start.toISOString().slice(0, 10);
    toKey = end.toISOString().slice(0, 10);
  }

  console.log(
    JSON.stringify({
      phase: "start",
      symbol: dash.tradingSymbol,
      tradeDays: fromDate && toDate ? null : tradeDays,
      fromKey,
      toKey,
      mode: "rule-free-best-entry-times",
    }),
  );

  const candles = await fetchPnbCandles({
    symbol: dash.tradingSymbol,
    exchange: dash.exchange,
    segment: dash.segment,
    fromDate: fromKey,
    toDate: toKey,
  });

  const byDay = collectSessionBars(candles);
  const allDates = [...byDay.keys()].sort();
  const isWeekday = (dateKey: string): boolean => {
    const weekday = weekdayName(dateKey);
    return weekday !== "Saturday" && weekday !== "Sunday";
  };
  const targetDates =
    fromDate && toDate
      ? allDates.filter(
          (dateKey) =>
            dateKey >= fromKey && dateKey <= toKey && isWeekday(dateKey),
        )
      : allDates.filter(isWeekday).slice(-tradeDays);

  const opportunities: Opportunity[] = [];
  const dayBests: DayBest[] = [];

  for (const dateKey of targetDates) {
    const bars = byDay.get(dateKey) ?? [];
    let dayBestBuy: Opportunity | null = null;
    let dayBestSell: Opportunity | null = null;

    for (let i = 0; i < bars.length; i++) {
      const entry = bars[i];
      // Need at least one later bar at/before SESSION_END
      if (entry.timeIst >= SESSION_END) continue;

      for (const side of ["BUY", "SELL"] as const) {
        const exit = bestExit(bars, i, side);
        if (!exit || exit.profitPct <= 0) continue;

        const opp: Opportunity = {
          dateKey,
          dayLabel: formatDayLabel(dateKey),
          side,
          entryTimeIst: entry.timeIst,
          entryPrice: round(entry.mid),
          squareOffTimeIst: exit.exitTimeIst,
          squareOffPrice: round(exit.exitPrice),
          profitPct: round(exit.profitPct),
          profitPerShare: round(exit.profitPerShare),
        };
        opportunities.push(opp);

        if (side === "BUY") {
          if (!dayBestBuy || opp.profitPct > dayBestBuy.profitPct) {
            dayBestBuy = opp;
          }
        } else if (!dayBestSell || opp.profitPct > dayBestSell.profitPct) {
          dayBestSell = opp;
        }
      }
    }

    dayBests.push({
      dateKey,
      dayLabel: formatDayLabel(dateKey),
      weekday: weekdayName(dateKey),
      buy: dayBestBuy,
      sell: dayBestSell,
    });
  }

  const buys = opportunities
    .filter((o) => o.side === "BUY")
    .sort((a, b) => b.profitPct - a.profitPct);
  const sells = opportunities
    .filter((o) => o.side === "SELL")
    .sort((a, b) => b.profitPct - a.profitPct);

  const overallBestBuy = buys[0] ?? null;
  const overallBestSell = sells[0] ?? null;

  // Aggregate by entry clock time × side across days.
  const bucketMap = new Map<string, Opportunity[]>();
  for (const opp of opportunities) {
    const key = `${opp.side}|${opp.entryTimeIst}`;
    const list = bucketMap.get(key) ?? [];
    list.push(opp);
    bucketMap.set(key, list);
  }

  const timeBuckets: TimeBucketStats[] = [];
  for (const [key, list] of bucketMap) {
    const [side, timeIst] = key.split("|") as ["BUY" | "SELL", string];
    const daysWithBar = targetDates.filter((dateKey) => {
      const bars = byDay.get(dateKey) ?? [];
      return bars.some((b) => b.timeIst === timeIst && b.timeIst < SESSION_END);
    }).length;
    const best = [...list].sort((a, b) => b.profitPct - a.profitPct)[0];
    const avg =
      list.reduce((sum, o) => sum + o.profitPct, 0) / Math.max(list.length, 1);
    timeBuckets.push({
      timeIst,
      side,
      positiveCount: list.length,
      dayCount: daysWithBar,
      hitRatePct: round((list.length / Math.max(daysWithBar, 1)) * 100),
      avgPositiveProfitPct: round(avg),
      maxProfitPct: best.profitPct,
      bestDateKey: best.dateKey,
      bestDayLabel: best.dayLabel,
      bestEntryPrice: best.entryPrice,
      bestSquareOffTimeIst: best.squareOffTimeIst,
      bestSquareOffPrice: best.squareOffPrice,
    });
  }

  const bestBuyTimes = timeBuckets
    .filter((b) => b.side === "BUY")
    .sort((a, b) => {
      const scoreA = a.avgPositiveProfitPct * Math.sqrt(a.positiveCount);
      const scoreB = b.avgPositiveProfitPct * Math.sqrt(b.positiveCount);
      return scoreB - scoreA;
    });
  const bestSellTimes = timeBuckets
    .filter((b) => b.side === "SELL")
    .sort((a, b) => {
      const scoreA = a.avgPositiveProfitPct * Math.sqrt(a.positiveCount);
      const scoreB = b.avgPositiveProfitPct * Math.sqrt(b.positiveCount);
      return scoreB - scoreA;
    });

  // Best weekday averages (from each day's best BUY/SELL).
  const weekdayAgg = new Map<
    string,
    { buyPcts: number[]; sellPcts: number[] }
  >();
  for (const day of dayBests) {
    const slot = weekdayAgg.get(day.weekday) ?? { buyPcts: [], sellPcts: [] };
    if (day.buy) slot.buyPcts.push(day.buy.profitPct);
    if (day.sell) slot.sellPcts.push(day.sell.profitPct);
    weekdayAgg.set(day.weekday, slot);
  }
  const weekdayRows = [...weekdayAgg.entries()]
    .map(([weekday, stats]) => ({
      weekday,
      buyDays: stats.buyPcts.length,
      avgBestBuyPct:
        stats.buyPcts.length === 0
          ? null
          : round(
              stats.buyPcts.reduce((s, v) => s + v, 0) / stats.buyPcts.length,
            ),
      maxBestBuyPct:
        stats.buyPcts.length === 0 ? null : round(Math.max(...stats.buyPcts)),
      sellDays: stats.sellPcts.length,
      avgBestSellPct:
        stats.sellPcts.length === 0
          ? null
          : round(
              stats.sellPcts.reduce((s, v) => s + v, 0) / stats.sellPcts.length,
            ),
      maxBestSellPct:
        stats.sellPcts.length === 0 ? null : round(Math.max(...stats.sellPcts)),
    }))
    .sort((a, b) => (b.avgBestBuyPct ?? 0) - (a.avgBestBuyPct ?? 0));

  const windowFrom = targetDates[0] ?? fromKey;
  const windowTo = targetDates[targetDates.length - 1] ?? toKey;
  const generatedAtUtc = new Date().toISOString();

  mkdirSync(REPORTS_DIR, { recursive: true });
  const suffix =
    outSuffix ??
    (fromDate && toDate
      ? `${fromKey.replace(/-/g, "")}_${toKey.replace(/-/g, "")}`
      : `${tradeDays}d`);
  const base = `${dash.tradingSymbol.toLowerCase()}-best-entry-times-${suffix}`;
  const jsonPath = resolve(REPORTS_DIR, `${base}.json`);
  const mdPath = resolve(REPORTS_DIR, `${base}.md`);
  const source = `Kite Connect historical (${dash.exchange}:${dash.tradingSymbol}, 15minute)`;

  const payload = {
    mode: "rule-free-best-entry-times",
    symbol: dash.tradingSymbol,
    tradeDaysRequested: fromDate && toDate ? targetDates.length : tradeDays,
    tradeDaysScanned: targetDates.length,
    window: { from: windowFrom, to: windowTo },
    session: { start: SESSION_START, end: SESSION_END },
    entryRule: "Every 15m candle mid (high+low)/2 — no strategy rules",
    squareOffRule: `Best later same-day mid before ${SESSION_END} IST`,
    positiveOpportunityCount: opportunities.length,
    buyOpportunityCount: buys.length,
    sellOpportunityCount: sells.length,
    overallBestBuy,
    overallBestSell,
    recommendedBuyTime: bestBuyTimes[0] ?? null,
    recommendedSellTime: bestSellTimes[0] ?? null,
    data: { source, candleCount: candles.length },
    generatedAtUtc,
    topBuys: buys.slice(0, topN),
    topSells: sells.slice(0, topN),
    bestBuyTimes: bestBuyTimes.slice(0, 15),
    bestSellTimes: bestSellTimes.slice(0, 15),
    weekdayRows,
    dayBests,
  };

  const lines = [
    `# ${dash.tradingSymbol} — best BUY/SELL times (${windowFrom} → ${windowTo}, rule-free)`,
    "",
    `- **Symbol:** ${dash.tradingSymbol}`,
    `- **Window:** ${targetDates.length} trade days (${windowFrom} → ${windowTo})`,
    `- **Rules:** **none** — every 15m candle mid is an entry candidate`,
    `- **Entry:** candle mid \`(high+low)/2\``,
    `- **Square-off:** best later same-day mid before \`${SESSION_END}\` IST`,
    `- **BUY profit %:** \`(sq - entry) / entry × 100\` (positive only in rankings)`,
    `- **SELL profit %:** \`(entry - sq) / entry × 100\` (positive only in rankings)`,
    `- **Positive opportunities:** ${opportunities.length} (${buys.length} BUY · ${sells.length} SELL)`,
    `- **Data:** ${source}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Verdict — best single trades",
    "",
  ];

  if (overallBestBuy) {
    lines.push(
      `### Best BUY overall`,
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| Day | **${overallBestBuy.dayLabel}** (${weekdayName(overallBestBuy.dateKey)}) |`,
      `| Entry time | **${overallBestBuy.entryTimeIst}** IST |`,
      `| Buy price | ${overallBestBuy.entryPrice.toFixed(2)} |`,
      `| Square-off time | ${overallBestBuy.squareOffTimeIst} IST |`,
      `| Square-off price | ${overallBestBuy.squareOffPrice.toFixed(2)} |`,
      `| Profit % | **${overallBestBuy.profitPct.toFixed(2)}%** |`,
      "",
    );
  } else {
    lines.push("*No positive BUY opportunities.*", "");
  }

  if (overallBestSell) {
    lines.push(
      `### Best SELL overall`,
      "",
      `| Field | Value |`,
      `|-------|-------|`,
      `| Day | **${overallBestSell.dayLabel}** (${weekdayName(overallBestSell.dateKey)}) |`,
      `| Entry time | **${overallBestSell.entryTimeIst}** IST |`,
      `| Sell price | ${overallBestSell.entryPrice.toFixed(2)} |`,
      `| Square-off time | ${overallBestSell.squareOffTimeIst} IST |`,
      `| Square-off price | ${overallBestSell.squareOffPrice.toFixed(2)} |`,
      `| Profit % | **${overallBestSell.profitPct.toFixed(2)}%** |`,
      "",
    );
  } else {
    lines.push("*No positive SELL opportunities.*", "");
  }

  lines.push(
    "## Best recurring entry times (across days)",
    "",
    "Ranked by avg positive profit % × √(hit count). Hit rate = days with a positive best-SQ from that clock time / days that bar existed.",
    "",
    "### BUY times",
    "",
    "| Entry time | Hit rate | Positive days | Avg profit % | Max profit % | Best day | Buy price | SQ time | SQ price |",
    "|------------|----------|---------------|--------------|--------------|----------|-----------|---------|----------|",
  );
  for (const b of bestBuyTimes.slice(0, 12)) {
    lines.push(
      `| ${b.timeIst} | ${b.hitRatePct.toFixed(0)}% | ${b.positiveCount}/${b.dayCount} | ${b.avgPositiveProfitPct.toFixed(2)}% | ${b.maxProfitPct.toFixed(2)}% | ${b.bestDayLabel} | ${b.bestEntryPrice.toFixed(2)} | ${b.bestSquareOffTimeIst} | ${b.bestSquareOffPrice.toFixed(2)} |`,
    );
  }

  lines.push(
    "",
    "### SELL times",
    "",
    "| Entry time | Hit rate | Positive days | Avg profit % | Max profit % | Best day | Sell price | SQ time | SQ price |",
    "|------------|----------|---------------|--------------|--------------|----------|------------|---------|----------|",
  );
  for (const b of bestSellTimes.slice(0, 12)) {
    lines.push(
      `| ${b.timeIst} | ${b.hitRatePct.toFixed(0)}% | ${b.positiveCount}/${b.dayCount} | ${b.avgPositiveProfitPct.toFixed(2)}% | ${b.maxProfitPct.toFixed(2)}% | ${b.bestDayLabel} | ${b.bestEntryPrice.toFixed(2)} | ${b.bestSquareOffTimeIst} | ${b.bestSquareOffPrice.toFixed(2)} |`,
    );
  }

  if (bestBuyTimes[0] || bestSellTimes[0]) {
    lines.push("", "## Recommended clock times", "");
    if (bestBuyTimes[0]) {
      const b = bestBuyTimes[0];
      lines.push(
        `- **BUY bias:** around **${b.timeIst} IST** — avg +${b.avgPositiveProfitPct.toFixed(2)}% on ${b.positiveCount}/${b.dayCount} days (best ${b.maxProfitPct.toFixed(2)}% on ${b.bestDayLabel}: buy ${b.bestEntryPrice.toFixed(2)} → sq ${b.bestSquareOffPrice.toFixed(2)} @ ${b.bestSquareOffTimeIst})`,
      );
    }
    if (bestSellTimes[0]) {
      const b = bestSellTimes[0];
      lines.push(
        `- **SELL bias:** around **${b.timeIst} IST** — avg +${b.avgPositiveProfitPct.toFixed(2)}% on ${b.positiveCount}/${b.dayCount} days (best ${b.maxProfitPct.toFixed(2)}% on ${b.bestDayLabel}: sell ${b.bestEntryPrice.toFixed(2)} → sq ${b.bestSquareOffPrice.toFixed(2)} @ ${b.bestSquareOffTimeIst})`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Weekday pattern (from each day's best BUY/SELL)",
    "",
    "| Weekday | BUY days | Avg best BUY % | Max BUY % | SELL days | Avg best SELL % | Max SELL % |",
    "|---------|----------|----------------|-----------|-----------|-----------------|------------|",
  );
  for (const row of weekdayRows) {
    lines.push(
      `| ${row.weekday} | ${row.buyDays} | ${row.avgBestBuyPct?.toFixed(2) ?? "—"}% | ${row.maxBestBuyPct?.toFixed(2) ?? "—"}% | ${row.sellDays} | ${row.avgBestSellPct?.toFixed(2) ?? "—"}% | ${row.maxBestSellPct?.toFixed(2) ?? "—"}% |`,
    );
  }

  lines.push(
    "",
    `## Top ${Math.min(topN, buys.length)} BUY opportunities (positive profit %)`,
    "",
    "| Rank | Day | Entry time | Buy price | SQ time | SQ price | Profit % |",
    "|------|-----|------------|-----------|---------|----------|----------|",
  );
  buys.slice(0, topN).forEach((o, i) => {
    lines.push(
      `| ${i + 1} | ${o.dayLabel} | ${o.entryTimeIst} | ${o.entryPrice.toFixed(2)} | ${o.squareOffTimeIst} | ${o.squareOffPrice.toFixed(2)} | **${o.profitPct.toFixed(2)}%** |`,
    );
  });

  lines.push(
    "",
    `## Top ${Math.min(topN, sells.length)} SELL opportunities (positive profit %)`,
    "",
    "| Rank | Day | Entry time | Sell price | SQ time | SQ price | Profit % |",
    "|------|-----|------------|------------|---------|----------|----------|",
  );
  sells.slice(0, topN).forEach((o, i) => {
    lines.push(
      `| ${i + 1} | ${o.dayLabel} | ${o.entryTimeIst} | ${o.entryPrice.toFixed(2)} | ${o.squareOffTimeIst} | ${o.squareOffPrice.toFixed(2)} | **${o.profitPct.toFixed(2)}%** |`,
    );
  });

  lines.push(
    "",
    "## Day-by-day best BUY and SELL",
    "",
    "| Day | Weekday | Best BUY time | Buy price | BUY SQ | BUY % | Best SELL time | Sell price | SELL SQ | SELL % |",
    "|-----|---------|---------------|-----------|--------|-------|----------------|------------|---------|--------|",
  );
  for (const day of [...dayBests].reverse()) {
    const b = day.buy;
    const s = day.sell;
    lines.push(
      `| ${day.dayLabel} | ${day.weekday} | ${b?.entryTimeIst ?? "—"} | ${b ? b.entryPrice.toFixed(2) : "—"} | ${b ? `${b.squareOffTimeIst} @ ${b.squareOffPrice.toFixed(2)}` : "—"} | ${b ? `**${b.profitPct.toFixed(2)}%**` : "—"} | ${s?.entryTimeIst ?? "—"} | ${s ? s.entryPrice.toFixed(2) : "—"} | ${s ? `${s.squareOffTimeIst} @ ${s.squareOffPrice.toFixed(2)}` : "—"} | ${s ? `**${s.profitPct.toFixed(2)}%**` : "—"} |`,
    );
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- **No Deepak / Deeppro / strategy filters** — pure hindsight on 15m mids.",
    "- Best square-off is the most favorable later mid the same day (not a live fill guarantee).",
    "- Use recurring entry-time stats for patterns; single-day maxes can be outliers.",
    "- Kite Connect historical 15m only.",
    "",
  );

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(mdPath, `${lines.join("\n")}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        symbol: dash.tradingSymbol,
        tradeDaysScanned: targetDates.length,
        window: { from: windowFrom, to: windowTo },
        positiveOpportunityCount: opportunities.length,
        overallBestBuy: overallBestBuy
          ? {
              day: overallBestBuy.dayLabel,
              time: overallBestBuy.entryTimeIst,
              entry: overallBestBuy.entryPrice,
              sq: overallBestBuy.squareOffPrice,
              pct: overallBestBuy.profitPct,
            }
          : null,
        overallBestSell: overallBestSell
          ? {
              day: overallBestSell.dayLabel,
              time: overallBestSell.entryTimeIst,
              entry: overallBestSell.entryPrice,
              sq: overallBestSell.squareOffPrice,
              pct: overallBestSell.profitPct,
            }
          : null,
        recommendedBuyTime: bestBuyTimes[0]?.timeIst ?? null,
        recommendedSellTime: bestSellTimes[0]?.timeIst ?? null,
        json: jsonPath,
        markdown: mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
