import type { DashboardSymbolConfig } from "../config.js";
import { resolveDashboardSymbol } from "../config.js";
import { runDeepakBacktest } from "../backtest/runDeepakBacktest.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import type { DeepakBacktestPayload } from "../types.js";
import { isValidAnalysisDate } from "../utils/marketTime.js";

const MAX_RANGE_DAYS = 90;

function daysBetween(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00+05:30`);
  const to = Date.parse(`${toDate}T00:00:00+05:30`);
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}

export function validateDeepakBacktestDates(
  fromDate: string,
  toDate: string,
): string | null {
  if (!isValidAnalysisDate(fromDate) || !isValidAnalysisDate(toDate)) {
    return "Invalid date format. Use YYYY-MM-DD.";
  }

  if (fromDate > toDate) {
    return "from date must be on or before to date.";
  }

  const span = daysBetween(fromDate, toDate);
  if (span > MAX_RANGE_DAYS) {
    return `Date range cannot exceed ${MAX_RANGE_DAYS} calendar days.`;
  }

  return null;
}

export async function buildDeepakBacktestPayload(input: {
  symbol: string;
  fromDate: string;
  toDate: string;
}): Promise<DeepakBacktestPayload> {
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
  const { trades, summary } = runDeepakBacktest(
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
