import { config } from "../config.js";
import { buildVolumeSnapshots } from "../indicators/volume.js";
import type { Candle, VolumeFlags, VolumeSnapshot } from "../types.js";

export interface VolumeAnalysisResult {
  flags: VolumeFlags;
  snapshot: VolumeSnapshot;
  reasons: string[];
}

function buildVolumeReasons(flags: VolumeFlags, snapshot: VolumeSnapshot): string[] {
  const reasons: string[] = [];

  if (flags.highRvol) {
    reasons.push(`Relative volume elevated (${snapshot.rvol.toFixed(2)}x avg)`);
  }
  if (flags.lowRvol) {
    reasons.push(`Relative volume below average (${snapshot.rvol.toFixed(2)}x avg)`);
  }
  if (flags.volumeConfirmsBuy) {
    reasons.push("Volume confirms bullish participation");
  }
  if (flags.volumeConfirmsSell) {
    reasons.push("Volume confirms bearish participation");
  }
  if (flags.volumeDryUp) {
    reasons.push("Volume drying up — weak participation");
  }
  if (snapshot.direction === "bullish") {
    reasons.push("Recent volume skews bullish");
  } else if (snapshot.direction === "bearish") {
    reasons.push("Recent volume skews bearish");
  }

  return reasons;
}

export function evaluateVolumeAnalysis(candles: Candle[]): VolumeAnalysisResult | null {
  if (candles.length < config.volume.smaPeriod) {
    return null;
  }

  const snapshots = buildVolumeSnapshots(candles);
  const latest = candles[candles.length - 1];
  const snapshot = snapshots[snapshots.length - 1];

  if (!Number.isFinite(snapshot.rvol)) {
    return null;
  }

  const isBullishCandle = latest.close > latest.open;
  const isBearishCandle = latest.close < latest.open;

  const flags: VolumeFlags = {
    highRvol: snapshot.rvol >= config.volume.spikeThreshold,
    lowRvol: snapshot.rvol < 1,
    volumeConfirmsBuy: snapshot.rvol >= config.volume.spikeThreshold && isBullishCandle,
    volumeConfirmsSell: snapshot.rvol >= config.volume.spikeThreshold && isBearishCandle,
    volumeDryUp: snapshot.rvol <= config.volume.dryUpThreshold,
  };

  return {
    flags,
    snapshot,
    reasons: buildVolumeReasons(flags, snapshot),
  };
}
