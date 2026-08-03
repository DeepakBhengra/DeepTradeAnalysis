import type { DashboardSymbolConfig } from "../config.js";
import { config, resolveDashboardSymbol } from "../config.js";
import { runRulePnbBacktest } from "../backtest/runRulePnbBacktest.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import { assertRulePnbSymbol } from "../rules/rulePnbDecision.js";
import type { DeepakBacktestPayload } from "../types.js";
import { validateDeepakBacktestDates } from "./buildDeepakBacktestPayload.js";

/**
 * RulePNB backtest — PNB only. Rejects any other symbol so it cannot
 * be mixed with Deepak / Deeppro multi-symbol workflows.
 */
export async function buildRulePnbBacktestPayload(input: {
  symbol: string;
  fromDate: string;
  toDate: string;
}): Promise<DeepakBacktestPayload> {
  const dateError = validateDeepakBacktestDates(input.fromDate, input.toDate);
  if (dateError) {
    throw new Error(dateError);
  }

  assertRulePnbSymbol(input.symbol);

  const dashboardSymbol: DashboardSymbolConfig = resolveDashboardSymbol(
    config.rulePnb.tradingSymbol,
  );

  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  const snapshots = buildIndicatorSnapshots(candles);
  const { trades, summary } = runRulePnbBacktest(
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
