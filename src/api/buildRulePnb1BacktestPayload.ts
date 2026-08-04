import type { DashboardSymbolConfig } from "../config.js";
import { config, resolveDashboardSymbol } from "../config.js";
import { runRulePnb1Backtest } from "../backtest/runRulePnb1Backtest.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import { assertRulePnb1Symbol } from "../rules/rulePnb1Decision.js";
import type { DeepakBacktestPayload } from "../types.js";
import { validateDeepakBacktestDates } from "./buildDeepakBacktestPayload.js";

/**
 * RulePNB1 backtest — PNB only. Rejects any other symbol.
 * API-only (no widget wiring). Separate from RulePNB / RuleSUNPHARMA1.
 */
export async function buildRulePnb1BacktestPayload(input: {
  symbol: string;
  fromDate: string;
  toDate: string;
}): Promise<DeepakBacktestPayload> {
  const dateError = validateDeepakBacktestDates(input.fromDate, input.toDate);
  if (dateError) {
    throw new Error(dateError);
  }

  assertRulePnb1Symbol(input.symbol);

  const dashboardSymbol: DashboardSymbolConfig = resolveDashboardSymbol(
    config.rulePnb1.tradingSymbol,
  );

  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  const snapshots = buildIndicatorSnapshots(candles);
  const { trades, summary } = runRulePnb1Backtest(
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
