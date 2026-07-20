import "../src/loadEnv.js";
import { collectTradingDates, runDeepakBacktest } from "../src/backtest/runDeepakBacktest.js";
import { resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { DEEPAK_SCENARIOS } from "../src/rules/deepakDecision.js";
import { SECTOR_WATCHLIST } from "../src/symbols/sectorWatchlist.js";

const DAYS = Number(process.argv[2] ?? "60");
const LIMIT = Number(process.argv[3] ?? "10");

const MORNING_KEYS = new Set([
  DEEPAK_SCENARIOS.MORNING_BUY,
  DEEPAK_SCENARIOS.MORNING_SELL,
]);

type Row = { stock: string; side: "BUY" | "SELL"; date: string };

async function scanSymbol(tradingSymbol: string): Promise<Row[]> {
  const dashboardSymbol = resolveDashboardSymbol(tradingSymbol);
  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    range: "3mo",
  });
  const snapshots = buildIndicatorSnapshots(candles);
  const dates = collectTradingDates(snapshots).slice(-DAYS);
  if (dates.length === 0) {
    return [];
  }
  const fromDate = dates[0]!;
  const toDate = dates[dates.length - 1]!;
  const { trades } = runDeepakBacktest(snapshots, fromDate, toDate);

  return trades
    .filter((trade) => MORNING_KEYS.has(trade.scenarioKey))
    .map((trade) => ({
      stock: dashboardSymbol.tradingSymbol,
      side: trade.side,
      date: trade.date,
    }));
}

async function main(): Promise<void> {
  const found: Row[] = [];

  for (const entry of SECTOR_WATCHLIST) {
    process.stdout.write(`Scanning ${entry.tradingSymbol}... `);
    try {
      const rows = await scanSymbol(entry.tradingSymbol);
      found.push(...rows);
      console.log(`${rows.length} morning signal(s)`);
    } catch (error) {
      console.log(`skip (${error instanceof Error ? error.message : String(error)})`);
    }

    if (found.length >= LIMIT) {
      break;
    }
  }

  const sorted = [...found].sort((left, right) => right.date.localeCompare(left.date));
  const examples = sorted.slice(0, LIMIT);

  console.log(`\nMorning signals found: ${found.length}`);
  if (examples.length === 0) {
    console.log("No morning buy/sell signals in scanned symbols.");
    return;
  }

  console.log("\nStock".padEnd(14) + "Side".padEnd(6) + "Date");
  console.log("-".repeat(34));
  for (const row of examples) {
    console.log(row.stock.padEnd(14) + row.side.padEnd(6) + row.date);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
