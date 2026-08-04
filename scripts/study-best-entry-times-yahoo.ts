#!/usr/bin/env node
/**
 * Rule-free best entry-time study using Yahoo Finance 15m bars.
 * Fallback when Kite access_token is unavailable.
 *
 * Usage:
 *   npx tsx scripts/study-best-entry-times-yahoo.ts --symbol SUNPHARMA --range 60d
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

interface DayBest {
  dateKey: string;
  dayLabel: string;
  weekday: string;
  buy: Opportunity | null;
  sell: Opportunity | null;
}

function parseArgs(argv: string[]): {
  symbol: string;
  range: string;
  topN: number;
  outSuffix: string;
} {
  let symbol = "SUNPHARMA";
  let range = "60d";
  let topN = 25;
  let outSuffix = "60d";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--symbol" && argv[i + 1]) {
      symbol = argv[++i].toUpperCase();
      continue;
    }
    if (arg === "--range" && argv[i + 1]) {
      range = argv[++i];
      continue;
    }
    if (arg === "--top" && argv[i + 1]) {
      topN = Math.max(1, Math.floor(Number(argv[++i])));
      continue;
    }
    if (arg === "--out-suffix" && argv[i + 1]) {
      outSuffix = argv[++i];
      continue;
    }
  }

  return { symbol, range, topN, outSuffix };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function yahooSymbol(nseSymbol: string): string {
  return `${nseSymbol.toUpperCase()}.NS`;
}

function formatIstParts(date: Date): { dateKey: string; timeIst: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    timeIst: `${get("hour")}:${get("minute")}`,
  };
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

function isWeekday(dateKey: string): boolean {
  const weekday = weekdayName(dateKey);
  return weekday !== "Saturday" && weekday !== "Sunday";
}

async function fetchYahoo15m(symbol: string, range: string): Promise<CandleBar[]> {
  const ysym = yahooSymbol(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ysym)}?range=${encodeURIComponent(range)}&interval=15m`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    throw new Error(`Yahoo chart request failed: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
          }>;
        };
      }>;
      error?: { description?: string } | null;
    };
  };

  const result = payload.chart?.result?.[0];
  if (!result?.timestamp?.length) {
    throw new Error(
      `Yahoo returned no 15m bars for ${ysym}: ${payload.chart?.error?.description ?? "empty result"}`,
    );
  }
  const quote = result.indicators?.quote?.[0];
  if (!quote) {
    throw new Error(`Yahoo returned no quote series for ${ysym}`);
  }

  const bars: CandleBar[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (
      high == null ||
      low == null ||
      close == null ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }
    const timestamp = new Date(result.timestamp[i] * 1000);
    const { dateKey, timeIst } = formatIstParts(timestamp);
    if (timeIst < SESSION_START || timeIst > SESSION_END) {
      continue;
    }
    bars.push({
      timestamp,
      dateKey,
      timeIst,
      mid: (high + low) / 2,
      high,
      low,
      close,
    });
  }

  return bars.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
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

async function main(): Promise<void> {
  const { symbol, range, topN, outSuffix } = parseArgs(process.argv.slice(2));
  console.log(
    JSON.stringify({
      phase: "start",
      symbol,
      range,
      source: "yahoo-finance-15m",
      mode: "rule-free-best-entry-times",
    }),
  );

  const allBars = await fetchYahoo15m(symbol, range);
  const byDay = new Map<string, CandleBar[]>();
  for (const bar of allBars) {
    if (!isWeekday(bar.dateKey)) continue;
    const list = byDay.get(bar.dateKey) ?? [];
    list.push(bar);
    byDay.set(bar.dateKey, list);
  }
  for (const [, list] of byDay) {
    list.sort((a, b) => a.timeIst.localeCompare(b.timeIst));
  }

  const targetDates = [...byDay.keys()].sort();
  const opportunities: Opportunity[] = [];
  const dayBests: DayBest[] = [];

  for (const dateKey of targetDates) {
    const bars = byDay.get(dateKey) ?? [];
    let dayBestBuy: Opportunity | null = null;
    let dayBestSell: Opportunity | null = null;

    for (let i = 0; i < bars.length; i++) {
      const entry = bars[i];
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

  // Aggregate by entry clock time
  const bucketMap = new Map<string, Opportunity[]>();
  for (const opp of opportunities) {
    const key = `${opp.side}|${opp.entryTimeIst}`;
    const list = bucketMap.get(key) ?? [];
    list.push(opp);
    bucketMap.set(key, list);
  }

  const timeBuckets = [...bucketMap.entries()].map(([key, list]) => {
    const [side, timeIst] = key.split("|") as ["BUY" | "SELL", string];
    const daysWithBar = targetDates.filter((dateKey) => {
      const bars = byDay.get(dateKey) ?? [];
      return bars.some((b) => b.timeIst === timeIst && b.timeIst < SESSION_END);
    }).length;
    const best = [...list].sort((a, b) => b.profitPct - a.profitPct)[0];
    const avg =
      list.reduce((sum, o) => sum + o.profitPct, 0) / Math.max(list.length, 1);
    return {
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
    };
  });

  const score = (b: (typeof timeBuckets)[number]) =>
    b.avgPositiveProfitPct * Math.sqrt(b.positiveCount);
  const bestBuyTimes = timeBuckets
    .filter((b) => b.side === "BUY")
    .sort((a, b) => score(b) - score(a));
  const bestSellTimes = timeBuckets
    .filter((b) => b.side === "SELL")
    .sort((a, b) => score(b) - score(a));

  const weekdayAgg = new Map<string, { buyPcts: number[]; sellPcts: number[] }>();
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
          : round(stats.buyPcts.reduce((s, v) => s + v, 0) / stats.buyPcts.length),
      maxBestBuyPct:
        stats.buyPcts.length === 0 ? null : round(Math.max(...stats.buyPcts)),
      sellDays: stats.sellPcts.length,
      avgBestSellPct:
        stats.sellPcts.length === 0
          ? null
          : round(stats.sellPcts.reduce((s, v) => s + v, 0) / stats.sellPcts.length),
      maxBestSellPct:
        stats.sellPcts.length === 0 ? null : round(Math.max(...stats.sellPcts)),
    }))
    .sort((a, b) => (b.avgBestBuyPct ?? 0) - (a.avgBestBuyPct ?? 0));

  const windowFrom = targetDates[0] ?? "";
  const windowTo = targetDates[targetDates.length - 1] ?? "";
  const generatedAtUtc = new Date().toISOString();
  const slug = symbol.toLowerCase();
  mkdirSync(REPORTS_DIR, { recursive: true });
  const base = `${slug}-best-entry-times-${outSuffix}`;
  const jsonPath = resolve(REPORTS_DIR, `${base}.json`);
  const mdPath = resolve(REPORTS_DIR, `${base}.md`);
  const source = `Yahoo Finance chart (${yahooSymbol(symbol)}, 15m, range=${range})`;

  const overallBestBuy = buys[0] ?? null;
  const overallBestSell = sells[0] ?? null;

  const payload = {
    mode: "rule-free-best-entry-times",
    symbol,
    tradeDaysRequested: Number(range.replace(/\D/g, "")) || targetDates.length,
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
    data: { source, candleCount: allBars.length },
    generatedAtUtc,
    topBuys: buys.slice(0, topN),
    topSells: sells.slice(0, topN),
    bestBuyTimes: bestBuyTimes.slice(0, 15),
    bestSellTimes: bestSellTimes.slice(0, 15),
    weekdayRows,
    dayBests,
  };

  const lines = [
    `# ${symbol} — best BUY/SELL times (${windowFrom} → ${windowTo}, rule-free)`,
    "",
    `- **Symbol:** ${symbol}`,
    `- **Window:** ${targetDates.length} trade days (${windowFrom} → ${windowTo})`,
    `- **Rules:** **none** — every 15m candle mid is an entry candidate`,
    `- **Entry:** candle mid \`(high+low)/2\``,
    `- **Square-off:** best later same-day mid before \`${SESSION_END}\` IST`,
    `- **BUY profit %:** \`(sq - entry) / entry × 100\` (positive only)`,
    `- **SELL profit %:** \`(entry - sq) / entry × 100\` (positive only)`,
    `- **Positive opportunities:** ${opportunities.length} (${buys.length} BUY · ${sells.length} SELL)`,
    `- **Data:** ${source}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Verdict — best single trades",
    "",
  ];

  if (overallBestBuy) {
    lines.push(
      "### Best BUY overall",
      "",
      "| Field | Value |",
      "|-------|-------|",
      `| Day | **${overallBestBuy.dayLabel}** (${weekdayName(overallBestBuy.dateKey)}) |`,
      `| Entry time | **${overallBestBuy.entryTimeIst}** IST |`,
      `| Buy price | ${overallBestBuy.entryPrice.toFixed(2)} |`,
      `| Square-off time | ${overallBestBuy.squareOffTimeIst} IST |`,
      `| Square-off price | ${overallBestBuy.squareOffPrice.toFixed(2)} |`,
      `| Profit % | **${overallBestBuy.profitPct.toFixed(2)}%** |`,
      "",
    );
  }

  if (overallBestSell) {
    lines.push(
      "### Best SELL overall",
      "",
      "| Field | Value |",
      "|-------|-------|",
      `| Day | **${overallBestSell.dayLabel}** (${weekdayName(overallBestSell.dateKey)}) |`,
      `| Entry time | **${overallBestSell.entryTimeIst}** IST |`,
      `| Sell price | ${overallBestSell.entryPrice.toFixed(2)} |`,
      `| Square-off time | ${overallBestSell.squareOffTimeIst} IST |`,
      `| Square-off price | ${overallBestSell.squareOffPrice.toFixed(2)} |`,
      `| Profit % | **${overallBestSell.profitPct.toFixed(2)}%** |`,
      "",
    );
  }

  lines.push(
    "## Recommended clock times",
    "",
    "Ranked by avg positive profit % × √(hit count).",
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

  lines.push(
    "",
    "## Best weekday",
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
    `## Top ${Math.min(topN, buys.length)} BUY opportunities`,
    "",
    "| Rank | Day | Entry time | Buy price | SQ time | SQ price | Profit % |",
    "|------|-----|------------|-----------|---------|----------|----------|",
  );
  buys.slice(0, topN).forEach((b, i) => {
    lines.push(
      `| ${i + 1} | ${b.dayLabel} | ${b.entryTimeIst} | ${b.entryPrice.toFixed(2)} | ${b.squareOffTimeIst} | ${b.squareOffPrice.toFixed(2)} | **${b.profitPct.toFixed(2)}%** |`,
    );
  });

  lines.push(
    "",
    `## Top ${Math.min(topN, sells.length)} SELL opportunities`,
    "",
    "| Rank | Day | Entry time | Sell price | SQ time | SQ price | Profit % |",
    "|------|-----|------------|------------|---------|----------|----------|",
  );
  sells.slice(0, topN).forEach((s, i) => {
    lines.push(
      `| ${i + 1} | ${s.dayLabel} | ${s.entryTimeIst} | ${s.entryPrice.toFixed(2)} | ${s.squareOffTimeIst} | ${s.squareOffPrice.toFixed(2)} | **${s.profitPct.toFixed(2)}%** |`,
    );
  });

  lines.push(
    "",
    "## Notes",
    "",
    "- No Deepak / Deeppro / RulePNB rules — pure 15m mid hindsight.",
    "- Square-off is best later mid before 15:15 (not a live fill guarantee).",
    `- Yahoo used because Kite access_token was unavailable at generation time.`,
    "",
  );

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(mdPath, `${lines.join("\n")}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        symbol,
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
