import { config } from "../config.js";
import type { BbProximityMatch, BbProximityReport, IndicatorSnapshot } from "../types.js";
import { formatIstTime, isWithinAnalysisDayDisplay } from "../utils/marketTime.js";
import {
  bbMatchGapPct,
  classifyBbBottomMatch,
  classifyBbTopMatch,
  sessionPriceExtremes,
} from "./bollingerUtils.js";

function isUsableSnapshot(snapshot: IndicatorSnapshot): boolean {
  return (
    Number.isFinite(snapshot.bollinger.upper) &&
    Number.isFinite(snapshot.bollinger.lower)
  );
}

function buildMatch(
  snapshot: IndicatorSnapshot,
  kind: "top" | "bottom",
  matchType: "crossed" | "close",
  isSessionExtreme: boolean,
): BbProximityMatch {
  const timeIst = formatIstTime(snapshot.timestamp);
  const isTop = kind === "top";
  const price = isTop ? snapshot.high : snapshot.low;
  const bbLevel = isTop ? snapshot.bollinger.upper : snapshot.bollinger.lower;
  const gapPct = bbMatchGapPct(
    matchType,
    kind,
    bbLevel,
    price,
    snapshot.close,
  );

  return {
    timeIst,
    intervalLabel: `15m candle ${timeIst} IST`,
    price,
    bbLevel,
    gapPct,
    matchType,
    isSessionExtreme,
    candleColor: snapshot.close >= snapshot.open ? "green" : "red",
    high: snapshot.high,
    low: snapshot.low,
    bbUpper: snapshot.bollinger.upper,
    bbLower: snapshot.bollinger.lower,
  };
}

export function scanBbProximity(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): BbProximityReport | null {
  const daySnapshots = snapshots.filter(
    (snapshot) =>
      isUsableSnapshot(snapshot) &&
      isWithinAnalysisDayDisplay(snapshot.timestamp, dateKey),
  );

  if (daySnapshots.length === 0) {
    return null;
  }

  const { sessionHigh, sessionLow } = sessionPriceExtremes(daySnapshots);
  const thresholdPct = config.thresholds.bbClosePctThreshold;

  const topMatches: BbProximityMatch[] = [];
  const bottomMatches: BbProximityMatch[] = [];

  for (const snapshot of daySnapshots) {
    const { upper, lower } = snapshot.bollinger;

    const topMatchType = classifyBbTopMatch(upper, snapshot.high, snapshot.close);
    if (topMatchType) {
      topMatches.push(
        buildMatch(snapshot, "top", topMatchType, snapshot.high === sessionHigh),
      );
    }

    const bottomMatchType = classifyBbBottomMatch(
      lower,
      snapshot.low,
      snapshot.close,
    );
    if (bottomMatchType) {
      bottomMatches.push(
        buildMatch(
          snapshot,
          "bottom",
          bottomMatchType,
          snapshot.low === sessionLow,
        ),
      );
    }
  }

  return {
    dateKey,
    thresholdPct,
    topMatches,
    bottomMatches,
  };
}

export function buildBbProximityReasons(report: BbProximityReport | null): string[] {
  if (!report) {
    return [];
  }

  const reasons: string[] = [];

  for (const match of report.topMatches) {
    const colorLabel = match.candleColor === "green" ? "GREEN" : "RED";
    if (match.matchType === "crossed") {
      reasons.push(
        `${colorLabel} candle · BB upper crossed at ${match.timeIst} IST (high ${match.high.toFixed(2)}, BB upper ${match.bbUpper.toFixed(2)}, above band by ${match.gapPct.toFixed(3)}%)`,
      );
    } else {
      reasons.push(
        `${colorLabel} candle · BB upper close to candle high at ${match.timeIst} IST (high ${match.high.toFixed(2)}, BB upper ${match.bbUpper.toFixed(2)}, gap ${match.gapPct.toFixed(3)}%)`,
      );
    }
  }

  for (const match of report.bottomMatches) {
    const colorLabel = match.candleColor === "green" ? "GREEN" : "RED";
    if (match.matchType === "crossed") {
      reasons.push(
        `${colorLabel} candle · BB lower crossed at ${match.timeIst} IST (low ${match.low.toFixed(2)}, BB lower ${match.bbLower.toFixed(2)}, below band by ${match.gapPct.toFixed(3)}%)`,
      );
    } else {
      reasons.push(
        `${colorLabel} candle · BB lower close to candle low at ${match.timeIst} IST (low ${match.low.toFixed(2)}, BB lower ${match.bbLower.toFixed(2)}, gap ${match.gapPct.toFixed(3)}%)`,
      );
    }
  }

  return reasons;
}
