import "../src/loadEnv.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { candleMidPrice, evaluateDeepakDecision } from "../src/rules/deepakDecision.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";

const DATE = process.argv[2] ?? "2026-05-11";
const CUTOFF = process.argv[3] ?? "13:15";

function parseHm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

const cutoffMinutes = parseHm(CUTOFF);

const candles = await fetchPnbCandles({
  symbol: "NSE:PNB",
  exchange: "NSE",
  segment: "NSE",
  range: "3mo",
});

const snapshots = buildIndicatorSnapshots(candles);
const result = evaluateDeepakDecision(snapshots, DATE);
const sell4 = result?.signals.find((s) => s.scenarioNumber === 4 && s.side === "SELL");

if (!sell4) {
  console.log(`No SELL scenario 4 on ${DATE}`);
  process.exit(0);
}

const entryTime = sell4.timeIst;
const needMid = sell4.price - sell4.profitTarget;

console.log(`Date: ${DATE}`);
console.log(`Entry: ${entryTime} IST @ mid ${sell4.price.toFixed(2)} (${sell4.bbMatchType})`);
console.log(`Profit target: ${sell4.profitTarget.toFixed(2)}`);
console.log(`SELL exit needs candle mid <= ${needMid.toFixed(2)}`);
console.log(`\n15m candles after entry through ${CUTOFF} IST:\n`);

const dayCandles = snapshots.filter((s) => getIstTimeParts(s.timestamp).dateKey === DATE);

let lowestMid = Number.POSITIVE_INFINITY;
let lowestMidTime = "";

for (const candle of dayCandles) {
  const timeIst = formatIstTime(candle.timestamp);
  if (timeIst <= entryTime) {
    continue;
  }
  const [h, m] = timeIst.split(":").map(Number);
  const minutes = h * 60 + m;
  if (minutes > cutoffMinutes) {
    break;
  }

  const mid = candleMidPrice(candle);
  if (mid < lowestMid) {
    lowestMid = mid;
    lowestMidTime = timeIst;
  }

  const hit = mid <= needMid;
  console.log(
    `${timeIst}  H ${candle.high.toFixed(2)}  L ${candle.low.toFixed(2)}  mid ${mid.toFixed(2)}  gap ${(mid - needMid).toFixed(2)}${hit ? "  HIT" : ""}`,
  );
}

console.log(`\nLowest mid before ${CUTOFF}: ${lowestMid.toFixed(2)} at ${lowestMidTime}`);
console.log(`Shortfall vs target: ${(lowestMid - needMid).toFixed(2)} pts`);
