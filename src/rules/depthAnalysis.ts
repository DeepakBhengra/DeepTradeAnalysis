import { config } from "../config.js";
import type { KiteQuote } from "../data/quoteFeed.js";
import type { DepthFlags, DepthSnapshot, DepthWall } from "../types.js";

export interface DepthAnalysisResult {
  snapshot: DepthSnapshot;
  flags: DepthFlags;
  reasons: string[];
}

function findStrongestWall(levels: { price: number; quantity: number }[]): DepthWall | null {
  if (levels.length === 0) {
    return null;
  }

  const strongest = levels.reduce((max, level) =>
    level.quantity > max.quantity ? level : max,
  );

  if (strongest.quantity < config.depth.wallThresholdQty) {
    return null;
  }

  return strongest;
}

function isWallNearPrice(wall: DepthWall | null, lastPrice: number): boolean {
  if (!wall || lastPrice <= 0) {
    return false;
  }

  const distancePct = (Math.abs(lastPrice - wall.price) / lastPrice) * 100;
  return distancePct <= config.depth.wallProximityPct;
}

function buildDepthReasons(flags: DepthFlags, snapshot: DepthSnapshot): string[] {
  const reasons: string[] = [];

  if (flags.bidDominant) {
    reasons.push(
      `Bid-side depth dominant (imbalance ${snapshot.imbalanceRatio.toFixed(2)})`,
    );
  }
  if (flags.askDominant) {
    reasons.push(
      `Ask-side depth dominant (imbalance ${snapshot.imbalanceRatio.toFixed(2)})`,
    );
  }
  if (flags.tightSpread) {
    reasons.push(`Tight bid-ask spread (${snapshot.spread.toFixed(2)})`);
  }
  if (flags.bidWallNearPrice && snapshot.strongestBidWall) {
    reasons.push(
      `Buy wall near price at ${snapshot.strongestBidWall.price.toFixed(2)} (${snapshot.strongestBidWall.quantity.toLocaleString("en-IN")} qty)`,
    );
  }
  if (flags.askWallNearPrice && snapshot.strongestAskWall) {
    reasons.push(
      `Sell wall near price at ${snapshot.strongestAskWall.price.toFixed(2)} (${snapshot.strongestAskWall.quantity.toLocaleString("en-IN")} qty)`,
    );
  }

  return reasons;
}

export function evaluateDepthAnalysis(quote: KiteQuote): DepthAnalysisResult {
  const nearLevels = config.depth.nearLevels;
  const bids = quote.bids.slice(0, nearLevels);
  const asks = quote.asks.slice(0, nearLevels);

  const nearBidQty = bids.reduce((sum, level) => sum + level.quantity, 0);
  const nearAskQty = asks.reduce((sum, level) => sum + level.quantity, 0);

  const bestBid = bids[0]?.price ?? 0;
  const bestAsk = asks[0]?.price ?? 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;

  const imbalanceRatio =
    quote.sellQuantity > 0 ? quote.buyQuantity / quote.sellQuantity : 0;

  const strongestBidWall = findStrongestWall(bids);
  const strongestAskWall = findStrongestWall(asks);

  const snapshot: DepthSnapshot = {
    lastPrice: quote.lastPrice,
    buyQuantity: quote.buyQuantity,
    sellQuantity: quote.sellQuantity,
    imbalanceRatio,
    nearBidQty,
    nearAskQty,
    spread,
    bids,
    asks,
    strongestBidWall,
    strongestAskWall,
  };

  const spreadPct =
    quote.lastPrice > 0 ? (spread / quote.lastPrice) * 100 : Number.POSITIVE_INFINITY;

  const flags: DepthFlags = {
    bidDominant: imbalanceRatio >= config.depth.imbalanceBullish,
    askDominant: imbalanceRatio <= config.depth.imbalanceBearish,
    tightSpread: spreadPct <= config.depth.tightSpreadPct,
    bidWallNearPrice: isWallNearPrice(strongestBidWall, quote.lastPrice),
    askWallNearPrice: isWallNearPrice(strongestAskWall, quote.lastPrice),
  };

  return {
    snapshot,
    flags,
    reasons: buildDepthReasons(flags, snapshot),
  };
}
