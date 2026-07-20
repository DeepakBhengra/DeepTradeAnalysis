import type { DeepakMorningRulesConfig } from "../config.js";
import type {
  DeepakBbMatchType,
  DeepakScenarioEvent,
  DeepakTradeSignal,
  IndicatorSnapshot,
} from "../types.js";
import {
  formatIstTime,
  getIstTimeParts,
  parseHmToMinutes,
} from "../utils/marketTime.js";
import {
  bbLowerActive,
  bbLowerMatchType,
  bbUpperActive,
  bbUpperMatchType,
  candleMidPrice,
  dominantMatchType,
  type DeepakScenarios,
  type DeepakStrategyVariant,
} from "./deepakCore.js";

export interface DeepakMorningEvaluation {
  trail: DeepakScenarioEvent[];
  signals: DeepakTradeSignal[];
  suppressionNotes: string[];
}

const SETUP_CANDLE_COUNT = 5;

function findCandleAtTime(
  candles: IndicatorSnapshot[],
  timeIst: string,
): IndicatorSnapshot | null {
  return candles.find((candle) => formatIstTime(candle.timestamp) === timeIst) ?? null;
}

export function getSetupWindowCandles(
  candles: IndicatorSnapshot[],
  setupWindowStart: string,
  setupWindowEnd: string,
): IndicatorSnapshot[] {
  const startMinutes = parseHmToMinutes(setupWindowStart);
  const endMinutes = parseHmToMinutes(setupWindowEnd);

  return candles
    .filter((candle) => {
      const { minutesOfDay } = getIstTimeParts(candle.timestamp);
      return minutesOfDay >= startMinutes && minutesOfDay <= endMinutes;
    })
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
}

function countIncreasingPairs(values: number[]): number {
  let count = 0;
  for (let index = 1; index < values.length; index++) {
    if (values[index] > values[index - 1]) {
      count++;
    }
  }
  return count;
}

function hasMajorityIncreasing(values: number[], majorityMinPairs: number): boolean {
  if (values.length < 2) {
    return false;
  }
  return countIncreasingPairs(values) >= majorityMinPairs;
}

function isGreenCandle(snapshot: IndicatorSnapshot): boolean {
  return snapshot.close > snapshot.open;
}

function isRedCandle(snapshot: IndicatorSnapshot): boolean {
  return snapshot.close < snapshot.open;
}

function holdsSupportAfterOpeningPierce(window: IndicatorSnapshot[]): boolean {
  const openingLow = window[0].low;
  return window.slice(1).every((candle) => candle.low >= openingLow);
}

function holdsResistanceAfterOpeningPierce(window: IndicatorSnapshot[]): boolean {
  const openingHigh = window[0].high;
  return window.slice(1).every((candle) => candle.high <= openingHigh);
}

function peakValue(values: number[]): number {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length > 0 ? Math.max(...finite) : NaN;
}

function hasLastPairsDecreasing(values: number[], pairCount: number): boolean {
  if (values.length < pairCount + 1) {
    return false;
  }
  const startIndex = values.length - pairCount - 1;
  for (let index = startIndex + 1; index < values.length; index++) {
    if (values[index] >= values[index - 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Lower-Band Support Recovery (LBSR) buy setup for 09:15–10:15 IST.
 */
export function passesBuySetupChecks(
  window: IndicatorSnapshot[],
  rules: DeepakMorningRulesConfig,
): boolean {
  if (window.length < SETUP_CANDLE_COUNT) {
    return false;
  }

  const setup = window.slice(0, SETUP_CANDLE_COUNT);

  if (!setup.every((candle) => bbLowerActive(candle))) {
    return false;
  }

  if (bbLowerMatchType(setup[0]) !== "crossed") {
    return false;
  }

  if (!holdsSupportAfterOpeningPierce(setup)) {
    return false;
  }

  const firstRsi = setup[0].rsi;
  const lastRsi = setup[setup.length - 1].rsi;
  if (!Number.isFinite(firstRsi) || firstRsi > rules.buyRsiStartMax) {
    return false;
  }
  if (!Number.isFinite(lastRsi) || lastRsi <= firstRsi || lastRsi >= rules.buyRsiEndMax) {
    return false;
  }

  const rsiValues = setup.map((candle) => candle.rsi);
  if (!hasMajorityIncreasing(rsiValues, rules.majorityMinPairs)) {
    return false;
  }

  if (!setup.every((candle) => candle.close < candle.bollinger.middle)) {
    return false;
  }

  const lastTwo = setup.slice(-2);
  return lastTwo.every((candle) => isGreenCandle(candle));
}

/**
 * Upper-Band Resistance Rejection (UBRR) sell setup for 09:15–10:15 IST.
 */
export function passesSellSetupChecks(
  window: IndicatorSnapshot[],
  rules: DeepakMorningRulesConfig,
): boolean {
  if (window.length < SETUP_CANDLE_COUNT) {
    return false;
  }

  const setup = window.slice(0, SETUP_CANDLE_COUNT);

  if (!setup.every((candle) => bbUpperActive(candle))) {
    return false;
  }

  if (bbUpperMatchType(setup[0]) !== "crossed") {
    return false;
  }

  if (!holdsResistanceAfterOpeningPierce(setup)) {
    return false;
  }

  if (!setup.every((candle) => candle.close > candle.bollinger.middle)) {
    return false;
  }

  const firstRsi = setup[0].rsi;
  const lastRsi = setup[setup.length - 1].rsi;
  const peakRsi = peakValue(setup.map((candle) => candle.rsi));

  if (!Number.isFinite(firstRsi) || firstRsi < rules.sellRsiStartMin) {
    return false;
  }
  if (!Number.isFinite(peakRsi) || peakRsi < rules.sellRsiPeakMin) {
    return false;
  }
  if (
    !Number.isFinite(lastRsi) ||
    lastRsi >= peakRsi ||
    lastRsi < rules.sellRsiEndMin
  ) {
    return false;
  }

  const rsiValues = setup.map((candle) => candle.rsi);
  if (!hasLastPairsDecreasing(rsiValues, 1)) {
    return false;
  }

  return isRedCandle(setup[setup.length - 1]);
}

export function shouldEnterMorningBuy(
  initialSetupPass: boolean,
  entryCandle: IndicatorSnapshot,
  _setupWindow: IndicatorSnapshot[],
  _rules: DeepakMorningRulesConfig,
): boolean {
  if (!initialSetupPass) {
    return false;
  }

  if (!isGreenCandle(entryCandle)) {
    return false;
  }

  return entryCandle.close > entryCandle.bollinger.middle;
}

export function shouldEnterMorningSell(
  initialSetupPass: boolean,
  entryCandle: IndicatorSnapshot,
  _setupWindow: IndicatorSnapshot[],
  _rules: DeepakMorningRulesConfig,
): boolean {
  if (!initialSetupPass) {
    return false;
  }

  if (!isRedCandle(entryCandle)) {
    return false;
  }

  return entryCandle.close < entryCandle.bollinger.middle;
}

function createMorningSignal(
  side: "BUY" | "SELL",
  scenarioKey: string,
  entryCandle: IndicatorSnapshot,
  variant: DeepakStrategyVariant,
): DeepakTradeSignal {
  const bbMatchType: DeepakBbMatchType =
    side === "BUY"
      ? bbLowerMatchType(entryCandle) ?? bbUpperMatchType(entryCandle) ?? "close"
      : bbUpperMatchType(entryCandle) ?? bbLowerMatchType(entryCandle) ?? "close";

  return {
    side,
    scenarioKey,
    scenarioNumber: 5,
    timeIst: formatIstTime(entryCandle.timestamp),
    price: candleMidPrice(entryCandle),
    bbMatchType,
    profitTarget: variant.config.profitTarget,
    exit: null,
  };
}

export function applyMorningConflictResolution(
  legacySignals: DeepakTradeSignal[],
  morningSignals: DeepakTradeSignal[],
): { signals: DeepakTradeSignal[]; suppressionNotes: string[] } {
  const hasMorningBuy = morningSignals.some((signal) => signal.side === "BUY");
  const hasMorningSell = morningSignals.some((signal) => signal.side === "SELL");
  const suppressionNotes: string[] = [];

  const filteredLegacy = legacySignals.filter((signal) => {
    if (hasMorningBuy && signal.side === "SELL") {
      suppressionNotes.push(
        `legacy SELL suppressed (${signal.scenarioKey} @ ${signal.timeIst}) — morning BUY qualified`,
      );
      return false;
    }
    if (hasMorningSell && signal.side === "BUY") {
      suppressionNotes.push(
        `legacy BUY suppressed (${signal.scenarioKey} @ ${signal.timeIst}) — morning SELL qualified`,
      );
      return false;
    }
    return true;
  });

  const signals = [...filteredLegacy, ...morningSignals].sort((left, right) =>
    left.timeIst.localeCompare(right.timeIst),
  );

  return { signals, suppressionNotes };
}

export function evaluateDeepakMorningSignals(
  candles: IndicatorSnapshot[],
  scenarios: DeepakScenarios,
  variant: DeepakStrategyVariant,
): DeepakMorningEvaluation {
  const rules = variant.config.morningRules;
  const trail: DeepakScenarioEvent[] = [];
  const signals: DeepakTradeSignal[] = [];
  const suppressionNotes: string[] = [];

  if (!rules?.enabled) {
    return { trail, signals, suppressionNotes };
  }

  const setupWindow = getSetupWindowCandles(
    candles,
    rules.setupWindowStart,
    rules.setupWindowEnd,
  );
  const entryCandle = findCandleAtTime(candles, rules.entryTimeIst);

  if (setupWindow.length === 0 || !entryCandle) {
    return { trail, signals, suppressionNotes };
  }

  const buySetupPass = passesBuySetupChecks(setupWindow, rules);
  const sellSetupPass = passesSellSetupChecks(setupWindow, rules);

  if (buySetupPass) {
    trail.push({
      scenarioKey: scenarios.MORNING_BUY_SETUP,
      timeIst: rules.setupWindowEnd,
    });
  }

  if (sellSetupPass) {
    trail.push({
      scenarioKey: scenarios.MORNING_SELL_SETUP,
      timeIst: rules.setupWindowEnd,
    });
  }

  if (shouldEnterMorningBuy(buySetupPass, entryCandle, setupWindow, rules)) {
    trail.push({
      scenarioKey: scenarios.MORNING_BUY,
      timeIst: formatIstTime(entryCandle.timestamp),
      bbMatchType: dominantMatchType(entryCandle, "both"),
    });
    signals.push(
      createMorningSignal("BUY", scenarios.MORNING_BUY, entryCandle, variant),
    );
  }

  if (shouldEnterMorningSell(sellSetupPass, entryCandle, setupWindow, rules)) {
    trail.push({
      scenarioKey: scenarios.MORNING_SELL,
      timeIst: formatIstTime(entryCandle.timestamp),
      bbMatchType: dominantMatchType(entryCandle, "both"),
    });
    signals.push(
      createMorningSignal("SELL", scenarios.MORNING_SELL, entryCandle, variant),
    );
  }

  return { trail, signals, suppressionNotes };
}
