import type { DashboardSymbolConfig } from "../config.js";
import { resolveDashboardSymbol } from "../config.js";
import { runFavourableSymbolBacktest } from "../backtest/runFavourableSymbolBacktest.js";
import { fetchPnbCandles } from "../data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../indicators/compute.js";
import {
  assertFavourableSymbolRuleSymbol,
  getFavourableSymbolRuleConfig,
} from "../rules/favourableSymbolRule.js";
import type {
  DeepakBacktestPayload,
  FavourableSymbolRuleId,
} from "../types.js";
import { validateDeepakBacktestDates } from "./buildDeepakBacktestPayload.js";

/** Single-symbol favourable-rule backtest — rejects any other symbol. */
export async function buildFavourableSymbolBacktestPayload(input: {
  ruleId: FavourableSymbolRuleId;
  symbol: string;
  fromDate: string;
  toDate: string;
}): Promise<DeepakBacktestPayload> {
  const dateError = validateDeepakBacktestDates(input.fromDate, input.toDate);
  if (dateError) {
    throw new Error(dateError);
  }

  assertFavourableSymbolRuleSymbol(input.ruleId, input.symbol);
  const rule = getFavourableSymbolRuleConfig(input.ruleId);

  const dashboardSymbol: DashboardSymbolConfig = resolveDashboardSymbol(
    rule.tradingSymbol,
  );

  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  const snapshots = buildIndicatorSnapshots(candles);
  const { trades, summary } = runFavourableSymbolBacktest(
    input.ruleId,
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
