import type { DashboardSymbolConfig } from "../config.js";
import { resolveDashboardSymbol } from "../config.js";
import { runDeepakWatchPartyBacktest } from "../backtest/runDeepakWatchPartyBacktest.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import type { DeepakWatchPartyBacktestPayload } from "../types.js";
import { validateDeepakBacktestDates } from "./buildDeepakBacktestPayload.js";

export async function buildDeepakWatchPartyBacktestPayload(input: {
  symbol: string;
  fromDate: string;
  toDate: string;
}): Promise<DeepakWatchPartyBacktestPayload> {
  const dateError = validateDeepakBacktestDates(input.fromDate, input.toDate);
  if (dateError) {
    throw new Error(dateError);
  }

  const dashboardSymbol: DashboardSymbolConfig = resolveDashboardSymbol(input.symbol);

  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  const snapshots = buildIndicatorSnapshots(candles);
  const { trades, summary } = runDeepakWatchPartyBacktest(
    snapshots,
    input.fromDate,
    input.toDate,
  );

  return {
    symbol: dashboardSymbol.symbol,
    tradingSymbol: dashboardSymbol.tradingSymbol,
    fromDate: input.fromDate,
    toDate: input.toDate,
    trades,
    summary,
    runAt: new Date().toISOString(),
  };
}
