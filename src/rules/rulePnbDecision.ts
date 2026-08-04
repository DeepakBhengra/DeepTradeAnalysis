import { config } from "../config.js";
import { computeStochasticMomentum } from "../indicators/stochasticMomentum.js";
import type {
  DeepakBbMatchType,
  DeepakDecisionResult,
  DeepakTradeSignal,
  DeepproBbProximity,
  IndicatorSnapshot,
  RulePnbScanResult,
  RulePnbScenarioKey,
  RulePnbSignal,
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
  evaluateOversoldBuyGuards,
  evaluateOversoldSellCascade,
  findNextSameDayIndex,
} from "./oversoldCascade.js";

/** Normalize NSE:PNB / pnb → PNB for the exclusive-symbol guard. */
export function normalizeRulePnbTradingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/^NSE:/, "");
}

/** True only for the exclusive RulePNB symbol (PNB). */
export function isRulePnbSymbol(symbol: string | null | undefined): boolean {
  if (!symbol) {
    return false;
  }
  return normalizeRulePnbTradingSymbol(symbol) === config.rulePnb.tradingSymbol;
}

/** Throws when a caller tries to run RulePNB on a non-PNB symbol. */
export function assertRulePnbSymbol(symbol: string): void {
  if (!isRulePnbSymbol(symbol)) {
    throw new Error(
      `RulePNB is PNB-only and cannot run on ${normalizeRulePnbTradingSymbol(symbol) || "(empty)"}. Use trading symbol PNB.`,
    );
  }
}

const SCENARIO_NUMBER: Record<RulePnbScenarioKey, number> = {
  buy_quality: 1,
  sell_quality: 1,
  buy_extended: 2,
  sell_cascade: 2,
};

const SCENARIO_LABEL: Record<RulePnbScenarioKey, string> = {
  buy_quality: "rulePnb buy quality",
  sell_quality: "rulePnb sell quality",
  buy_extended: "rulePnb buy extended",
  sell_cascade: "rulePnb sell cascade",
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
  const { buyQuality } = config.rulePnb;
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
  const { sellQuality } = config.rulePnb;
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
  const { buyExtended } = config.rulePnb;
  if (buyExtended.requireNegativeSmi && !(smi < 0)) {
    return false;
  }
  return nearLowerBand(bbLower, buyExtended.maxBbLowerGapPct);
}

/**
 * RulePNB — PNB-only favourable profit-range indicator gates (60d study).
 * Completely separate from Deepak / Deepak-2 / Deeppro — call sites must
 * guard with `isRulePnbSymbol` / `assertRulePnbSymbol` so other stocks never
 * enter this path.
 *
 * 1. BUY quality (1.7%–0.9% band): RSI ~25–50, SMI ≤ −40, near BB lower
 *    (gap often &lt; 0.7%, frequently crossed)
 * 2. SELL quality (1.7%–0.9% / 0.8%–0.4%): RSI ~50–70, SMI ≥ 40, near BB upper
 *    (gap often &lt; 0.8%)
 * 3. BUY extended (3%–1.8% movers): still prefer negative SMI; RSI mixed;
 *    BB lower gaps can be wider (trend-day opens, not tight band tags)
 *
 * Entry price = candle mid (high+low)/2. Event candle before entry deadline
 * (default before 14:00 IST). One earliest BUY and one earliest SELL per day;
 * BUY prefers quality over extended.
 */
export function evaluateRulePnbDay(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): RulePnbScanResult {
  const {
    sessionStart,
    sessionEnd,
    entryDeadlineIst,
    smi: smiConfig,
  } = config.rulePnb;

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

  let buyQuality: RulePnbSignal | null = null;
  let buyExtended: RulePnbSignal | null = null;
  let sellSignal: RulePnbSignal | null = null;

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
    const guardResult = evaluateOversoldBuyGuards(
      config.rulePnb.buyGuards,
      cascadeCtx,
    );

    const emitBuy = (
      scenarioKey: RulePnbScenarioKey,
      baseReasons: string[],
    ): RulePnbSignal => {
      const useConfirm = guardResult.confirmedOnNextBar && nextIndex != null;
      const emitSnapshot = useConfirm ? snapshots[nextIndex] : snapshot;
      const emitSmiPoint = useConfirm ? smiSeries[nextIndex] : smiPoint;
      const emitSmi =
        emitSmiPoint && Number.isFinite(emitSmiPoint.smi)
          ? emitSmiPoint.smi
          : smi;
      const guardNotes =
        guardResult.reasons.length > 0
          ? ` | guards: ${guardResult.reasons.join("; ")}`
          : "";
      const setupNote = useConfirm ? ` (setup ${timeIst})` : "";
      return {
        side: "BUY",
        rule: "rulePnb",
        dateKey,
        timeIst: formatIstTime(emitSnapshot.timestamp),
        scenarioKey,
        price: entryMid(emitSnapshot),
        smi: emitSmi,
        rsi: emitSnapshot.rsi,
        bbUpperProximity: buildBbUpperProximity(emitSnapshot),
        bbLowerProximity: buildBbLowerProximity(emitSnapshot),
        reasons: baseReasons.map((r) => `${r}${setupNote}${guardNotes}`),
      };
    };

    if (!buyQuality && matchesBuyQuality(rsi, smi, bbLower) && guardResult.ok) {
      buyQuality = emitBuy("buy_quality", [
        `RulePNB BUY quality: RSI ${rsi.toFixed(1)} in ${config.rulePnb.buyQuality.minRsi}–${config.rulePnb.buyQuality.maxRsi}, SMI ${smi.toFixed(1)} ≤ ${config.rulePnb.buyQuality.maxSmi}, BB lower gap ${bbLower.gapPct.toFixed(2)}%${bbLower.matchType ? ` (${bbLower.matchType})` : ""}`,
      ]);
    } else if (
      !buyQuality &&
      !buyExtended &&
      matchesBuyExtended(smi, bbLower) &&
      guardResult.ok
    ) {
      buyExtended = emitBuy("buy_extended", [
        `RulePNB BUY extended (biggest-mover style): SMI ${smi.toFixed(1)} < 0, BB lower gap ${bbLower.gapPct.toFixed(2)}% (wider ≤ ${config.rulePnb.buyExtended.maxBbLowerGapPct}%), RSI mixed (${rsi.toFixed(1)})`,
      ]);
    }

    if (!sellSignal && matchesSellQuality(rsi, smi, bbUpper)) {
      sellSignal = {
        side: "SELL",
        rule: "rulePnb",
        dateKey,
        timeIst,
        scenarioKey: "sell_quality",
        price,
        smi,
        rsi,
        bbUpperProximity: bbUpper,
        bbLowerProximity: bbLower,
        reasons: [
          `RulePNB SELL quality: RSI ${rsi.toFixed(1)} in ${config.rulePnb.sellQuality.minRsi}–${config.rulePnb.sellQuality.maxRsi}, SMI ${smi.toFixed(1)} ≥ ${config.rulePnb.sellQuality.minSmi}, BB upper gap ${bbUpper.gapPct.toFixed(2)}%${bbUpper.matchType ? ` (${bbUpper.matchType})` : ""}`,
        ],
      };
    } else if (
      !sellSignal &&
      config.rulePnb.sellCascade?.enabled &&
      matchesBuyQuality(rsi, smi, bbLower)
    ) {
      const cascadeResult = evaluateOversoldSellCascade(
        config.rulePnb.sellCascade,
        cascadeCtx,
      );
      if (cascadeResult.ok) {
        const useConfirm =
          cascadeResult.confirmedOnNextBar && nextIndex != null;
        const emitSnapshot = useConfirm ? snapshots[nextIndex] : snapshot;
        const emitSmiPoint = useConfirm ? smiSeries[nextIndex] : smiPoint;
        const emitSmi =
          emitSmiPoint && Number.isFinite(emitSmiPoint.smi)
            ? emitSmiPoint.smi
            : smi;
        const cascadeNotes =
          cascadeResult.reasons.length > 0
            ? ` | cascade: ${cascadeResult.reasons.join("; ")}`
            : "";
        const setupNote = useConfirm ? ` (setup ${timeIst})` : "";
        sellSignal = {
          side: "SELL",
          rule: "rulePnb",
          dateKey,
          timeIst: formatIstTime(emitSnapshot.timestamp),
          scenarioKey: "sell_cascade",
          price: entryMid(emitSnapshot),
          smi: emitSmi,
          rsi: emitSnapshot.rsi,
          bbUpperProximity: buildBbUpperProximity(emitSnapshot),
          bbLowerProximity: buildBbLowerProximity(emitSnapshot),
          reasons: [
            `RulePNB SELL cascade (falling-knife): oversold levels RSI ${rsi.toFixed(1)} / SMI ${smi.toFixed(1)} near BB lower, momentum still falling — short on confirm${setupNote}${cascadeNotes}`,
          ],
        };
      }
    }

    if (buyQuality && sellSignal) {
      break;
    }
  }

  const buySignal = buyQuality ?? buyExtended;

  const signals = [buySignal, sellSignal]
    .filter((signal): signal is RulePnbSignal => signal != null)
    .sort((left, right) => left.timeIst.localeCompare(right.timeIst));

  return {
    dateKey,
    rule: "rulePnb",
    sessionStart,
    sessionEnd,
    signals,
  };
}

/** Map a RulePNB signal into the shared day-scan trade-signal shape. */
export function rulePnbSignalToTradeSignal(signal: RulePnbSignal): DeepakTradeSignal {
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

/** Adapt RulePNB day signals into the Deepak decision shape used by dashboard/post-mortem. */
export function evaluateRulePnbDecision(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): DeepakDecisionResult | null {
  const day = evaluateRulePnbDay(snapshots, dateKey);
  if (day.signals.length === 0) {
    return null;
  }

  const tradeSignals = day.signals.map(rulePnbSignalToTradeSignal);
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
export const __rulePnbTestables = {
  matchesBuyQuality,
  matchesSellQuality,
  matchesBuyExtended,
  nearLowerBand,
  nearUpperBand,
  entryMid,
};
