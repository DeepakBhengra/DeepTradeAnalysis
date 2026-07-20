import { describe, expect, it } from "vitest";
import type { KiteQuote } from "../../src/data/quoteFeed.js";
import { evaluateDepthAnalysis } from "../../src/rules/depthAnalysis.js";

function makeQuote(overrides: Partial<KiteQuote> = {}): KiteQuote {
  return {
    lastPrice: 108.99,
    buyQuantity: 1_920_111,
    sellQuantity: 3_162_638,
    bids: [
      { price: 108.94, orders: 2, quantity: 3023 },
      { price: 108.93, orders: 2, quantity: 613 },
      { price: 108.92, orders: 3, quantity: 832 },
      { price: 108.91, orders: 10, quantity: 3546 },
      { price: 108.9, orders: 27, quantity: 28144 },
    ],
    asks: [
      { price: 108.99, orders: 6, quantity: 1817 },
      { price: 109.0, orders: 9, quantity: 2261 },
      { price: 109.01, orders: 7, quantity: 1576 },
      { price: 109.02, orders: 9, quantity: 2501 },
      { price: 109.03, orders: 7, quantity: 2639 },
    ],
    ...overrides,
  };
}

describe("evaluateDepthAnalysis", () => {
  it("detects ask-dominant imbalance from screenshot-like data", () => {
    const result = evaluateDepthAnalysis(makeQuote());

    expect(result.flags.askDominant).toBe(true);
    expect(result.flags.bidDominant).toBe(false);
    expect(result.snapshot.imbalanceRatio).toBeCloseTo(1_920_111 / 3_162_638, 4);
    expect(result.snapshot.spread).toBeCloseTo(0.05, 2);
    expect(result.reasons.some((reason) => reason.includes("Ask-side"))).toBe(true);
  });

  it("detects bid wall near price", () => {
    const result = evaluateDepthAnalysis(
      makeQuote({
        lastPrice: 108.91,
        bids: [{ price: 108.9, orders: 27, quantity: 28144 }],
        asks: [{ price: 108.99, orders: 6, quantity: 1817 }],
      }),
    );

    expect(result.snapshot.strongestBidWall?.quantity).toBe(28144);
    expect(result.flags.bidWallNearPrice).toBe(true);
  });

  it("detects bid-dominant imbalance", () => {
    const result = evaluateDepthAnalysis(
      makeQuote({
        buyQuantity: 4_000_000,
        sellQuantity: 2_000_000,
      }),
    );

    expect(result.flags.bidDominant).toBe(true);
    expect(result.flags.askDominant).toBe(false);
  });
});
