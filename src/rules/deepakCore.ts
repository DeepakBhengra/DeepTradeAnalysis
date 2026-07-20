import type { DeepakDecisionConfig } from "../config.js";
import type {
  Decision,
  DeepakBbMatchType,
  DeepakDecisionResult,
  DeepakExitSignal,
  DeepakScenarioEvent,
  DeepakTradeSignal,
  IndicatorSnapshot,
} from "../types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
} from "../utils/marketTime.js";
import {
  classifyBbBottomMatch,
  classifyBbTopMatch,
} from "./bollingerUtils.js";
import { computeProfitTarget } from "./deepakTarget.js";
import {
  applyMorningConflictResolution,
  evaluateDeepakMorningSignals,
} from "./deepakMorningRules.js";

export interface DeepakStrategyVariant {
  id: string;
  namePrefix: string;
  config: DeepakDecisionConfig;
}

export function createDeepakScenarios(namePrefix: string) {
  return {
    DOWNWARD_1: `${namePrefix} downward direction - 1`,
    SWITCH_UP: `${namePrefix} direction switch - up`,
    STRONG_SWITCH_UP: `${namePrefix} strong direction switch - up`,
    CONTINUE_DOWN_2: `${namePrefix} continue downward direction - 2`,
    CONTINUE_UP_3: `${namePrefix} continue upward direction - 3`,
    CONTINUE_DOWN_4: `${namePrefix} continue downward direction - 4`,
    UPWARD_1: `${namePrefix} upward direction - 1`,
    SWITCH_DOWN: `${namePrefix} direction switch - down`,
    STRONG_SWITCH_DOWN: `${namePrefix} strong direction switch - down`,
    CONTINUE_UP_2: `${namePrefix} continue upward direction - 2`,
    CONTINUE_DOWN_3: `${namePrefix} continue downward direction - 3`,
    CONTINUE_UP_4: `${namePrefix} continue upward direction - 4`,
    MORNING_BUY_SETUP: `${namePrefix} morning buy setup`,
    MORNING_SELL_SETUP: `${namePrefix} morning sell setup`,
    MORNING_BUY: `${namePrefix} morning buy`,
    MORNING_SELL: `${namePrefix} morning sell`,
    DEFERRED_UPPER_RESOLVE_3: `${namePrefix} deferred upper resolve - 3`,
    DEFERRED_LOWER_RESOLVE_3: `${namePrefix} deferred lower resolve - 3`,
    OVERSOLD_SELL_DEFERRAL: `${namePrefix} oversold sell deferral`,
    OVERBOUGHT_BUY_DEFERRAL: `${namePrefix} overbought buy deferral`,
    OVERSOLD_RECOVERY_BUY: `${namePrefix} oversold recovery buy`,
    OVERBOUGHT_RECOVERY_SELL: `${namePrefix} overbought recovery sell`,
  } as const;
}

export type DeepakScenarios = ReturnType<typeof createDeepakScenarios>;

export type TradeScenarioMapEntry = {
  scenarioKey: string;
  side: "BUY" | "SELL";
  scenarioNumber: number;
};

export function buildTradeScenarioMap(scenarios: DeepakScenarios): TradeScenarioMapEntry[] {
  return [
    { scenarioKey: scenarios.STRONG_SWITCH_UP, side: "BUY", scenarioNumber: 1 },
    { scenarioKey: scenarios.CONTINUE_UP_3, side: "BUY", scenarioNumber: 2 },
    { scenarioKey: scenarios.CONTINUE_UP_4, side: "BUY", scenarioNumber: 3 },
    { scenarioKey: scenarios.CONTINUE_UP_2, side: "BUY", scenarioNumber: 4 },
    { scenarioKey: scenarios.STRONG_SWITCH_DOWN, side: "SELL", scenarioNumber: 1 },
    { scenarioKey: scenarios.CONTINUE_DOWN_3, side: "SELL", scenarioNumber: 2 },
    { scenarioKey: scenarios.CONTINUE_DOWN_4, side: "SELL", scenarioNumber: 3 },
    { scenarioKey: scenarios.CONTINUE_DOWN_2, side: "SELL", scenarioNumber: 4 },
    { scenarioKey: scenarios.DEFERRED_UPPER_RESOLVE_3, side: "BUY", scenarioNumber: 6 },
    { scenarioKey: scenarios.DEFERRED_LOWER_RESOLVE_3, side: "SELL", scenarioNumber: 6 },
    { scenarioKey: scenarios.OVERSOLD_RECOVERY_BUY, side: "BUY", scenarioNumber: 7 },
    { scenarioKey: scenarios.OVERBOUGHT_RECOVERY_SELL, side: "SELL", scenarioNumber: 7 },
  ];
}

export function isUsableSnapshot(snapshot: IndicatorSnapshot): boolean {
  return (
    Number.isFinite(snapshot.bollinger.upper) &&
    Number.isFinite(snapshot.bollinger.lower)
  );
}

export function candleMidPrice(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

export function bbLowerMatchType(snapshot: IndicatorSnapshot): DeepakBbMatchType | null {
  return classifyBbBottomMatch(
    snapshot.bollinger.lower,
    snapshot.low,
    snapshot.close,
  );
}

export function bbUpperMatchType(snapshot: IndicatorSnapshot): DeepakBbMatchType | null {
  return classifyBbTopMatch(
    snapshot.bollinger.upper,
    snapshot.high,
    snapshot.close,
  );
}

export function bbLowerActive(snapshot: IndicatorSnapshot): boolean {
  return bbLowerMatchType(snapshot) != null;
}

export function bbUpperActive(snapshot: IndicatorSnapshot): boolean {
  return bbUpperMatchType(snapshot) != null;
}

export function bbLowerOnly(snapshot: IndicatorSnapshot): boolean {
  return bbLowerActive(snapshot) && !bbUpperActive(snapshot);
}

export function bbUpperOnly(snapshot: IndicatorSnapshot): boolean {
  return bbUpperActive(snapshot) && !bbLowerActive(snapshot);
}

export function bbBothActive(snapshot: IndicatorSnapshot): boolean {
  return bbLowerActive(snapshot) && bbUpperActive(snapshot);
}

export function findDualBandDeferralEnd(
  candles: IndicatorSnapshot[],
  minBothCandles: number,
): number | null {
  if (minBothCandles <= 0 || candles.length < minBothCandles) {
    return null;
  }

  let streak = 0;
  for (let index = 0; index < candles.length; index += 1) {
    if (bbBothActive(candles[index])) {
      streak += 1;
      if (streak >= minBothCandles) {
        return index;
      }
    } else {
      streak = 0;
    }
  }

  return null;
}

export function findConsecutiveExclusiveResolveAfter(
  candles: IndicatorSnapshot[],
  afterTimeIst: string,
  runLength: number,
): {
  side: "BUY" | "SELL";
  index: number;
  candle: IndicatorSnapshot;
  matchType: DeepakBbMatchType;
} | null {
  if (runLength <= 0) {
    return null;
  }

  let upperStreak = 0;
  let lowerStreak = 0;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const timeIst = formatIstTime(candle.timestamp);
    if (timeIst <= afterTimeIst) {
      continue;
    }

    if (bbUpperOnly(candle)) {
      upperStreak += 1;
      lowerStreak = 0;
      if (upperStreak >= runLength) {
        return {
          side: "BUY",
          index,
          candle,
          matchType: dominantMatchType(candle, "upper"),
        };
      }
      continue;
    }

    if (bbLowerOnly(candle)) {
      lowerStreak += 1;
      upperStreak = 0;
      if (lowerStreak >= runLength) {
        return {
          side: "SELL",
          index,
          candle,
          matchType: dominantMatchType(candle, "lower"),
        };
      }
      continue;
    }

    upperStreak = 0;
    lowerStreak = 0;
  }

  return null;
}

function isContinueTwoScenario(scenarioKey: string, scenarios: DeepakScenarios): boolean {
  return (
    scenarioKey === scenarios.CONTINUE_UP_2 || scenarioKey === scenarios.CONTINUE_DOWN_2
  );
}

export function applyDualBandDeferral(input: {
  candles: IndicatorSnapshot[];
  scenarios: DeepakScenarios;
  tradeScenarioMap: TradeScenarioMapEntry[];
  variant: DeepakStrategyVariant;
  signals: DeepakTradeSignal[];
  trail: DeepakScenarioEvent[];
}): {
  signals: DeepakTradeSignal[];
  trail: DeepakScenarioEvent[];
  suppressionNotes: string[];
  deferred: boolean;
} {
  const rules = input.variant.config.dualBandDeferral;
  if (
    input.variant.id !== "deepak" ||
    !rules?.enabled ||
    rules.minBothCandles <= 0 ||
    rules.resolveRunLength <= 0
  ) {
    return {
      signals: input.signals,
      trail: input.trail,
      suppressionNotes: [],
      deferred: false,
    };
  }

  const deferralEnd = findDualBandDeferralEnd(input.candles, rules.minBothCandles);
  if (deferralEnd == null) {
    return {
      signals: input.signals,
      trail: input.trail,
      suppressionNotes: [],
      deferred: false,
    };
  }

  const deferralCandle = input.candles[deferralEnd];
  const trail = input.trail.filter(
    (event) => !isContinueTwoScenario(event.scenarioKey, input.scenarios),
  );
  addScenarioEvent(
    trail,
    `${input.variant.namePrefix} dual-band deferral`,
    deferralCandle,
    dominantMatchType(deferralCandle, "both"),
  );

  const signals = input.signals.filter(
    (signal) => !isContinueTwoScenario(signal.scenarioKey, input.scenarios),
  );
  const suppressionNotes = [
    `Dual-band deferral: suppressed continue-2 early BUY/SELL after ${rules.minBothCandles}+ consecutive both-band candles; resolve after ${rules.majorityAfterTimeIst} IST with ${rules.resolveRunLength} consecutive exclusive-band candles.`,
  ];

  const resolve = findConsecutiveExclusiveResolveAfter(
    input.candles,
    rules.majorityAfterTimeIst,
    rules.resolveRunLength,
  );

  if (resolve) {
    const scenarioKey =
      resolve.side === "BUY"
        ? input.scenarios.DEFERRED_UPPER_RESOLVE_3
        : input.scenarios.DEFERRED_LOWER_RESOLVE_3;
    addScenarioEvent(trail, scenarioKey, resolve.candle, resolve.matchType);
    const signal = createTradeSignal(
      scenarioKey,
      resolve.candle,
      resolve.matchType,
      input.tradeScenarioMap,
      input.variant,
    );
    if (signal) {
      signals.push(signal);
    }
  }

  return {
    signals,
    trail,
    suppressionNotes,
    deferred: true,
  };
}

function findCandleIndexByTimeIst(
  candles: IndicatorSnapshot[],
  timeIst: string,
): number {
  return candles.findIndex((candle) => formatIstTime(candle.timestamp) === timeIst);
}

export function findRsiExtremeRecoveryTip(
  candles: IndicatorSnapshot[],
  startAfterIndex: number,
  direction: "buy" | "sell",
  runLength: number,
  tipDeadlineIst: string,
  rsiBound: number,
): { index: number; candle: IndicatorSnapshot } | null {
  if (runLength <= 0 || startAfterIndex < -1) {
    return null;
  }

  let streak = 0;
  for (let index = startAfterIndex + 1; index < candles.length; index += 1) {
    const candle = candles[index]!;
    const timeIst = formatIstTime(candle.timestamp);
    if (timeIst > tipDeadlineIst) {
      break;
    }

    const previous = candles[index - 1];
    if (!previous || !Number.isFinite(candle.rsi) || !Number.isFinite(previous.rsi)) {
      streak = 0;
      continue;
    }

    const priceOk =
      direction === "buy" ? candle.close > previous.close : candle.close < previous.close;
    const rsiOk =
      direction === "buy" ? candle.rsi > previous.rsi : candle.rsi < previous.rsi;
    const boundOk =
      direction === "buy" ? candle.rsi >= rsiBound : candle.rsi <= rsiBound;

    if (priceOk && rsiOk && boundOk) {
      streak += 1;
      if (streak >= runLength) {
        return { index, candle };
      }
    } else {
      streak = 0;
    }
  }

  return null;
}

export function applyRsiExtremeContinueDeferral(input: {
  candles: IndicatorSnapshot[];
  scenarios: DeepakScenarios;
  tradeScenarioMap: TradeScenarioMapEntry[];
  variant: DeepakStrategyVariant;
  signals: DeepakTradeSignal[];
  trail: DeepakScenarioEvent[];
}): {
  signals: DeepakTradeSignal[];
  trail: DeepakScenarioEvent[];
  suppressionNotes: string[];
} {
  const rules = input.variant.config.rsiExtremeContinueDefer;
  if (input.variant.id !== "deepak" || !rules?.enabled || rules.recoverRunLength <= 0) {
    return {
      signals: input.signals,
      trail: input.trail,
      suppressionNotes: [],
    };
  }

  let signals = [...input.signals];
  let trail = [...input.trail];
  const suppressionNotes: string[] = [];

  const continueDown = signals.find(
    (signal) => signal.scenarioKey === input.scenarios.CONTINUE_DOWN_2,
  );
  if (continueDown) {
    const entryIndex = findCandleIndexByTimeIst(input.candles, continueDown.timeIst);
    const entryCandle = entryIndex >= 0 ? input.candles[entryIndex] : null;
    if (
      entryCandle &&
      Number.isFinite(entryCandle.rsi) &&
      entryCandle.rsi <= rules.maxRsiAtSellDefer
    ) {
      signals = signals.filter(
        (signal) => signal.scenarioKey !== input.scenarios.CONTINUE_DOWN_2,
      );
      trail = trail.filter(
        (event) => event.scenarioKey !== input.scenarios.CONTINUE_DOWN_2,
      );
      addScenarioEvent(
        trail,
        input.scenarios.OVERSOLD_SELL_DEFERRAL,
        entryCandle,
        dominantMatchType(entryCandle, "lower"),
      );
      suppressionNotes.push(
        `Oversold continue-2 deferral: suppressed SELL at ${continueDown.timeIst} IST (RSI ${entryCandle.rsi.toFixed(1)} ≤ ${rules.maxRsiAtSellDefer}); looking for rising recovery BUY by ${rules.tipDeadlineIst} IST.`,
      );

      const tip = findRsiExtremeRecoveryTip(
        input.candles,
        entryIndex,
        "buy",
        rules.recoverRunLength,
        rules.tipDeadlineIst,
        rules.minRsiOnBuyRecover,
      );
      if (tip) {
        addScenarioEvent(
          trail,
          input.scenarios.OVERSOLD_RECOVERY_BUY,
          tip.candle,
          dominantMatchType(tip.candle, "both"),
        );
        const signal = createTradeSignal(
          input.scenarios.OVERSOLD_RECOVERY_BUY,
          tip.candle,
          dominantMatchType(tip.candle, "both"),
          input.tradeScenarioMap,
          input.variant,
        );
        if (signal) {
          signals.push(signal);
        }
      }
    }
  }

  const continueUp = signals.find(
    (signal) => signal.scenarioKey === input.scenarios.CONTINUE_UP_2,
  );
  if (continueUp) {
    const entryIndex = findCandleIndexByTimeIst(input.candles, continueUp.timeIst);
    const entryCandle = entryIndex >= 0 ? input.candles[entryIndex] : null;
    if (
      entryCandle &&
      Number.isFinite(entryCandle.rsi) &&
      entryCandle.rsi >= rules.minRsiAtBuyDefer
    ) {
      signals = signals.filter(
        (signal) => signal.scenarioKey !== input.scenarios.CONTINUE_UP_2,
      );
      trail = trail.filter(
        (event) => event.scenarioKey !== input.scenarios.CONTINUE_UP_2,
      );
      addScenarioEvent(
        trail,
        input.scenarios.OVERBOUGHT_BUY_DEFERRAL,
        entryCandle,
        dominantMatchType(entryCandle, "upper"),
      );
      suppressionNotes.push(
        `Overbought continue-2 deferral: suppressed BUY at ${continueUp.timeIst} IST (RSI ${entryCandle.rsi.toFixed(1)} ≥ ${rules.minRsiAtBuyDefer}); looking for falling recovery SELL by ${rules.tipDeadlineIst} IST.`,
      );

      const tip = findRsiExtremeRecoveryTip(
        input.candles,
        entryIndex,
        "sell",
        rules.recoverRunLength,
        rules.tipDeadlineIst,
        rules.maxRsiOnSellRecover,
      );
      if (tip) {
        addScenarioEvent(
          trail,
          input.scenarios.OVERBOUGHT_RECOVERY_SELL,
          tip.candle,
          dominantMatchType(tip.candle, "both"),
        );
        const signal = createTradeSignal(
          input.scenarios.OVERBOUGHT_RECOVERY_SELL,
          tip.candle,
          dominantMatchType(tip.candle, "both"),
          input.tradeScenarioMap,
          input.variant,
        );
        if (signal) {
          signals.push(signal);
        }
      }
    }
  }

  return { signals, trail, suppressionNotes };
}

export function dominantMatchType(
  snapshot: IndicatorSnapshot,
  mode: "upper" | "lower" | "both",
): DeepakBbMatchType {
  if (mode === "upper") {
    return bbUpperMatchType(snapshot) ?? "close";
  }
  if (mode === "lower") {
    return bbLowerMatchType(snapshot) ?? "close";
  }
  const upper = bbUpperMatchType(snapshot);
  const lower = bbLowerMatchType(snapshot);
  if (upper === "crossed" || lower === "crossed") {
    return "crossed";
  }
  return "close";
}

export function filterSessionCandlesForVariant(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  variant: DeepakStrategyVariant,
): IndicatorSnapshot[] {
  const { sessionStart, sessionEnd } = variant.config;
  return snapshots.filter((snapshot) => {
    if (!isUsableSnapshot(snapshot)) {
      return false;
    }
    const ist = getIstTimeParts(snapshot.timestamp);
    return (
      ist.dateKey === dateKey &&
      isWithinIstSessionWindow(snapshot.timestamp, sessionStart, sessionEnd)
    );
  });
}

export function isSessionOpenCandle(
  snapshot: IndicatorSnapshot,
  variant: DeepakStrategyVariant,
): boolean {
  const ist = getIstTimeParts(snapshot.timestamp);
  const { sessionStart } = variant.config;
  const [hour, minute] = sessionStart.split(":").map(Number);
  return ist.hour === hour && ist.minute === minute;
}

export function detectInitialRun(
  candles: IndicatorSnapshot[],
  predicate: (snapshot: IndicatorSnapshot) => boolean,
  variant: DeepakStrategyVariant,
): { anchorIndex: number; anchorCandle: IndicatorSnapshot; anchorCandles: IndicatorSnapshot[] } | null {
  const { initialRunSize } = variant.config;
  if (candles.length < initialRunSize) {
    return null;
  }

  const first = candles[0];
  if (!isSessionOpenCandle(first, variant) || !predicate(first)) {
    return null;
  }

  for (let i = 1; i < initialRunSize; i++) {
    if (!predicate(candles[i])) {
      return null;
    }
  }

  return {
    anchorIndex: initialRunSize - 1,
    anchorCandle: candles[initialRunSize - 1],
    anchorCandles: candles.slice(0, initialRunSize),
  };
}

export function findFirstMatchingCandle(
  candles: IndicatorSnapshot[],
  startIndex: number,
  predicate: (snapshot: IndicatorSnapshot) => boolean,
): { index: number; candle: IndicatorSnapshot } | null {
  for (let i = startIndex + 1; i < candles.length; i++) {
    if (predicate(candles[i])) {
      return { index: i, candle: candles[i] };
    }
  }
  return null;
}

export function addScenarioEvent(
  trail: DeepakScenarioEvent[],
  scenarioKey: string,
  candle: IndicatorSnapshot,
  bbMatchType?: DeepakBbMatchType,
): void {
  trail.push({
    scenarioKey,
    timeIst: formatIstTime(candle.timestamp),
    bbMatchType,
  });
}

export function createTradeSignal(
  scenarioKey: string,
  candle: IndicatorSnapshot,
  bbMatchType: DeepakBbMatchType,
  tradeScenarioMap: TradeScenarioMapEntry[],
  variant: DeepakStrategyVariant,
): DeepakTradeSignal | null {
  const mapping = tradeScenarioMap.find((entry) => entry.scenarioKey === scenarioKey);
  if (!mapping) {
    return null;
  }

  return {
    side: mapping.side,
    scenarioKey,
    scenarioNumber: mapping.scenarioNumber,
    timeIst: formatIstTime(candle.timestamp),
    price: candleMidPrice(candle),
    bbMatchType,
    profitTarget: variant.config.profitTarget,
    exit: null,
  };
}

export function simulateExit(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryCandle: IndicatorSnapshot,
  side: "BUY" | "SELL",
  entryPrice: number,
  profitTarget: number,
  variant: DeepakStrategyVariant,
): DeepakExitSignal | null {
  const { sessionStart, sessionEnd } = variant.config;
  const targetPrice =
    side === "BUY" ? entryPrice + profitTarget : entryPrice - profitTarget;
  const entryTime = entryCandle.timestamp.getTime();

  const sessionCandles = snapshots.filter((snapshot) => {
    if (!isUsableSnapshot(snapshot)) {
      return false;
    }
    const ist = getIstTimeParts(snapshot.timestamp);
    return (
      ist.dateKey === dateKey &&
      isWithinIstSessionWindow(snapshot.timestamp, sessionStart, sessionEnd) &&
      snapshot.timestamp.getTime() > entryTime
    );
  });

  for (const candle of sessionCandles) {
    const exitMid = candleMidPrice(candle);
    const hit =
      side === "BUY" ? exitMid >= targetPrice : exitMid <= targetPrice;
    if (hit) {
      const profit =
        side === "BUY" ? exitMid - entryPrice : entryPrice - exitMid;
      return {
        timeIst: formatIstTime(candle.timestamp),
        price: exitMid,
        targetHit: true,
        profit,
        profitTarget,
      };
    }
  }

  return null;
}

export function attachExits(
  signals: DeepakTradeSignal[],
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  candleByTime: Map<string, IndicatorSnapshot>,
  variant: DeepakStrategyVariant,
): void {
  for (const signal of signals) {
    const entryCandle = candleByTime.get(signal.timeIst);
    if (!entryCandle) {
      continue;
    }
    const profitTarget = computeProfitTarget(entryCandle, snapshots, variant.config);
    signal.profitTarget = profitTarget;
    signal.exit = simulateExit(
      snapshots,
      dateKey,
      entryCandle,
      signal.side,
      signal.price,
      profitTarget,
      variant,
    );
  }
}

export function runBearishPath(
  candles: IndicatorSnapshot[],
  scenarios: DeepakScenarios,
  tradeScenarioMap: TradeScenarioMapEntry[],
  variant: DeepakStrategyVariant,
): {
  trail: DeepakScenarioEvent[];
  signals: DeepakTradeSignal[];
  bearishAnchor: ReturnType<typeof detectInitialRun>;
} {
  const trail: DeepakScenarioEvent[] = [];
  const signals: DeepakTradeSignal[] = [];

  const downward1 = detectInitialRun(candles, bbLowerActive, variant);
  if (!downward1) {
    return { trail, signals, bearishAnchor: null };
  }

  addScenarioEvent(
    trail,
    scenarios.DOWNWARD_1,
    downward1.anchorCandle,
    dominantMatchType(downward1.anchorCandle, "lower"),
  );

  const switchUp = findFirstMatchingCandle(
    candles,
    downward1.anchorIndex,
    bbBothActive,
  );
  const continueDown2 = findFirstMatchingCandle(
    candles,
    downward1.anchorIndex,
    bbLowerOnly,
  );

  const switchUpIndex = switchUp?.index ?? Infinity;
  const continueDown2Index = continueDown2?.index ?? Infinity;

  if (switchUp && switchUpIndex < continueDown2Index) {
    addScenarioEvent(
      trail,
      scenarios.SWITCH_UP,
      switchUp.candle,
      dominantMatchType(switchUp.candle, "both"),
    );

    const upperOnly = findFirstMatchingCandle(
      candles,
      switchUp.index,
      bbUpperOnly,
    );
    if (upperOnly) {
      const matchType = dominantMatchType(upperOnly.candle, "upper");
      addScenarioEvent(trail, scenarios.STRONG_SWITCH_UP, upperOnly.candle, matchType);
      addScenarioEvent(trail, scenarios.CONTINUE_UP_3, upperOnly.candle, matchType);

      const strongSignal = createTradeSignal(
        scenarios.STRONG_SWITCH_UP,
        upperOnly.candle,
        matchType,
        tradeScenarioMap,
        variant,
      );
      const continueSignal = createTradeSignal(
        scenarios.CONTINUE_UP_3,
        upperOnly.candle,
        matchType,
        tradeScenarioMap,
        variant,
      );
      if (strongSignal) signals.push(strongSignal);
      if (continueSignal) signals.push(continueSignal);
    }

    const continueDown4 = findFirstMatchingCandle(
      candles,
      switchUp.index,
      bbLowerOnly,
    );
    if (continueDown4) {
      const matchType = dominantMatchType(continueDown4.candle, "lower");
      addScenarioEvent(
        trail,
        scenarios.CONTINUE_DOWN_4,
        continueDown4.candle,
        matchType,
      );
      const sellSignal = createTradeSignal(
        scenarios.CONTINUE_DOWN_4,
        continueDown4.candle,
        matchType,
        tradeScenarioMap,
        variant,
      );
      if (sellSignal) signals.push(sellSignal);
    }
  } else if (continueDown2) {
    const matchType = dominantMatchType(continueDown2.candle, "lower");
    addScenarioEvent(
      trail,
      scenarios.CONTINUE_DOWN_2,
      continueDown2.candle,
      matchType,
    );
    const sellSignal = createTradeSignal(
      scenarios.CONTINUE_DOWN_2,
      continueDown2.candle,
      matchType,
      tradeScenarioMap,
      variant,
    );
    if (sellSignal) signals.push(sellSignal);
  }

  return { trail, signals, bearishAnchor: downward1 };
}

export function runBullishPath(
  candles: IndicatorSnapshot[],
  scenarios: DeepakScenarios,
  tradeScenarioMap: TradeScenarioMapEntry[],
  variant: DeepakStrategyVariant,
): {
  trail: DeepakScenarioEvent[];
  signals: DeepakTradeSignal[];
  bullishAnchor: ReturnType<typeof detectInitialRun>;
} {
  const trail: DeepakScenarioEvent[] = [];
  const signals: DeepakTradeSignal[] = [];

  const upward1 = detectInitialRun(candles, bbUpperActive, variant);
  if (!upward1) {
    return { trail, signals, bullishAnchor: null };
  }

  addScenarioEvent(
    trail,
    scenarios.UPWARD_1,
    upward1.anchorCandle,
    dominantMatchType(upward1.anchorCandle, "upper"),
  );

  const switchDown = findFirstMatchingCandle(
    candles,
    upward1.anchorIndex,
    bbBothActive,
  );
  const continueUp2 = findFirstMatchingCandle(
    candles,
    upward1.anchorIndex,
    bbUpperOnly,
  );

  const switchDownIndex = switchDown?.index ?? Infinity;
  const continueUp2Index = continueUp2?.index ?? Infinity;

  if (switchDown && switchDownIndex < continueUp2Index) {
    addScenarioEvent(
      trail,
      scenarios.SWITCH_DOWN,
      switchDown.candle,
      dominantMatchType(switchDown.candle, "both"),
    );

    const lowerOnly = findFirstMatchingCandle(
      candles,
      switchDown.index,
      bbLowerOnly,
    );
    if (lowerOnly) {
      const matchType = dominantMatchType(lowerOnly.candle, "lower");
      addScenarioEvent(
        trail,
        scenarios.STRONG_SWITCH_DOWN,
        lowerOnly.candle,
        matchType,
      );
      addScenarioEvent(
        trail,
        scenarios.CONTINUE_DOWN_3,
        lowerOnly.candle,
        matchType,
      );

      const strongSignal = createTradeSignal(
        scenarios.STRONG_SWITCH_DOWN,
        lowerOnly.candle,
        matchType,
        tradeScenarioMap,
        variant,
      );
      const continueSignal = createTradeSignal(
        scenarios.CONTINUE_DOWN_3,
        lowerOnly.candle,
        matchType,
        tradeScenarioMap,
        variant,
      );
      if (strongSignal) signals.push(strongSignal);
      if (continueSignal) signals.push(continueSignal);
    }

    const continueUp4 = findFirstMatchingCandle(
      candles,
      switchDown.index,
      bbUpperOnly,
    );
    if (continueUp4) {
      const matchType = dominantMatchType(continueUp4.candle, "upper");
      addScenarioEvent(
        trail,
        scenarios.CONTINUE_UP_4,
        continueUp4.candle,
        matchType,
      );
      const buySignal = createTradeSignal(
        scenarios.CONTINUE_UP_4,
        continueUp4.candle,
        matchType,
        tradeScenarioMap,
        variant,
      );
      if (buySignal) signals.push(buySignal);
    }
  } else if (continueUp2) {
    const matchType = dominantMatchType(continueUp2.candle, "upper");
    addScenarioEvent(
      trail,
      scenarios.CONTINUE_UP_2,
      continueUp2.candle,
      matchType,
    );
    const buySignal = createTradeSignal(
      scenarios.CONTINUE_UP_2,
      continueUp2.candle,
      matchType,
      tradeScenarioMap,
      variant,
    );
    if (buySignal) signals.push(buySignal);
  }

  return { trail, signals, bullishAnchor: upward1 };
}

export function buildReasons(
  trail: DeepakScenarioEvent[],
  signals: DeepakTradeSignal[],
): string[] {
  const reasons: string[] = [];

  for (const event of trail) {
    const matchLabel = event.bbMatchType === "crossed" ? "crossed" : "close to";
    reasons.push(`${event.scenarioKey} at ${event.timeIst} IST (BB ${matchLabel})`);
  }

  for (const signal of signals) {
    const exitLabel = signal.exit?.targetHit
      ? `exit ${signal.exit.timeIst} IST @ ${signal.exit.price.toFixed(2)} (+${signal.exit.profit?.toFixed(2)}, target ${signal.profitTarget.toFixed(2)})`
      : "exit pending";
    reasons.push(
      `${signal.side} scenario ${signal.scenarioNumber}: ${signal.scenarioKey} @ ${signal.timeIst} IST mid ${signal.price.toFixed(2)} · ${exitLabel}`,
    );
  }

  return reasons;
}

export function resolveDecision(signals: DeepakTradeSignal[]): Decision {
  const unexited = signals.filter((signal) => !signal.exit?.targetHit);
  if (unexited.length === 0) {
    return "HOLD";
  }
  return unexited[unexited.length - 1].side;
}

export function analyzeDayWithVariant(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  variant: DeepakStrategyVariant,
): DeepakDecisionResult | null {
  const scenarios = createDeepakScenarios(variant.namePrefix);
  const tradeScenarioMap = buildTradeScenarioMap(scenarios);
  const candles = filterSessionCandlesForVariant(snapshots, dateKey, variant);
  if (candles.length === 0) {
    return null;
  }

  const bearish = runBearishPath(candles, scenarios, tradeScenarioMap, variant);
  const bullish = runBullishPath(candles, scenarios, tradeScenarioMap, variant);

  const legacyTrail = [...bearish.trail, ...bullish.trail];
  const legacySignals = [...bearish.signals, ...bullish.signals];

  const deferredResult = applyDualBandDeferral({
    candles,
    scenarios,
    tradeScenarioMap,
    variant,
    signals: legacySignals,
    trail: legacyTrail,
  });

  const rsiExtremeResult = applyRsiExtremeContinueDeferral({
    candles,
    scenarios,
    tradeScenarioMap,
    variant,
    signals: deferredResult.signals,
    trail: deferredResult.trail,
  });

  let morningTrail: DeepakScenarioEvent[] = [];
  let morningSignals: DeepakTradeSignal[] = [];
  let suppressionNotes: string[] = [
    ...deferredResult.suppressionNotes,
    ...rsiExtremeResult.suppressionNotes,
  ];

  if (variant.id === "deepak" && variant.config.morningRules?.enabled) {
    const morning = evaluateDeepakMorningSignals(candles, scenarios, variant);
    morningTrail = morning.trail;
    morningSignals = morning.signals;
    suppressionNotes = [...suppressionNotes, ...morning.suppressionNotes];
  }

  const conflictResolution = applyMorningConflictResolution(
    rsiExtremeResult.signals,
    morningSignals,
  );
  suppressionNotes = [...suppressionNotes, ...conflictResolution.suppressionNotes];

  const scenarioTrail = [...rsiExtremeResult.trail, ...morningTrail].sort(
    (left, right) => left.timeIst.localeCompare(right.timeIst),
  );
  const signals = conflictResolution.signals;

  const candleByTime = new Map(
    candles.map((candle) => [formatIstTime(candle.timestamp), candle]),
  );
  attachExits(signals, snapshots, dateKey, candleByTime, variant);

  const activeScenario =
    scenarioTrail.length > 0
      ? scenarioTrail[scenarioTrail.length - 1].scenarioKey
      : null;

  const snapshot = candles[candles.length - 1];
  const reasons = [
    ...buildReasons(scenarioTrail, signals),
    ...suppressionNotes,
  ];

  return {
    dateKey,
    decision: signals.length > 0 ? resolveDecision(signals) : "HOLD",
    activeScenario,
    scenarioTrail,
    signals,
    reasons,
    snapshot,
  };
}

export function resolveDateKey(
  snapshots: IndicatorSnapshot[],
  dateKey?: string,
): string | undefined {
  return (
    dateKey ??
    (snapshots.length > 0
      ? getIstTimeParts(snapshots[snapshots.length - 1].timestamp).dateKey
      : undefined)
  );
}
