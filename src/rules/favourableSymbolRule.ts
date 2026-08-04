import { config } from "../config.js";
import { computeStochasticMomentum } from "../indicators/stochasticMomentum.js";
import type {
  DeepakBbMatchType,
  DeepakDecisionResult,
  DeepakTradeSignal,
  DeepproBbProximity,
  FavourableSymbolRuleId,
  FavourableSymbolScanResult,
  FavourableSymbolScenarioKey,
  FavourableSymbolSignal,
  IndicatorSnapshot,
} from "../types.js";

export type { FavourableSymbolRuleId };
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

/** Optional BUY-side guards to skip falling-knife / unconfirmed oversold prints. */
export type FavourableSymbolBuyGuards = {
  /** Require SMI_t > SMI_t−1 at the setup bar. */
  requireSmiRising: boolean;
  /** Require MACD histogram_t > histogram_t−1 at the setup bar. */
  requireMacdHistRising: boolean;
  /**
   * Require the next same-day 15m mid > setup mid.
   * When true, the emitted entry is the confirmation bar (fill after proof).
   */
  requireNextBarConfirmation: boolean;
  /**
   * Reject setup if (setupMid − dayOpenMid) / dayOpenMid * 100 < −maxOpenDrawdownPct.
   * Set null to disable.
   */
  maxOpenDrawdownPct: number | null;
};

/**
 * Optional SELL cascade: flip the blocked falling-knife BUY into a short.
 * Uses the same oversold level band as BUY quality, but requires momentum
 * still falling and next mid lower; entry on the confirm bar.
 */
export type FavourableSymbolSellCascade = {
  enabled: boolean;
  requireSmiFalling: boolean;
  requireMacdHistFalling: boolean;
  requireNextBarLower: boolean;
  /**
   * Optional: only fire if open→setup drop ≤ −minOpenDrawdownPct.
   * null = no minimum drawdown required.
   */
  minOpenDrawdownPct: number | null;
};

export type FavourableSymbolRuleConfig = {
  tradingSymbol: string;
  displayName: string;
  sector: string;
  sessionStart: string;
  sessionEnd: string;
  entryDeadlineIst: string;
  smi: { lengthK: number; lengthD: number; lengthEma: number };
  buyQuality: {
    minRsi: number;
    maxRsi: number;
    maxSmi: number;
    maxBbLowerGapPct: number;
  };
  buyExtended: {
    requireNegativeSmi: boolean;
    maxSmi: number;
    maxBbLowerGapPct: number;
  };
  /** Present only on rules that need anti-cascade BUY filters (e.g. RuleICICIGI). */
  buyGuards?: FavourableSymbolBuyGuards;
  /** Present on RuleICICIGI: falling-knife → SELL opportunity. */
  sellCascade?: FavourableSymbolSellCascade;
  sellQuality: {
    minRsi: number;
    maxRsi: number;
    minSmi: number;
    maxBbUpperGapPct: number;
  };
};

export const FAVOURABLE_SYMBOL_RULE_IDS = [
  "ruleLtm",
  "ruleIcicigi",
  "ruleTechm",
  "ruleTvsmotor",
  "rulePolicybzr",
] as const satisfies readonly FavourableSymbolRuleId[];

export function isFavourableSymbolRuleId(
  value: string | null | undefined,
): value is FavourableSymbolRuleId {
  return (
    value === "ruleLtm" ||
    value === "ruleIcicigi" ||
    value === "ruleTechm" ||
    value === "ruleTvsmotor" ||
    value === "rulePolicybzr"
  );
}

export function getFavourableSymbolRuleConfig(
  ruleId: FavourableSymbolRuleId,
): FavourableSymbolRuleConfig {
  return config.favourableSymbolRules[ruleId];
}

/** Resolve which favourable symbol rule owns a trading symbol, if any. */
export function favourableSymbolRuleIdForTradingSymbol(
  symbol: string | null | undefined,
): FavourableSymbolRuleId | null {
  if (!symbol) {
    return null;
  }
  const normalized = normalizeFavourableTradingSymbol(symbol);
  for (const ruleId of FAVOURABLE_SYMBOL_RULE_IDS) {
    if (getFavourableSymbolRuleConfig(ruleId).tradingSymbol === normalized) {
      return ruleId;
    }
  }
  return null;
}

export function normalizeFavourableTradingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/^NSE:/, "");
}

export function isFavourableSymbolRuleSymbol(
  ruleId: FavourableSymbolRuleId,
  symbol: string | null | undefined,
): boolean {
  if (!symbol) {
    return false;
  }
  return (
    normalizeFavourableTradingSymbol(symbol) ===
    getFavourableSymbolRuleConfig(ruleId).tradingSymbol
  );
}

export function assertFavourableSymbolRuleSymbol(
  ruleId: FavourableSymbolRuleId,
  symbol: string,
): void {
  const rule = getFavourableSymbolRuleConfig(ruleId);
  if (!isFavourableSymbolRuleSymbol(ruleId, symbol)) {
    throw new Error(
      `${rule.displayName} is ${rule.tradingSymbol}-only and cannot run on ${normalizeFavourableTradingSymbol(symbol) || "(empty)"}. Use trading symbol ${rule.tradingSymbol}.`,
    );
  }
}

const SCENARIO_NUMBER: Record<FavourableSymbolScenarioKey, number> = {
  buy_quality: 1,
  sell_quality: 1,
  buy_extended: 2,
  sell_cascade: 2,
};

function scenarioLabel(
  ruleId: FavourableSymbolRuleId,
  key: FavourableSymbolScenarioKey,
): string {
  return `${ruleId} ${key.replace(/_/g, " ")}`;
}

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
  rule: FavourableSymbolRuleConfig,
  rsi: number,
  smi: number,
  bbLower: DeepproBbProximity,
): boolean {
  const { buyQuality } = rule;
  if (rsi < buyQuality.minRsi || rsi > buyQuality.maxRsi) {
    return false;
  }
  if (smi > buyQuality.maxSmi) {
    return false;
  }
  return nearLowerBand(bbLower, buyQuality.maxBbLowerGapPct);
}

function matchesSellQuality(
  rule: FavourableSymbolRuleConfig,
  rsi: number,
  smi: number,
  bbUpper: DeepproBbProximity,
): boolean {
  const { sellQuality } = rule;
  if (rsi < sellQuality.minRsi || rsi > sellQuality.maxRsi) {
    return false;
  }
  if (smi < sellQuality.minSmi) {
    return false;
  }
  return nearUpperBand(bbUpper, sellQuality.maxBbUpperGapPct);
}

function matchesBuyExtended(
  rule: FavourableSymbolRuleConfig,
  smi: number,
  bbLower: DeepproBbProximity,
): boolean {
  const { buyExtended } = rule;
  if (buyExtended.requireNegativeSmi && !(smi < 0)) {
    return false;
  }
  if (smi > buyExtended.maxSmi) {
    return false;
  }
  return nearLowerBand(bbLower, buyExtended.maxBbLowerGapPct);
}

/**
 * Falling-knife SELL: same oversold level band as BUY quality, but momentum
 * still cascading (SMI/MACD falling) with next mid lower.
 */
export function matchesSellCascadeLevels(
  rule: FavourableSymbolRuleConfig,
  rsi: number,
  smi: number,
  bbLower: DeepproBbProximity,
): boolean {
  if (!rule.sellCascade?.enabled) {
    return false;
  }
  // Reuse BUY quality oversold band — the "fake long" print.
  return matchesBuyQuality(rule, rsi, smi, bbLower);
}

export type SellCascadeContext = {
  smi: number;
  prevSmi: number | null;
  macdHist: number;
  prevMacdHist: number | null;
  setupMid: number;
  dayOpenMid: number | null;
  nextMid: number | null;
};

export type SellCascadeResult = {
  ok: boolean;
  reasons: string[];
  confirmedOnNextBar: boolean;
};

export function evaluateSellCascade(
  rule: FavourableSymbolRuleConfig,
  ctx: SellCascadeContext,
): SellCascadeResult {
  const cascade = rule.sellCascade;
  if (!cascade?.enabled) {
    return { ok: false, reasons: [], confirmedOnNextBar: false };
  }

  const reasons: string[] = [];

  if (cascade.requireSmiFalling) {
    if (ctx.prevSmi == null || !(ctx.smi < ctx.prevSmi)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(`SMI falling ${ctx.prevSmi.toFixed(1)}→${ctx.smi.toFixed(1)}`);
  }

  if (cascade.requireMacdHistFalling) {
    if (
      ctx.prevMacdHist == null ||
      !Number.isFinite(ctx.macdHist) ||
      !Number.isFinite(ctx.prevMacdHist) ||
      !(ctx.macdHist < ctx.prevMacdHist)
    ) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `MACD hist falling ${ctx.prevMacdHist.toFixed(2)}→${ctx.macdHist.toFixed(2)}`,
    );
  }

  if (
    cascade.minOpenDrawdownPct != null &&
    Number.isFinite(cascade.minOpenDrawdownPct) &&
    ctx.dayOpenMid != null &&
    ctx.dayOpenMid > 0
  ) {
    const dropPct = ((ctx.setupMid - ctx.dayOpenMid) / ctx.dayOpenMid) * 100;
    if (dropPct > -cascade.minOpenDrawdownPct) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `open drawdown ${dropPct.toFixed(2)}% ≤ −${cascade.minOpenDrawdownPct}%`,
    );
  }

  if (cascade.requireNextBarLower) {
    if (ctx.nextMid == null || !(ctx.nextMid < ctx.setupMid)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `next-bar cascade mid ${ctx.setupMid.toFixed(2)}→${ctx.nextMid.toFixed(2)}`,
    );
    return { ok: true, reasons, confirmedOnNextBar: true };
  }

  return { ok: true, reasons, confirmedOnNextBar: false };
}

export type BuyGuardContext = {
  smi: number;
  prevSmi: number | null;
  macdHist: number;
  prevMacdHist: number | null;
  setupMid: number;
  dayOpenMid: number | null;
  nextMid: number | null;
};

export type BuyGuardResult = {
  ok: boolean;
  reasons: string[];
  /** True when next-bar confirmation is required and passed. */
  confirmedOnNextBar: boolean;
};

/**
 * Optional BUY guards (RuleICICIGI): momentum turn + confirmation + open drawdown.
 * When guards are absent, always passes.
 */
export function evaluateBuyGuards(
  rule: FavourableSymbolRuleConfig,
  ctx: BuyGuardContext,
): BuyGuardResult {
  const guards = rule.buyGuards;
  if (!guards) {
    return { ok: true, reasons: [], confirmedOnNextBar: false };
  }

  const reasons: string[] = [];

  if (guards.requireSmiRising) {
    if (ctx.prevSmi == null || !(ctx.smi > ctx.prevSmi)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(`SMI rising ${ctx.prevSmi.toFixed(1)}→${ctx.smi.toFixed(1)}`);
  }

  if (guards.requireMacdHistRising) {
    if (
      ctx.prevMacdHist == null ||
      !Number.isFinite(ctx.macdHist) ||
      !Number.isFinite(ctx.prevMacdHist) ||
      !(ctx.macdHist > ctx.prevMacdHist)
    ) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `MACD hist rising ${ctx.prevMacdHist.toFixed(2)}→${ctx.macdHist.toFixed(2)}`,
    );
  }

  if (
    guards.maxOpenDrawdownPct != null &&
    Number.isFinite(guards.maxOpenDrawdownPct) &&
    ctx.dayOpenMid != null &&
    ctx.dayOpenMid > 0
  ) {
    const dropPct = ((ctx.setupMid - ctx.dayOpenMid) / ctx.dayOpenMid) * 100;
    if (dropPct < -guards.maxOpenDrawdownPct) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `open drawdown ${dropPct.toFixed(2)}% ≥ −${guards.maxOpenDrawdownPct}%`,
    );
  }

  if (guards.requireNextBarConfirmation) {
    if (ctx.nextMid == null || !(ctx.nextMid > ctx.setupMid)) {
      return { ok: false, reasons: [], confirmedOnNextBar: false };
    }
    reasons.push(
      `next-bar confirm mid ${ctx.setupMid.toFixed(2)}→${ctx.nextMid.toFixed(2)}`,
    );
    return { ok: true, reasons, confirmedOnNextBar: true };
  }

  return { ok: true, reasons, confirmedOnNextBar: false };
}

function findNextSameDayIndex(
  dayIndexes: number[],
  setupIndex: number,
): number | null {
  const position = dayIndexes.indexOf(setupIndex);
  if (position < 0 || position + 1 >= dayIndexes.length) {
    return null;
  }
  return dayIndexes[position + 1];
}

/**
 * Per-symbol favourable profit-range gates (60d study).
 * Each ruleId is locked to exactly one trading symbol.
 */
export function evaluateFavourableSymbolDay(
  ruleId: FavourableSymbolRuleId,
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): FavourableSymbolScanResult {
  const rule = getFavourableSymbolRuleConfig(ruleId);
  const {
    sessionStart,
    sessionEnd,
    entryDeadlineIst,
    smi: smiConfig,
    displayName,
  } = rule;

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

  const dayOpenMid =
    dayIndexes.length > 0 ? entryMid(snapshots[dayIndexes[0]]) : null;

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

  let buyQuality: FavourableSymbolSignal | null = null;
  let buyExtended: FavourableSymbolSignal | null = null;
  let sellSignal: FavourableSymbolSignal | null = null;

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
    const nextMid =
      nextIndex != null ? entryMid(snapshots[nextIndex]) : null;

    const guardResult = evaluateBuyGuards(rule, {
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
    });

    const emitBuy = (
      scenarioKey: FavourableSymbolScenarioKey,
      baseReasons: string[],
    ): FavourableSymbolSignal => {
      const useConfirm =
        guardResult.confirmedOnNextBar && nextIndex != null;
      const emitSnapshot = useConfirm ? snapshots[nextIndex] : snapshot;
      const emitSmiPoint = useConfirm ? smiSeries[nextIndex] : smiPoint;
      const emitSmi =
        emitSmiPoint && Number.isFinite(emitSmiPoint.smi)
          ? emitSmiPoint.smi
          : smi;
      const emitTimeIst = formatIstTime(emitSnapshot.timestamp);
      const emitPrice = entryMid(emitSnapshot);
      const emitBbUpper = buildBbUpperProximity(emitSnapshot);
      const emitBbLower = buildBbLowerProximity(emitSnapshot);
      const guardNotes =
        guardResult.reasons.length > 0
          ? ` | guards: ${guardResult.reasons.join("; ")}`
          : "";
      const setupNote = useConfirm ? ` (setup ${timeIst})` : "";

      return {
        side: "BUY",
        rule: ruleId,
        dateKey,
        timeIst: emitTimeIst,
        scenarioKey,
        price: emitPrice,
        smi: emitSmi,
        rsi: emitSnapshot.rsi,
        bbUpperProximity: emitBbUpper,
        bbLowerProximity: emitBbLower,
        reasons: baseReasons.map((reason) => `${reason}${setupNote}${guardNotes}`),
      };
    };

    if (
      !buyQuality &&
      matchesBuyQuality(rule, rsi, smi, bbLower) &&
      guardResult.ok
    ) {
      buyQuality = emitBuy("buy_quality", [
        `${displayName} BUY quality: RSI ${rsi.toFixed(1)} in ${rule.buyQuality.minRsi}–${rule.buyQuality.maxRsi}, SMI ${smi.toFixed(1)} ≤ ${rule.buyQuality.maxSmi}, BB lower gap ${bbLower.gapPct.toFixed(2)}%${bbLower.matchType ? ` (${bbLower.matchType})` : ""}`,
      ]);
    } else if (
      !buyQuality &&
      !buyExtended &&
      matchesBuyExtended(rule, smi, bbLower) &&
      guardResult.ok
    ) {
      buyExtended = emitBuy("buy_extended", [
        `${displayName} BUY extended (biggest-mover style): SMI ${smi.toFixed(1)} ≤ ${rule.buyExtended.maxSmi}${rule.buyExtended.requireNegativeSmi ? " (negative preferred)" : " (mid-zone OK)"}, BB lower gap ${bbLower.gapPct.toFixed(2)}% (≤ ${rule.buyExtended.maxBbLowerGapPct}%), RSI ${rsi.toFixed(1)}`,
      ]);
    }

    if (!sellSignal && matchesSellQuality(rule, rsi, smi, bbUpper)) {
      sellSignal = {
        side: "SELL",
        rule: ruleId,
        dateKey,
        timeIst,
        scenarioKey: "sell_quality",
        price,
        smi,
        rsi,
        bbUpperProximity: bbUpper,
        bbLowerProximity: bbLower,
        reasons: [
          `${displayName} SELL quality: RSI ${rsi.toFixed(1)} in ${rule.sellQuality.minRsi}–${rule.sellQuality.maxRsi}, SMI ${smi.toFixed(1)} ≥ ${rule.sellQuality.minSmi}, BB upper gap ${bbUpper.gapPct.toFixed(2)}%${bbUpper.matchType ? ` (${bbUpper.matchType})` : ""}`,
        ],
      };
    } else if (
      !sellSignal &&
      matchesSellCascadeLevels(rule, rsi, smi, bbLower)
    ) {
      const cascadeResult = evaluateSellCascade(rule, {
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
      });
      if (cascadeResult.ok) {
        const useConfirm =
          cascadeResult.confirmedOnNextBar && nextIndex != null;
        const emitSnapshot = useConfirm ? snapshots[nextIndex] : snapshot;
        const emitSmiPoint = useConfirm ? smiSeries[nextIndex] : smiPoint;
        const emitSmi =
          emitSmiPoint && Number.isFinite(emitSmiPoint.smi)
            ? emitSmiPoint.smi
            : smi;
        const emitTimeIst = formatIstTime(emitSnapshot.timestamp);
        const emitPrice = entryMid(emitSnapshot);
        const cascadeNotes =
          cascadeResult.reasons.length > 0
            ? ` | cascade: ${cascadeResult.reasons.join("; ")}`
            : "";
        const setupNote = useConfirm ? ` (setup ${timeIst})` : "";
        sellSignal = {
          side: "SELL",
          rule: ruleId,
          dateKey,
          timeIst: emitTimeIst,
          scenarioKey: "sell_cascade",
          price: emitPrice,
          smi: emitSmi,
          rsi: emitSnapshot.rsi,
          bbUpperProximity: buildBbUpperProximity(emitSnapshot),
          bbLowerProximity: buildBbLowerProximity(emitSnapshot),
          reasons: [
            `${displayName} SELL cascade (falling-knife): oversold levels RSI ${rsi.toFixed(1)} / SMI ${smi.toFixed(1)} near BB lower, momentum still falling — short on confirm${setupNote}${cascadeNotes}`,
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
    .filter((signal): signal is FavourableSymbolSignal => signal != null)
    .sort((left, right) => left.timeIst.localeCompare(right.timeIst));

  return {
    dateKey,
    rule: ruleId,
    sessionStart,
    sessionEnd,
    signals,
  };
}

export function favourableSymbolSignalToTradeSignal(
  ruleId: FavourableSymbolRuleId,
  signal: FavourableSymbolSignal,
): DeepakTradeSignal {
  const proximity =
    signal.side === "SELL" ? signal.bbUpperProximity : signal.bbLowerProximity;
  const bbMatchType: DeepakBbMatchType = proximity.matchType ?? "close";

  return {
    side: signal.side,
    scenarioKey: scenarioLabel(ruleId, signal.scenarioKey),
    scenarioNumber: SCENARIO_NUMBER[signal.scenarioKey],
    timeIst: signal.timeIst,
    price: signal.price,
    bbMatchType,
    profitTarget: 0,
    exit: null,
  };
}

export function evaluateFavourableSymbolDecision(
  ruleId: FavourableSymbolRuleId,
  snapshots: IndicatorSnapshot[],
  dateKey: string,
): DeepakDecisionResult | null {
  const day = evaluateFavourableSymbolDay(ruleId, snapshots, dateKey);
  if (day.signals.length === 0) {
    return null;
  }

  const tradeSignals = day.signals.map((signal) =>
    favourableSymbolSignalToTradeSignal(ruleId, signal),
  );
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

export const __favourableSymbolRuleTestables = {
  matchesBuyQuality,
  matchesSellQuality,
  matchesBuyExtended,
  matchesSellCascadeLevels,
  evaluateBuyGuards,
  evaluateSellCascade,
  nearLowerBand,
  nearUpperBand,
  entryMid,
};
