import { config } from "../config.js";
import { computeStochasticMomentum } from "../indicators/stochasticMomentum.js";
import type {
  DeepakBbMatchType,
  DeepakDecisionResult,
  DeepakTradeSignal,
  DeepproBbProximity,
  IndicatorSnapshot,
  RuleSunpharmaScanResult,
  RuleSunpharmaScenarioKey,
  RuleSunpharmaSignal,
} from "../types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
  parseHmToMinutes,
} from "../utils/marketTime.js";
import {
  bbMatchGapPct,
  classifyBbBottomMatch,
  classifyBbTopMatch,
  pctDistance,
} from "./bollingerUtils.js";
import {
  evaluateOverboughtBuyCascade,
  evaluateOverboughtSellGuards,
  evaluateOversoldBuyGuards,
  evaluateOversoldSellCascade,
  findNextSameDayIndex,
  type CascadeGuardResult,
} from "./oversoldCascade.js";

/** Normalize NSE:SUNPHARMA / sunpharma → SUNPHARMA for the exclusive-symbol guard. */
export function normalizeRuleSunpharmaTradingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/^NSE:/, "");
}

/** True only for the exclusive RuleSUNPHARMA symbol (SUNPHARMA). */
export function isRuleSunpharmaSymbol(symbol: string | null | undefined): boolean {
  if (!symbol) {
    return false;
  }
  return (
    normalizeRuleSunpharmaTradingSymbol(symbol) ===
    config.ruleSunpharma.tradingSymbol
  );
}

/** Throws when a caller tries to run RuleSUNPHARMA on a non-SUNPHARMA symbol. */
export function assertRuleSunpharmaSymbol(symbol: string): void {
  if (!isRuleSunpharmaSymbol(symbol)) {
    throw new Error(
      `RuleSUNPHARMA is SUNPHARMA-only and cannot run on ${normalizeRuleSunpharmaTradingSymbol(symbol) || "(empty)"}. Use trading symbol SUNPHARMA.`,
    );
  }
}

const SCENARIO_NUMBER: Record<RuleSunpharmaScenarioKey, number> = {
  buy_quality: 1,
  sell_quality: 1,
  buy_extended: 2,
  sell_cascade: 2,
  buy_cascade: 3,
};

const SCENARIO_LABEL: Record<RuleSunpharmaScenarioKey, string> = {
  buy_quality: "ruleSunpharma buy quality",
  sell_quality: "ruleSunpharma sell quality",
  buy_extended: "ruleSunpharma buy extended",
  sell_cascade: "ruleSunpharma sell cascade",
  buy_cascade: "ruleSunpharma buy cascade",
};

function buildBbUpperProximity(snapshot: IndicatorSnapshot): DeepproBbProximity {
  const matchType = classifyBbTopMatch(
    snapshot.bollinger.upper,
    snapshot.high,
    snapshot.close,
  );
  const gapPct = matchType
    ? bbMatchGapPct(
        matchType,
        "top",
        snapshot.bollinger.upper,
        snapshot.high,
        snapshot.close,
      )
    : pctDistance(snapshot.bollinger.upper, snapshot.high, snapshot.close);
  const signedGapPct =
    ((snapshot.high - snapshot.bollinger.upper) / snapshot.close) * 100;

  return {
    gapPct,
    signedGapPct,
    matchType,
    price: snapshot.high,
    bbLevel: snapshot.bollinger.upper,
  };
}

function buildBbLowerProximity(snapshot: IndicatorSnapshot): DeepproBbProximity {
  const matchType = classifyBbBottomMatch(
    snapshot.bollinger.lower,
    snapshot.low,
    snapshot.close,
  );
  const gapPct = matchType
    ? bbMatchGapPct(
        matchType,
        "bottom",
        snapshot.bollinger.lower,
        snapshot.low,
        snapshot.close,
      )
    : pctDistance(snapshot.bollinger.lower, snapshot.low, snapshot.close);
  const signedGapPct =
    ((snapshot.bollinger.lower - snapshot.low) / snapshot.close) * 100;

  return {
    gapPct,
    signedGapPct,
    matchType,
    price: snapshot.low,
    bbLevel: snapshot.bollinger.lower,
  };
}

function isUsableSnapshot(snapshot: IndicatorSnapshot): boolean {
  return (
    Number.isFinite(snapshot.bollinger.upper) &&
    Number.isFinite(snapshot.bollinger.lower) &&
    Number.isFinite(snapshot.rsi)
  );
}

function isBeforeEntryDeadline(timeIst: string, deadlineIst: string): boolean {
  return parseHmToMinutes(timeIst) < parseHmToMinutes(deadlineIst);
}

function nearLowerBand(
  proximity: DeepproBbProximity,
  maxGapPct: number,
): boolean {
  return proximity.matchType != null || proximity.gapPct <= maxGapPct;
}

function nearUpperBand(
  proximity: DeepproBbProximity,
  maxGapPct: number,
): boolean {
  return proximity.matchType != null || proximity.gapPct <= maxGapPct;
}

function entryMid(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

function matchesBuyQuality(
  rsi: number,
  smi: number,
  bbLower: DeepproBbProximity,
): boolean {
  const { buyQuality } = config.ruleSunpharma;
  if (rsi < buyQuality.minRsi || rsi > buyQuality.maxRsi) {
    return false;
  }
  if (smi > buyQuality.maxSmi) {
    return false;
  }
  return nearLowerBand(bbLower, buyQuality.maxBbLowerGapPct);
}

function matchesSellQuality(
  rsi: number,
  smi: number,
  bbUpper: DeepproBbProximity,
): boolean {
  const { sellQuality } = config.ruleSunpharma;
  if (rsi < sellQuality.minRsi || rsi > sellQuality.maxRsi) {
    return false;
  }
  if (smi < sellQuality.minSmi) {
    return false;
  }
  return nearUpperBand(bbUpper, sellQuality.maxBbUpperGapPct);
}

function matchesBuyExtended(
  smi: number,
  bbLower: DeepproBbProximity,
): boolean {
  const { buyExtended } = config.ruleSunpharma;
  if (buyExtended.requireNegativeSmi && !(smi < 0)) {
    return false;
  }
  if (smi > buyExtended.maxSmi) {
    return false;
  }
  return nearLowerBand(bbLower, buyExtended.maxBbLowerGapPct);
}

/**
 * RuleSUNPHARMA — SUNPHARMA-only favourable profit-range indicator gates (60d study).
 * Completely separate from Deepak / Deepak-2 / Deeppro / RulePNB — call sites must
 * guard with `isRuleSunpharmaSymbol` / `assertRuleSunpharmaSymbol` so other stocks
 * never enter this path.
 *
 * 1. BUY quality (1.7%–0.9% band): RSI ~33–56, SMI ≤ −40, near BB lower
 *    (gap ≤ ~0.5%, frequently crossed/close)
 * 2. SELL quality (0.8%–0.4% / mid): RSI ~56–72, SMI ≥ 40, tight BB upper
 *    (gap ≤ ~0.3%)
 * 3. BUY extended (3%–1.8% movers): less oversold than mid bucket; mid-zone SMI
 *    OK (not overbought); still near BB lower (tight gap ≤ 0.5%)
 *
 * Entry price = candle mid (high+low)/2. Event candle before entry deadline
 * (default before 14:00 IST). One earliest BUY and one earliest SELL per day;
 * BUY prefers quality over extended.
 */
export function evaluateRuleSunpharmaDay(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): RuleSunpharmaScanResult {
  const {
    sessionStart,
    sessionEnd,
    entryDeadlineIst,
    smi: smiConfig,
  } = config.ruleSunpharma;

  const dayIndexes: number[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    if (!isUsableSnapshot(snapshot)) {
      continue;
    }
    if (!isWithinIstSessionWindow(snapshot.timestamp, sessionStart, sessionEnd)) {
      continue;
    }
    const parts = getIstTimeParts(snapshot.timestamp);
    if (parts.dateKey !== dateKey) {
      continue;
    }
    dayIndexes.push(i);
  }

  const highs = snapshots.map((snapshot) => snapshot.high);
  const lows = snapshots.map((snapshot) => snapshot.low);
  const closes = snapshots.map((snapshot) => snapshot.close);
  const smiSeries = computeStochasticMomentum(
    highs,
    lows,
    closes,
    smiConfig.lengthK,
    smiConfig.lengthD,
    smiConfig.lengthEma,
  );

  let buyQuality: RuleSunpharmaSignal | null = null;
  let buyExtended: RuleSunpharmaSignal | null = null;
  let buyCascade: RuleSunpharmaSignal | null = null;
  let sellSignal: RuleSunpharmaSignal | null = null;

  const dayOpenMid =
    dayIndexes.length > 0 ? entryMid(snapshots[dayIndexes[0]]) : null;

  for (const index of dayIndexes) {
    const snapshot = snapshots[index];
    const smiPoint = smiSeries[index];
    if (!smiPoint || !Number.isFinite(smiPoint.smi)) {
      continue;
    }

    const timeIst = formatIstTime(snapshot.timestamp);
    if (!isBeforeEntryDeadline(timeIst, entryDeadlineIst)) {
      continue;
    }

    const smi = smiPoint.smi;
    const rsi = snapshot.rsi;
    const bbUpper = buildBbUpperProximity(snapshot);
    const bbLower = buildBbLowerProximity(snapshot);
    const price = entryMid(snapshot);

    const prevIndex = index > 0 ? index - 1 : null;
    const prevSmi =
      prevIndex != null && smiSeries[prevIndex]
        ? smiSeries[prevIndex].smi
        : null;
    const prevMacdHist =
      prevIndex != null ? snapshots[prevIndex].macd.histogram : null;
    const nextIndex = findNextSameDayIndex(dayIndexes, index);
    const nextMid = nextIndex != null ? entryMid(snapshots[nextIndex]) : null;
    const cascadeCtx = {
      smi,
      prevSmi: prevSmi != null && Number.isFinite(prevSmi) ? prevSmi : null,
      macdHist: snapshot.macd.histogram,
      prevMacdHist:
        prevMacdHist != null && Number.isFinite(prevMacdHist)
          ? prevMacdHist
          : null,
      setupMid: price,
      dayOpenMid,
      nextMid,
    };
    const buyGuardResult = evaluateOversoldBuyGuards(
      config.ruleSunpharma.buyGuards,
      cascadeCtx,
    );
    const sellGuardResult = evaluateOverboughtSellGuards(
      config.ruleSunpharma.sellGuards,
      cascadeCtx,
    );

    const emitFromConfirm = (
      side: "BUY" | "SELL",
      scenarioKey: RuleSunpharmaScenarioKey,
      baseReasons: string[],
      confirmResult: CascadeGuardResult,
      notePrefix: "guards" | "cascade",
    ): RuleSunpharmaSignal => {
      const useConfirm =
        confirmResult.confirmedOnNextBar && nextIndex != null;
      const emitSnapshot = useConfirm ? snapshots[nextIndex] : snapshot;
      const emitSmiPoint = useConfirm ? smiSeries[nextIndex] : smiPoint;
      const emitSmi =
        emitSmiPoint && Number.isFinite(emitSmiPoint.smi)
          ? emitSmiPoint.smi
          : smi;
      const notes =
        confirmResult.reasons.length > 0
          ? ` | ${notePrefix}: ${confirmResult.reasons.join("; ")}`
          : "";
      const setupNote = useConfirm ? ` (setup ${timeIst})` : "";
      return {
        side,
        rule: "ruleSunpharma",
        dateKey,
        timeIst: formatIstTime(emitSnapshot.timestamp),
        scenarioKey,
        price: entryMid(emitSnapshot),
        smi: emitSmi,
        rsi: emitSnapshot.rsi,
        bbUpperProximity: buildBbUpperProximity(emitSnapshot),
        bbLowerProximity: buildBbLowerProximity(emitSnapshot),
        reasons: baseReasons.map((r) => `${r}${setupNote}${notes}`),
      };
    };

    if (!buyQuality && matchesBuyQuality(rsi, smi, bbLower) && buyGuardResult.ok) {
      buyQuality = emitFromConfirm(
        "BUY",
        "buy_quality",
        [
          `RuleSUNPHARMA BUY quality: RSI ${rsi.toFixed(1)} in ${config.ruleSunpharma.buyQuality.minRsi}–${config.ruleSunpharma.buyQuality.maxRsi}, SMI ${smi.toFixed(1)} ≤ ${config.ruleSunpharma.buyQuality.maxSmi}, BB lower gap ${bbLower.gapPct.toFixed(2)}%${bbLower.matchType ? ` (${bbLower.matchType})` : ""}`,
        ],
        buyGuardResult,
        "guards",
      );
    } else if (
      !buyQuality &&
      !buyExtended &&
      matchesBuyExtended(smi, bbLower) &&
      buyGuardResult.ok
    ) {
      buyExtended = emitFromConfirm(
        "BUY",
        "buy_extended",
        [
          `RuleSUNPHARMA BUY extended (biggest-mover style): less oversold — SMI ${smi.toFixed(1)} mid-zone (≤ ${config.ruleSunpharma.buyExtended.maxSmi}), BB lower gap ${bbLower.gapPct.toFixed(2)}% (≤ ${config.ruleSunpharma.buyExtended.maxBbLowerGapPct}%), RSI ${rsi.toFixed(1)}`,
        ],
        buyGuardResult,
        "guards",
      );
    } else if (
      !buyQuality &&
      !buyExtended &&
      !buyCascade &&
      config.ruleSunpharma.buyCascade?.enabled &&
      matchesSellQuality(rsi, smi, bbUpper)
    ) {
      const cascadeResult = evaluateOverboughtBuyCascade(
        config.ruleSunpharma.buyCascade,
        cascadeCtx,
      );
      if (cascadeResult.ok) {
        buyCascade = emitFromConfirm(
          "BUY",
          "buy_cascade",
          [
            `RuleSUNPHARMA BUY cascade (rising-knife): overbought levels RSI ${rsi.toFixed(1)} / SMI ${smi.toFixed(1)} near BB upper, momentum still rising — long on confirm`,
          ],
          cascadeResult,
          "cascade",
        );
      }
    }

    if (
      !sellSignal &&
      matchesSellQuality(rsi, smi, bbUpper) &&
      sellGuardResult.ok
    ) {
      sellSignal = emitFromConfirm(
        "SELL",
        "sell_quality",
        [
          `RuleSUNPHARMA SELL quality: RSI ${rsi.toFixed(1)} in ${config.ruleSunpharma.sellQuality.minRsi}–${config.ruleSunpharma.sellQuality.maxRsi}, SMI ${smi.toFixed(1)} ≥ ${config.ruleSunpharma.sellQuality.minSmi}, BB upper gap ${bbUpper.gapPct.toFixed(2)}%${bbUpper.matchType ? ` (${bbUpper.matchType})` : ""}`,
        ],
        sellGuardResult,
        "guards",
      );
    } else if (
      !sellSignal &&
      config.ruleSunpharma.sellCascade?.enabled &&
      matchesBuyQuality(rsi, smi, bbLower)
    ) {
      const cascadeResult = evaluateOversoldSellCascade(
        config.ruleSunpharma.sellCascade,
        cascadeCtx,
      );
      if (cascadeResult.ok) {
        sellSignal = emitFromConfirm(
          "SELL",
          "sell_cascade",
          [
            `RuleSUNPHARMA SELL cascade (falling-knife): oversold levels RSI ${rsi.toFixed(1)} / SMI ${smi.toFixed(1)} near BB lower, momentum still falling — short on confirm`,
          ],
          cascadeResult,
          "cascade",
        );
      }
    }

    const buyFound = buyQuality != null || buyExtended != null || buyCascade != null;
    if (buyFound && sellSignal) {
      break;
    }
  }

  const buySignal = buyQuality ?? buyExtended ?? buyCascade;

  const signals = [buySignal, sellSignal]
    .filter((signal): signal is RuleSunpharmaSignal => signal != null)
    .sort((left, right) => left.timeIst.localeCompare(right.timeIst));

  return {
    dateKey,
    rule: "ruleSunpharma",
    sessionStart,
    sessionEnd,
    signals,
  };
}

/** Map a RuleSUNPHARMA signal into the shared day-scan trade-signal shape. */
export function ruleSunpharmaSignalToTradeSignal(
  signal: RuleSunpharmaSignal,
): DeepakTradeSignal {
  const proximity =
    signal.side === "SELL" ? signal.bbUpperProximity : signal.bbLowerProximity;
  const bbMatchType: DeepakBbMatchType = proximity.matchType ?? "close";

  return {
    side: signal.side,
    scenarioKey: SCENARIO_LABEL[signal.scenarioKey],
    scenarioNumber: SCENARIO_NUMBER[signal.scenarioKey],
    timeIst: signal.timeIst,
    price: signal.price,
    bbMatchType,
    profitTarget: 0,
    exit: null,
  };
}

/** Adapt RuleSUNPHARMA day signals into the Deepak decision shape used by dashboard/post-mortem. */
export function evaluateRuleSunpharmaDecision(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): DeepakDecisionResult | null {
  const day = evaluateRuleSunpharmaDay(snapshots, dateKey);
  if (day.signals.length === 0) {
    return null;
  }

  const tradeSignals = day.signals.map(ruleSunpharmaSignalToTradeSignal);
  const lastSignal = tradeSignals[tradeSignals.length - 1];
  const lastSnapshot =
    snapshots.find((snapshot) => {
      const parts = getIstTimeParts(snapshot.timestamp);
      return parts.dateKey === dateKey && formatIstTime(snapshot.timestamp) === lastSignal.timeIst;
    }) ??
    [...snapshots].reverse().find((snapshot) => {
      const parts = getIstTimeParts(snapshot.timestamp);
      return parts.dateKey === dateKey;
    });

  if (!lastSnapshot) {
    return null;
  }

  return {
    dateKey,
    decision: lastSignal.side,
    activeScenario: lastSignal.scenarioKey,
    scenarioTrail: tradeSignals.map((signal) => ({
      scenarioKey: signal.scenarioKey,
      timeIst: signal.timeIst,
      bbMatchType: signal.bbMatchType,
    })),
    signals: tradeSignals,
    reasons: day.signals.flatMap((signal) => signal.reasons),
    snapshot: lastSnapshot,
  };
}

/** Exported for unit tests. */
export const __ruleSunpharmaTestables = {
  matchesBuyQuality,
  matchesSellQuality,
  matchesBuyExtended,
  nearLowerBand,
  nearUpperBand,
  entryMid,
};
