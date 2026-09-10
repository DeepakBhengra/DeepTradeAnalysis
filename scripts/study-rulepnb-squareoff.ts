#!/usr/bin/env node
/**
 * RulePNB same-day square-off report for PNB only.
 *
 * Entry: RulePNB signal mid (high+low)/2
 * Square-off: best later same-day mid before 15:15 IST
 *
 * Usage:
 *   npx tsx scripts/study-rulepnb-squareoff.ts --from 2026-07-01 --to 2026-07-31
 */
import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import {
  assertRulePnbSymbol,
  evaluateRulePnbDay,
} from "../src/rules/rulePnbDecision.js";
import type { IndicatorSnapshot, RulePnbSignal } from "../src/types.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SESSION_END = "15:15";

function parseArgs(argv: string[]): {
  fromDate: string;
  toDate: string;
  outSuffix: string | null;
} {
  let fromDate = "2026-07-01";
  let toDate = "2026-07-31";
  let outSuffix: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new Error("Use YYYY-MM-DD for --from / --to.");
  }
  if (fromDate > toDate) {
    throw new Error("--from must be on or before --to.");
  }

  return { fromDate, toDate, outSuffix };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function midPrice(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
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

function collectTradingDates(
  snapshots: IndicatorSnapshot[],
  fromDate: string,
  toDate: string,
): string[] {
  const dates = new Set<string>();
  for (const snapshot of snapshots) {
    const dateKey = getIstTimeParts(snapshot.timestamp).dateKey;
    if (dateKey >= fromDate && dateKey <= toDate && isWeekday(dateKey)) {
      dates.add(dateKey);
    }
  }
  return [...dates].sort();
}

function bestSquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryTimeIst: string,
  side: "BUY" | "SELL",
  entryPrice: number,
): {
  hasExitWindow: boolean;
  squareOffTimeIst: string | null;
  squareOffPrice: number | null;
  profitPct: number | null;
  eodTimeIst: string | null;
  eodPrice: number | null;
  eodProfitPct: number | null;
} {
  const after = snapshots.filter((snapshot) => {
    const parts = getIstTimeParts(snapshot.timestamp);
    if (parts.dateKey !== dateKey) {
      return false;
    }
    const timeIst = formatIstTime(snapshot.timestamp);
    return timeIst > entryTimeIst && timeIst <= SESSION_END;
  });

  if (after.length === 0) {
    return {
      hasExitWindow: false,
      squareOffTimeIst: null,
      squareOffPrice: null,
      profitPct: null,
      eodTimeIst: null,
      eodPrice: null,
      eodProfitPct: null,
    };
  }

  let squareOffTimeIst: string | null = null;
  let squareOffPrice: number | null = null;
  let profitPct: number | null = null;

  for (const snapshot of after) {
    const exitPrice = midPrice(snapshot);
    const pct =
      side === "SELL"
        ? ((entryPrice - exitPrice) / entryPrice) * 100
        : ((exitPrice - entryPrice) / entryPrice) * 100;
    if (profitPct == null || pct > profitPct) {
      profitPct = pct;
      squareOffPrice = exitPrice;
      squareOffTimeIst = formatIstTime(snapshot.timestamp);
    }
  }

  const eod = after[after.length - 1];
  const eodPrice = midPrice(eod);
  const eodProfitPct =
    side === "SELL"
      ? ((entryPrice - eodPrice) / entryPrice) * 100
      : ((eodPrice - entryPrice) / entryPrice) * 100;

  return {
    hasExitWindow: true,
    squareOffTimeIst,
    squareOffPrice: squareOffPrice == null ? null : round(squareOffPrice),
    profitPct: profitPct == null ? null : round(profitPct),
    eodTimeIst: formatIstTime(eod.timestamp),
    eodPrice: round(eodPrice),
    eodProfitPct: round(eodProfitPct),
  };
}

interface TradeRow {
  dateKey: string;
  dayLabel: string;
  weekday: string;
  side: "BUY" | "SELL";
  scenarioKey: string;
  entryTimeIst: string;
  entryPrice: number;
  squareOffTimeIst: string | null;
  squareOffPrice: number | null;
  profitPct: number | null;
  eodTimeIst: string | null;
  eodPrice: number | null;
  eodProfitPct: number | null;
  rsi: number;
  smi: number;
  reasons: string[];
}

async function main(): Promise<void> {
  const { fromDate, toDate, outSuffix } = parseArgs(process.argv.slice(2));
  assertRulePnbSymbol(config.rulePnb.tradingSymbol);
  const dash = resolveDashboardSymbol(config.rulePnb.tradingSymbol);

  // Warm indicators before July 1.
  const warmFrom = new Date(`${fromDate}T12:00:00+05:30`);
  warmFrom.setDate(warmFrom.getDate() - 45);
  const fetchFrom = warmFrom.toISOString().slice(0, 10);

  console.log(
    JSON.stringify({
      phase: "start",
      rule: "rulePnb",
      symbol: dash.tradingSymbol,
      fromDate,
      toDate,
      fetchFrom,
    }),
  );

  const candles = await fetchPnbCandles({
    symbol: dash.tradingSymbol,
    exchange: dash.exchange,
    segment: dash.segment,
    fromDate: fetchFrom,
    toDate,
  });
  const snapshots = buildIndicatorSnapshots(candles);
  const tradingDates = collectTradingDates(snapshots, fromDate, toDate);

  const trades: TradeRow[] = [];

  for (const dateKey of tradingDates) {
    const day = evaluateRulePnbDay(snapshots, dateKey);
    for (const signal of day.signals as RulePnbSignal[]) {
      const sq = bestSquareOff(
        snapshots,
        dateKey,
        signal.timeIst,
        signal.side,
        signal.price,
      );
      trades.push({
        dateKey,
        dayLabel: formatDayLabel(dateKey),
        weekday: weekdayName(dateKey),
        side: signal.side,
        scenarioKey: signal.scenarioKey,
        entryTimeIst: signal.timeIst,
        entryPrice: round(signal.price),
        squareOffTimeIst: sq.squareOffTimeIst,
        squareOffPrice: sq.squareOffPrice,
        profitPct: sq.profitPct,
        eodTimeIst: sq.eodTimeIst,
        eodPrice: sq.eodPrice,
        eodProfitPct: sq.eodProfitPct,
        rsi: round(signal.rsi, 1),
        smi: round(signal.smi, 1),
        reasons: signal.reasons,
      });
    }
  }

  const buys = trades.filter((t) => t.side === "BUY");
  const sells = trades.filter((t) => t.side === "SELL");
  const withProfit = trades.filter((t) => t.profitPct != null);
  const positive = withProfit.filter((t) => (t.profitPct ?? 0) > 0);
  const avg = (values: number[]) =>
    values.length === 0
      ? null
      : round(values.reduce((sum, value) => sum + value, 0) / values.length);

  const generatedAtUtc = new Date().toISOString();
  const suffix =
    outSuffix ??
    `${fromDate.replace(/-/g, "")}_${toDate.replace(/-/g, "")}`;
  mkdirSync(REPORTS_DIR, { recursive: true });
  const mdPath = resolve(REPORTS_DIR, `rulepnb-pnb-squareoff-${suffix}.md`);
  const jsonPath = resolve(REPORTS_DIR, `rulepnb-pnb-squareoff-${suffix}.json`);

  const scenarioLabel = (key: string) => key.replace(/_/g, " ");

  const lines = [
    `# RulePNB — PNB square-off report (${fromDate} → ${toDate})`,
    "",
    `- **Rule:** RulePNB (PNB-only; separate from Deepak / Deeppro)`,
    `- **Symbol:** ${dash.tradingSymbol}`,
    `- **Window:** ${tradingDates.length} trade days (${fromDate} → ${toDate})`,
    `- **Entry:** RulePNB signal candle mid \`(high+low)/2\``,
    `- **Square-off:** best later same-day mid before \`${SESSION_END}\` IST`,
    `- **BUY profit %:** \`(sq - entry) / entry × 100\``,
    `- **SELL profit %:** \`(entry - sq) / entry × 100\``,
    `- **Signals:** ${trades.length} (${buys.length} BUY · ${sells.length} SELL)`,
    `- **Positive best-SQ:** ${positive.length}/${withProfit.length}`,
    `- **Avg best-SQ % (all signals):** ${avg(withProfit.map((t) => t.profitPct!))?.toFixed(2) ?? "—"}%`,
    `- **Avg best-SQ % (BUY):** ${avg(buys.filter((t) => t.profitPct != null).map((t) => t.profitPct!))?.toFixed(2) ?? "—"}%`,
    `- **Avg best-SQ % (SELL):** ${avg(sells.filter((t) => t.profitPct != null).map((t) => t.profitPct!))?.toFixed(2) ?? "—"}%`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## All RulePNB trades (chronological)",
    "",
    "| Day | Weekday | Side | Scenario | Entry time | Entry price | SQ time | SQ price | Profit % | RSI | SMI |",
    "|-----|---------|------|----------|------------|-------------|---------|----------|----------|-----|-----|",
  ];

  for (const trade of trades) {
    const profit =
      trade.profitPct == null ? "—" : `**${trade.profitPct.toFixed(2)}%**`;
    lines.push(
      `| ${trade.dayLabel} | ${trade.weekday} | ${trade.side} | ${scenarioLabel(trade.scenarioKey)} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | ${profit} | ${trade.rsi.toFixed(1)} | ${trade.smi.toFixed(1)} |`,
    );
  }

  if (trades.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | *no signals* | — | — |");
  }

  lines.push(
    "",
    "## BUY signals",
    "",
    "| Day | Entry time | Entry price | SQ time | SQ price | Profit % | Scenario |",
    "|-----|------------|-------------|---------|----------|----------|----------|",
  );
  for (const trade of buys) {
    lines.push(
      `| ${trade.dayLabel} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | ${trade.profitPct == null ? "—" : `**${trade.profitPct.toFixed(2)}%**`} | ${scenarioLabel(trade.scenarioKey)} |`,
    );
  }
  if (buys.length === 0) {
    lines.push("| — | — | — | — | — | *none* | — |");
  }

  lines.push(
    "",
    "## SELL signals",
    "",
    "| Day | Entry time | Entry price | SQ time | SQ price | Profit % | Scenario |",
    "|-----|------------|-------------|---------|----------|----------|----------|",
  );
  for (const trade of sells) {
    lines.push(
      `| ${trade.dayLabel} | ${trade.entryTimeIst} | ${trade.entryPrice.toFixed(2)} | ${trade.squareOffTimeIst ?? "—"} | ${trade.squareOffPrice?.toFixed(2) ?? "—"} | ${trade.profitPct == null ? "—" : `**${trade.profitPct.toFixed(2)}%**`} | ${scenarioLabel(trade.scenarioKey)} |`,
    );
  }
  if (sells.length === 0) {
    lines.push("| — | — | — | — | — | *none* | — |");
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- RulePNB only evaluates **PNB**.",
    "- One earliest BUY (quality preferred over extended) and one earliest SELL quality signal per day.",
    "- Square-off is the **best later mid** before 15:15 (hindsight study metric, not a live fill guarantee).",
    `- Config: BUY quality RSI ${config.rulePnb.buyQuality.minRsi}–${config.rulePnb.buyQuality.maxRsi}, SMI ≤ ${config.rulePnb.buyQuality.maxSmi}, BB lower ≤ ${config.rulePnb.buyQuality.maxBbLowerGapPct}%; SELL quality RSI ${config.rulePnb.sellQuality.minRsi}–${config.rulePnb.sellQuality.maxRsi}, SMI ≥ ${config.rulePnb.sellQuality.minSmi}, BB upper ≤ ${config.rulePnb.sellQuality.maxBbUpperGapPct}%; BUY extended SMI < 0, BB lower ≤ ${config.rulePnb.buyExtended.maxBbLowerGapPct}%.`,
    "",
  );

  writeFileSync(mdPath, `${lines.join("\n")}\n`);
  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        rule: "rulePnb",
        symbol: dash.tradingSymbol,
        window: { from: fromDate, to: toDate },
        tradeDaysScanned: tradingDates.length,
        signalCount: trades.length,
        buyCount: buys.length,
        sellCount: sells.length,
        positiveBestSqCount: positive.length,
        avgBestSqPct: avg(withProfit.map((t) => t.profitPct!)),
        avgBestBuySqPct: avg(
          buys.filter((t) => t.profitPct != null).map((t) => t.profitPct!),
        ),
        avgBestSellSqPct: avg(
          sells.filter((t) => t.profitPct != null).map((t) => t.profitPct!),
        ),
        trades,
        generatedAtUtc,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        tradeDaysScanned: tradingDates.length,
        signalCount: trades.length,
        buyCount: buys.length,
        sellCount: sells.length,
        positiveBestSqCount: positive.length,
        avgBestSqPct: avg(withProfit.map((t) => t.profitPct!)),
        markdown: mdPath,
        json: jsonPath,
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
