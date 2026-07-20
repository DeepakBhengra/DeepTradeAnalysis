import "../src/loadEnv.js";
import { collectTradingDates, runDeepakBacktest } from "../src/backtest/runDeepakBacktest.js";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { DEEPAK_SCENARIOS } from "../src/rules/deepakDecision.js";
import { SECTOR_WATCHLIST } from "../src/symbols/sectorWatchlist.js";

const DAYS = Number(process.argv[2] ?? "10");

const DEFERRED_KEYS = new Set([
  DEEPAK_SCENARIOS.DEFERRED_UPPER_RESOLVE_3,
  DEEPAK_SCENARIOS.DEFERRED_LOWER_RESOLVE_3,
]);

type Row = {
  date: string;
  stock: string;
  sector: string;
  side: "BUY" | "SELL";
  entryTimeIst: string;
  entryPrice: number;
  scenarioKey: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scanSymbol(tradingSymbol: string, sector: string): Promise<Row[]> {
  const dashboardSymbol = resolveDashboardSymbol(tradingSymbol);
  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    range: "1mo",
    kiteRetries: config.dayScanKiteRetries,
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
    .filter((trade) => DEFERRED_KEYS.has(trade.scenarioKey))
    .map((trade) => ({
      date: trade.date,
      stock: dashboardSymbol.tradingSymbol,
      sector,
      side: trade.side,
      entryTimeIst: trade.entryTimeIst,
      entryPrice: trade.entryPrice,
      scenarioKey: trade.scenarioKey,
    }));
}

async function main(): Promise<void> {
  console.log(
    `Dual-band deferral report · last ${DAYS} trading days · ${SECTOR_WATCHLIST.length} symbols\n`,
  );

  const found: Row[] = [];
  const errors: string[] = [];
  let dateRange: { from: string; to: string } | null = null;

  for (let index = 0; index < SECTOR_WATCHLIST.length; index += 1) {
    const entry = SECTOR_WATCHLIST[index]!;
    process.stdout.write(`[${index + 1}/${SECTOR_WATCHLIST.length}] ${entry.tradingSymbol}... `);
    try {
      const rows = await scanSymbol(entry.tradingSymbol, entry.sector);
      found.push(...rows);
      if (rows.length > 0 && !dateRange) {
        // filled after first successful scan via collect, but we print from rows
      }
      console.log(`${rows.length} deferred signal(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${entry.tradingSymbol}: ${message}`);
      console.log(`error (${message})`);
      if (/access_token expired|unauthorized|Kite not connected/i.test(message)) {
        console.error("\nStopping early: Kite auth error.");
        break;
      }
    }

    if (index + 1 < SECTOR_WATCHLIST.length) {
      await delay(config.symbolBatchDelayMs);
    }
  }

  const sorted = [...found].sort((left, right) => {
    const dateDiff = right.date.localeCompare(left.date);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    const stockDiff = left.stock.localeCompare(right.stock);
    if (stockDiff !== 0) {
      return stockDiff;
    }
    return left.entryTimeIst.localeCompare(right.entryTimeIst);
  });

  if (sorted.length > 0) {
    dateRange = {
      from: sorted[sorted.length - 1]!.date,
      to: sorted[0]!.date,
    };
  }

  console.log(`\nDeferred dual-band signals: ${sorted.length}`);
  if (dateRange) {
    console.log(`Signal date span: ${dateRange.from} → ${dateRange.to}`);
  }
  console.log(`Fetch errors: ${errors.length}`);

  if (sorted.length === 0) {
    console.log("\nNo dual-band deferral (scenario 6) signals in the scanned window.");
    if (errors.length > 0) {
      console.log("\nErrors:");
      for (const entry of errors.slice(0, 10)) {
        console.log(`  - ${entry}`);
      }
    }
    return;
  }

  console.log(
    "\n" +
      "Date".padEnd(12) +
      "Stock".padEnd(14) +
      "Side".padEnd(6) +
      "Entry IST".padEnd(10) +
      "Entry Price".padEnd(12) +
      "Sector",
  );
  console.log("-".repeat(70));

  for (const row of sorted) {
    console.log(
      row.date.padEnd(12) +
        row.stock.padEnd(14) +
        row.side.padEnd(6) +
        row.entryTimeIst.padEnd(10) +
        row.entryPrice.toFixed(2).padEnd(12) +
        row.sector,
    );
  }

  const buyCount = sorted.filter((row) => row.side === "BUY").length;
  const sellCount = sorted.filter((row) => row.side === "SELL").length;
  console.log(`\nSummary: ${buyCount} BUY · ${sellCount} SELL`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
