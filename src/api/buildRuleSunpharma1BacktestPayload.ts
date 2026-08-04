import type { DashboardSymbolConfig } from "../config.js";
import { config, resolveDashboardSymbol } from "../config.js";
import { runRuleSunpharma1Backtest } from "../backtest/runRuleSunpharma1Backtest.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import { assertRuleSunpharma1Symbol } from "../rules/ruleSunpharma1Decision.js";
import type { DeepakBacktestPayload } from "../types.js";
import { validateDeepakBacktestDates } from "./buildDeepakBacktestPayload.js";

/**
 * RuleSUNPHARMA1 backtest — SUNPHARMA only. Rejects any other symbol so it
 * cannot be mixed with Deepak / Deeppro / RulePNB / RuleSUNPHARMA workflows.
 * API-only (no widget wiring).
 */
export async function buildRuleSunpharma1BacktestPayload(input: {
  symbol: string;
  fromDate: string;
  toDate: string;
}): Promise<DeepakBacktestPayload> {
  const dateError = validateDeepakBacktestDates(input.fromDate, input.toDate);
  if (dateError) {
    throw new Error(dateError);
  }

  assertRuleSunpharma1Symbol(input.symbol);

  const dashboardSymbol: DashboardSymbolConfig = resolveDashboardSymbol(
    config.ruleSunpharma1.tradingSymbol,
  );

  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  const snapshots = buildIndicatorSnapshots(candles);
  const { trades, summary } = runRuleSunpharma1Backtest(
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
