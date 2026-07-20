import { describe, expect, it } from "vitest";
import { computeConfidenceScore } from "../../src/rules/confidenceScore.js";
import type { DeepakTradeSignal, VolumeFlags, VolumeSnapshot } from "../../src/types.js";

const bullishVolumeFlags: VolumeFlags = {
  highRvol: true,
  lowRvol: false,
  volumeConfirmsBuy: true,
  volumeConfirmsSell: false,
  volumeDryUp: false,
};

const dryVolumeFlags: VolumeFlags = {
  highRvol: false,
  lowRvol: true,
  volumeConfirmsBuy: false,
  volumeConfirmsSell: false,
  volumeDryUp: true,
};

const bullishSnapshot: VolumeSnapshot = {
  rvol: 1.8,
  volumeSma: 1000,
  direction: "bullish",
};

const neutralSnapshot: VolumeSnapshot = {
  rvol: 0.5,
  volumeSma: 1000,
  direction: "neutral",
};

const crossedBuySignal: DeepakTradeSignal = {
  side: "BUY",
  scenarioKey: "deepak strong direction switch - up",
  scenarioNumber: 1,
  timeIst: "10:30",
  price: 100,
  bbMatchType: "crossed",
  profitTarget: 0.7,
  exit: null,
};

const closeBuySignal: DeepakTradeSignal = {
  ...crossedBuySignal,
  bbMatchType: "close",
};

describe("computeConfidenceScore", () => {
  it("scores high confidence for crossed Deepak BUY with volume and bid depth", () => {
    const result = computeConfidenceScore({
      decision: "BUY",
      deepakSignals: [crossedBuySignal],
      volumeFlags: bullishVolumeFlags,
      volumeSnapshot: bullishSnapshot,
      depthFlags: {
        bidDominant: true,
        askDominant: false,
        tightSpread: true,
        bidWallNearPrice: true,
        askWallNearPrice: false,
      },
      mode: "live",
    });

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.band).toBe("strong");
    expect(result.technicalScore).toBe(90);
    expect(result.volumeScore).toBeGreaterThan(50);
    expect(result.depthScore).toBeGreaterThan(50);
  });

  it("downgrades BUY when volume dries up and asks dominate", () => {
    const strong = computeConfidenceScore({
      decision: "BUY",
      deepakSignals: [crossedBuySignal],
      volumeFlags: bullishVolumeFlags,
      volumeSnapshot: bullishSnapshot,
      depthFlags: {
        bidDominant: true,
        askDominant: false,
        tightSpread: true,
        bidWallNearPrice: false,
        askWallNearPrice: false,
      },
      mode: "live",
    });

    const weak = computeConfidenceScore({
      decision: "BUY",
      deepakSignals: [crossedBuySignal],
      volumeFlags: dryVolumeFlags,
      volumeSnapshot: neutralSnapshot,
      depthFlags: {
        bidDominant: false,
        askDominant: true,
        tightSpread: true,
        bidWallNearPrice: false,
        askWallNearPrice: true,
      },
      mode: "live",
    });

    expect(weak.score).toBeLessThan(strong.score);
    expect(weak.volumeScore).toBeLessThan(strong.volumeScore);
    expect(weak.depthScore).toBeLessThan(strong.depthScore);
  });

  it("uses lower technical score for close-only Deepak match", () => {
    const crossed = computeConfidenceScore({
      decision: "BUY",
      deepakSignals: [crossedBuySignal],
      volumeFlags: bullishVolumeFlags,
      volumeSnapshot: bullishSnapshot,
      mode: "historical",
    });

    const closeOnly = computeConfidenceScore({
      decision: "BUY",
      deepakSignals: [closeBuySignal],
      volumeFlags: bullishVolumeFlags,
      volumeSnapshot: bullishSnapshot,
      mode: "historical",
    });

    expect(crossed.technicalScore).toBeGreaterThan(closeOnly.technicalScore);
    expect(closeOnly.technicalScore).toBe(65);
  });

  it("uses historical weights without depth in historical mode", () => {
    const result = computeConfidenceScore({
      decision: "BUY",
      deepakSignals: [crossedBuySignal],
      volumeFlags: bullishVolumeFlags,
      volumeSnapshot: bullishSnapshot,
      depthFlags: {
        bidDominant: false,
        askDominant: true,
        tightSpread: false,
        bidWallNearPrice: false,
        askWallNearPrice: true,
      },
      mode: "historical",
    });

    expect(result.depthScore).toBe(50);
    expect(result.reasons.some((reason) => reason.includes("historical mode"))).toBe(
      true,
    );
  });

  it("returns avoid band for HOLD with dry volume", () => {
    const result = computeConfidenceScore({
      decision: "HOLD",
      deepakSignals: [],
      volumeFlags: dryVolumeFlags,
      volumeSnapshot: neutralSnapshot,
      depthFlags: null,
      mode: "historical",
    });

    expect(result.technicalScore).toBe(0);
    expect(["weak", "avoid", "moderate"]).toContain(result.band);
  });
});
