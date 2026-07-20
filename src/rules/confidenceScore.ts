import { config } from "../config.js";
import type {
  ConfidenceBand,
  ConfidenceResult,
  Decision,
  DeepakTradeSignal,
  DepthFlags,
  VolumeFlags,
  VolumeSnapshot,
} from "../types.js";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function resolveBand(score: number): ConfidenceBand {
  if (score >= config.confidence.strongMin) {
    return "strong";
  }
  if (score >= config.confidence.moderateMin) {
    return "moderate";
  }
  if (score >= config.confidence.weakMin) {
    return "weak";
  }
  return "avoid";
}

function latestSignal(
  signals: DeepakTradeSignal[] | undefined,
): DeepakTradeSignal | undefined {
  if (!signals || signals.length === 0) {
    return undefined;
  }
  return signals[signals.length - 1];
}

function computeTechnicalScore(
  decision: Decision,
  signals: DeepakTradeSignal[] | undefined,
): number {
  if (decision === "HOLD") {
    return 0;
  }

  const signal = latestSignal(signals);
  if (!signal) {
    return 40;
  }

  if (signal.bbMatchType === "crossed") {
    return 90;
  }
  return 65;
}

function computeVolumeScore(
  decision: Decision,
  volumeFlags: VolumeFlags,
  snapshot: VolumeSnapshot,
): number {
  let score = 50;

  if (decision === "BUY") {
    if (volumeFlags.volumeConfirmsBuy) score += 30;
    if (volumeFlags.highRvol) score += 10;
    if (snapshot.direction === "bullish") score += 10;
    if (volumeFlags.volumeConfirmsSell) score -= 25;
    if (volumeFlags.volumeDryUp) score -= 20;
    if (snapshot.direction === "bearish") score -= 10;
  } else if (decision === "SELL") {
    if (volumeFlags.volumeConfirmsSell) score += 30;
    if (volumeFlags.highRvol) score += 10;
    if (snapshot.direction === "bearish") score += 10;
    if (volumeFlags.volumeConfirmsBuy) score -= 25;
    if (volumeFlags.volumeDryUp) score -= 20;
    if (snapshot.direction === "bullish") score -= 10;
  } else {
    if (volumeFlags.volumeDryUp) score += 15;
    if (snapshot.direction === "neutral") score += 10;
    if (volumeFlags.highRvol) score -= 10;
  }

  return clampScore(score);
}

function computeDepthScore(decision: Decision, depthFlags: DepthFlags | null): number {
  if (!depthFlags) {
    return 50;
  }

  let score = 50;

  if (decision === "BUY") {
    if (depthFlags.bidDominant) score += 25;
    if (depthFlags.bidWallNearPrice) score += 15;
    if (depthFlags.tightSpread) score += 5;
    if (depthFlags.askDominant) score -= 25;
    if (depthFlags.askWallNearPrice) score -= 15;
  } else if (decision === "SELL") {
    if (depthFlags.askDominant) score += 25;
    if (depthFlags.askWallNearPrice) score += 15;
    if (depthFlags.tightSpread) score += 5;
    if (depthFlags.bidDominant) score -= 25;
    if (depthFlags.bidWallNearPrice) score -= 15;
  } else {
    if (depthFlags.tightSpread) score += 10;
    if (depthFlags.bidDominant && depthFlags.askDominant) {
      score += 5;
    }
  }

  return clampScore(score);
}

function buildConfidenceReasons(
  band: ConfidenceBand,
  technicalScore: number,
  volumeScore: number,
  depthScore: number,
  hasDepth: boolean,
): string[] {
  const reasons = [
    `Deepak scenario alignment: ${technicalScore}%`,
    `Volume confirmation: ${volumeScore}%`,
  ];

  if (hasDepth) {
    reasons.push(`Order book depth: ${depthScore}%`);
  } else {
    reasons.push("Order book depth unavailable (historical mode)");
  }

  const bandLabel: Record<ConfidenceBand, string> = {
    strong: "Strong conviction — act on signal",
    moderate: "Moderate conviction — signal valid but mixed volume/depth",
    weak: "Weak conviction — technical setup with conflicting volume",
    avoid: "Low conviction — conflicting or insufficient evidence",
  };

  reasons.push(bandLabel[band]);
  return reasons;
}

export function computeConfidenceScore(input: {
  decision: Decision;
  deepakSignals?: DeepakTradeSignal[];
  volumeFlags: VolumeFlags;
  volumeSnapshot: VolumeSnapshot;
  depthFlags?: DepthFlags | null;
  mode: "live" | "historical";
}): ConfidenceResult {
  const technicalScore = computeTechnicalScore(input.decision, input.deepakSignals);
  const volumeScore = computeVolumeScore(
    input.decision,
    input.volumeFlags,
    input.volumeSnapshot,
  );
  const hasDepth = input.mode === "live" && input.depthFlags != null;
  const depthScore = computeDepthScore(
    input.decision,
    hasDepth ? (input.depthFlags ?? null) : null,
  );

  const technicalWeight = hasDepth
    ? config.confidence.technicalWeight
    : config.confidence.historicalTechnicalWeight;
  const volumeWeight = hasDepth
    ? config.confidence.volumeWeight
    : config.confidence.historicalVolumeWeight;
  const depthWeight = hasDepth ? config.confidence.depthWeight : 0;

  const score = clampScore(
    technicalScore * technicalWeight +
      volumeScore * volumeWeight +
      depthScore * depthWeight,
  );
  const band = resolveBand(score);

  return {
    score,
    band,
    technicalScore,
    volumeScore,
    depthScore,
    reasons: buildConfidenceReasons(
      band,
      technicalScore,
      volumeScore,
      depthScore,
      hasDepth,
    ),
  };
}
