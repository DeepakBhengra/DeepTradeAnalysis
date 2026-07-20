import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { config } from "../src/config.js";
import { isBbNearPrice, pctDistance } from "../src/rules/bollingerUtils.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinAnalysisDayDisplay,
} from "../src/utils/marketTime.js";

const analysisDate = process.argv[2] ?? "2026-06-18";
const threshold = config.thresholds.bbClosePctThreshold;

async function main(): Promise<void> {
  const candles = await fetchPnbCandles({ analysisDate });
  const snapshots = buildIndicatorSnapshots(candles);

  const daySnapshots = snapshots.filter((snapshot) =>
    isWithinAnalysisDayDisplay(snapshot.timestamp, analysisDate),
  );

  if (daySnapshots.length === 0) {
    console.log(`No candles found for ${analysisDate} (IST 09:15–15:30).`);
    return;
  }

  console.log(`PNB 15m — ${analysisDate} (IST)`);
  console.log(`Threshold: low within ${threshold}% of BB lower band\n`);

  const matches: Array<{
    time: string;
    low: number;
    bbLower: number;
    close: number;
    gapPct: number;
  }> = [];

  for (const snapshot of daySnapshots) {
    const { lower } = snapshot.bollinger;
    if (!Number.isFinite(lower)) {
      continue;
    }

    const gapPct = pctDistance(snapshot.low, lower, snapshot.close);
    const near = isBbNearPrice(lower, snapshot.low, snapshot.close);

    if (near) {
      matches.push({
        time: formatIstTime(snapshot.timestamp),
        low: snapshot.low,
        bbLower: lower,
        close: snapshot.close,
        gapPct,
      });
    }
  }

  if (matches.length === 0) {
    console.log("No candles had low within threshold of BB bottom.\n");
    console.log("Closest candles (low vs BB lower):");
    const ranked = daySnapshots
      .filter((s) => Number.isFinite(s.bollinger.lower))
      .map((s) => ({
        time: formatIstTime(s.timestamp),
        low: s.low,
        bbLower: s.bollinger.lower,
        gapPct: pctDistance(s.low, s.bollinger.lower, s.close),
      }))
      .sort((a, b) => a.gapPct - b.gapPct)
      .slice(0, 5);

    for (const row of ranked) {
      console.log(
        `  ${row.time} IST — low ${row.low.toFixed(2)}, BB bottom ${row.bbLower.toFixed(2)}, gap ${row.gapPct.toFixed(3)}%`,
      );
    }
    return;
  }

  console.log(`Found ${matches.length} candle(s) with low close to BB bottom:\n`);
  for (const row of matches) {
    console.log(
      `  ${row.time} IST — low ${row.low.toFixed(2)}, BB bottom ${row.bbLower.toFixed(2)}, close ${row.close.toFixed(2)}, gap ${row.gapPct.toFixed(3)}%`,
    );
  }

  const sessionLow = Math.min(...daySnapshots.map((s) => s.low));
  const sessionLowCandle = daySnapshots.find((s) => s.low === sessionLow);
  if (sessionLowCandle) {
    console.log(
      `\nSession lowest low: ${sessionLow.toFixed(2)} at ${formatIstTime(sessionLowCandle.timestamp)} IST`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
