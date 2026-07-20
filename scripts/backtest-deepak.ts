import "../src/loadEnv.js";
import { collectTradingDates, runDeepakBacktest } from "../src/backtest/runDeepakBacktest.js";
import { defaultDashboardSymbolId, getDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import type { DeepakBacktestTrade } from "../src/types.js";

const DAYS_REQUESTED = Number(process.argv[2] ?? "40");
const symbolId = (process.argv[3] ?? defaultDashboardSymbolId) as string;

function printTable(rows: DeepakBacktestTrade[]): void {
  if (rows.length === 0) {
    console.log("No BUY/SELL signals in the selected window.");
    return;
  }

  const headers = [
    "Date",
    "Side",
    "Sc#",
    "Scenario",
    "Entry IST",
    "Entry",
    "Exit IST",
    "Exit",
    "Hit",
    "Profit",
    "Match",
  ];

  const data = rows.map((row) => [
    row.date,
    row.side,
    String(row.scenarioNumber),
    row.scenarioKey.replace("deepak ", ""),
    row.entryTimeIst,
    row.entryPrice.toFixed(2),
    row.exitTimeIst ?? "—",
    row.exitPrice != null ? row.exitPrice.toFixed(2) : "—",
    row.targetHit ? "Y" : "N",
    row.profit != null ? row.profit.toFixed(2) : "—",
    row.bbMatchType,
  ]);

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...data.map((row) => row[index].length)),
  );

  const formatRow = (cells: string[]) =>
    cells.map((cell, index) => cell.padEnd(widths[index])).join("  ");

  console.log(formatRow(headers));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of data) {
    console.log(formatRow(row));
  }
}

async function main(): Promise<void> {
  const dashboardSymbol = getDashboardSymbol(symbolId);
  console.log(
    `Deepak backtest · ${dashboardSymbol.symbol} · last ${DAYS_REQUESTED} trading days\n`,
  );

  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    range: "3mo",
  });

  const snapshots = buildIndicatorSnapshots(candles);
  const allDates = collectTradingDates(snapshots);
  const targetDates = allDates.slice(-DAYS_REQUESTED);
  const fromDate = targetDates[0] ?? "1970-01-01";
  const toDate = targetDates[targetDates.length - 1] ?? fromDate;

  const { trades, summary } = runDeepakBacktest(snapshots, fromDate, toDate);

  console.log("Summary");
  console.log(`  Trading days scanned : ${summary.tradingDaysScanned}`);
  console.log(
    `  Date range           : ${summary.dateRange.from ?? "—"} → ${summary.dateRange.to ?? "—"}`,
  );
  console.log(
    `  Total signals        : ${summary.totalSignals} (${summary.buyCount} BUY, ${summary.sellCount} SELL)`,
  );
  console.log(`  Targets hit          : ${summary.targetsHit}`);
  console.log(`  Targets not hit      : ${summary.targetsMissed}`);
  if (summary.avgProfit != null) {
    console.log(`  Avg profit (exits)   : ${summary.avgProfit.toFixed(2)}`);
  }
  console.log("");

  printTable(trades);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Backtest failed: ${message}`);
  process.exit(1);
});
