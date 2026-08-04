import { applySymbolAlias } from "./symbols/aliases.js";

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function readEnvBoolean(name: string, defaultValue: boolean): boolean {
  const value = readEnv(name).toLowerCase();
  if (!value) {
    return defaultValue;
  }
  return value === "true" || value === "1" || value === "yes";
}

function readEnvNumber(name: string, defaultValue: number): number {
  const value = readEnv(name);
  if (!value) {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readSamcoEntryPriceMaxDefault(): number {
  const entryPriceMax = readEnv("SAMCO_ENTRY_PRICE_MAX");
  if (entryPriceMax) {
    return readEnvNumber("SAMCO_ENTRY_PRICE_MAX", 3900);
  }
  return readEnvNumber("SAMCO_MAX_ENTRY_PRICE", 3900);
}

function readOptionalInstrumentToken(): number | undefined {
  const value = readEnv("KITE_INSTRUMENT_TOKEN");
  if (!value) {
    return undefined;
  }

  const token = Number(value);
  return Number.isFinite(token) ? token : undefined;
}

export const dashboardSymbols = {
  pnb: {
    id: "pnb",
    symbol: "NSE:PNB",
    tradingSymbol: "PNB",
    exchange: "NSE",
    segment: "NSE",
  },
  niftyBank: {
    id: "niftyBank",
    symbol: "NSE:NIFTY BANK",
    tradingSymbol: "NIFTY BANK",
    exchange: "NSE",
    segment: "INDICES",
  },
} as const;

export type DashboardSymbolId = keyof typeof dashboardSymbols;

export const DAY_SCAN_SIMULATION = {
  sessionStart: "09:15",
  sessionEnd: "15:00",
} as const;

export interface DashboardSymbolConfig {
  id: string;
  symbol: string;
  tradingSymbol: string;
  exchange: string;
  segment: string;
}

export interface DeepakMorningRulesConfig {
  enabled: boolean;
  setupWindowStart: string;
  setupWindowEnd: string;
  entryTimeIst: string;
  /** Max RSI at first setup candle (09:15) — weakness at open */
  buyRsiStartMax: number;
  /** Max RSI at last setup candle (10:15) — recovery not yet overbought */
  buyRsiEndMax: number;
  /** Min RSI at first setup candle (09:15) — already elevated at open */
  sellRsiStartMin: number;
  /** Min RSI peak within setup window — near overbought */
  sellRsiPeakMin: number;
  /** Min RSI at last setup candle (10:15) — rollover but not oversold yet */
  sellRsiEndMin: number;
  majorityMinPairs: number;
}

export interface DeepakDualBandDeferralConfig {
  enabled: boolean;
  /** Consecutive bbBothActive candles that trigger early-signal deferral */
  minBothCandles: number;
  /** Exclusive resolve streaks are counted only on candles after this IST time */
  majorityAfterTimeIst: string;
  /** Consecutive bbUpperOnly / bbLowerOnly candles required to tip BUY / SELL */
  resolveRunLength: number;
}

export interface DeepakRsiExtremeContinueDeferConfig {
  enabled: boolean;
  /** Suppress CONTINUE_DOWN_2 SELL when entry RSI is at or below this */
  maxRsiAtSellDefer: number;
  /** Rising recovery candles must each have RSI at or above this */
  minRsiOnBuyRecover: number;
  /** Suppress CONTINUE_UP_2 BUY when entry RSI is at or above this */
  minRsiAtBuyDefer: number;
  /** Falling recovery candles must each have RSI at or below this */
  maxRsiOnSellRecover: number;
  /** Consecutive confirming candles required to tip recovery */
  recoverRunLength: number;
  /** Latest allowed IST tip time for recovery signals */
  tipDeadlineIst: string;
}

export interface DeepakDecisionConfig {
  sessionStart: string;
  sessionEnd: string;
  initialRunSize: number;
  profitTarget: number;
  adaptiveTarget: {
    enabled: boolean;
    lookback: number;
  };
  morningRules?: DeepakMorningRulesConfig;
  dualBandDeferral?: DeepakDualBandDeferralConfig;
  rsiExtremeContinueDefer?: DeepakRsiExtremeContinueDeferConfig;
}

export interface Deepak3DecisionConfig extends DeepakDecisionConfig {
  requireCrossedAnchor: boolean;
  continueScenariosOnly: boolean;
  requireEntryRangeGteTarget: boolean;
  minSectorBreadth: number;
}

export interface DeepakWatchPartyConfig {
  entryTimeIst: string;
  watchVariant: "deepak2";
  sessionEnd: string;
}

export const defaultDashboardSymbolId: DashboardSymbolId = "pnb";

const NSE_EQUITY_SYMBOL_PATTERN = /^[A-Z0-9&-]+$/;

function findRegistrySymbol(input: string): DashboardSymbolConfig | undefined {
  const normalized = input.trim();

  const byId = dashboardSymbols[normalized as DashboardSymbolId];
  if (byId) {
    return byId;
  }

  return Object.values(dashboardSymbols).find(
    (entry) =>
      entry.symbol === normalized ||
      entry.tradingSymbol === normalized ||
      entry.tradingSymbol.toUpperCase() === normalized.toUpperCase(),
  );
}

function normalizeEquityTradingSymbol(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes(":")) {
    return trimmed.split(":")[1] ?? trimmed;
  }

  if (trimmed.endsWith(".NS")) {
    return trimmed.slice(0, -3);
  }

  return trimmed;
}

function looksLikeIndexSymbol(tradingSymbol: string): boolean {
  return tradingSymbol.includes(" ");
}

export function getDashboardSymbol(id?: string): DashboardSymbolConfig {
  const key = id ?? defaultDashboardSymbolId;
  const entry = dashboardSymbols[key as DashboardSymbolId];

  if (!entry) {
    throw new Error(
      `Unknown dashboard symbol: ${key}. Valid values: ${Object.keys(dashboardSymbols).join(", ")}`,
    );
  }

  return entry;
}

export function resolveDashboardSymbol(input?: string): DashboardSymbolConfig {
  if (input !== undefined && input.trim() === "") {
    throw new Error("Enter a valid NSE symbol.");
  }

  const key = input?.trim() || defaultDashboardSymbolId;
  const registryMatch = findRegistrySymbol(key);

  if (registryMatch) {
    return registryMatch;
  }

  const tradingSymbol = applySymbolAlias(normalizeEquityTradingSymbol(key));

  if (!tradingSymbol) {
    throw new Error("Enter a valid NSE symbol.");
  }

  if (looksLikeIndexSymbol(tradingSymbol)) {
    throw new Error(
      `Index symbols like "${tradingSymbol}" are not supported here. Use the NIFTY Bank 15m Dashboard tab instead.`,
    );
  }

  if (!NSE_EQUITY_SYMBOL_PATTERN.test(tradingSymbol)) {
    throw new Error(`Invalid symbol: ${tradingSymbol}`);
  }

  return {
    id: tradingSymbol,
    symbol: `NSE:${tradingSymbol}`,
    tradingSymbol,
    exchange: "NSE",
    segment: "NSE",
  };
}

export function isRegistryDashboardSymbol(id: string): id is DashboardSymbolId {
  return id in dashboardSymbols;
}

export const config = {
  symbol: "NSE:PNB",
  tradingSymbol: "PNB",
  exchange: "NSE",
  interval: "15m" as const,
  pollIntervalMs: 60_000,

  kite: {
    apiKey: readEnv("KITE_API_KEY"),
    apiSecret: readEnv("KITE_API_SECRET"),
    accessToken: readEnv("KITE_ACCESS_TOKEN"),
    instrumentToken: readOptionalInstrumentToken(),
    redirectUrl: readEnv("KITE_REDIRECT_URL"),
    appUrl: readEnv("KITE_APP_URL"),
    apiBaseUrl: readEnv("KITE_API_BASE_URL") || `http://localhost:${readEnv("PORT") || "3001"}`,
    requestTimeoutMs: readEnvNumber("KITE_REQUEST_TIMEOUT_MS", 60_000),
    maxConcurrentRequests: readEnvNumber("KITE_MAX_CONCURRENT_REQUESTS", 4),
    requestRetries: readEnvNumber("KITE_REQUEST_RETRIES", 3),
    retryDelayMs: readEnvNumber("KITE_RETRY_DELAY_MS", 1_000),
  },

  samco: {
    apiKey: readEnv("SAMCO_API_KEY"),
    apiSecret: readEnv("SAMCO_API_SECRET"),
    sessionToken: readEnv("SAMCO_SESSION_TOKEN"),
    baseUrl: readEnv("SAMCO_BASE_URL") || "https://tradeapi.samco.in",
    productType: readEnv("SAMCO_PRODUCT_TYPE") || "MIS",
    orderType: readEnv("SAMCO_ORDER_TYPE") || "MKT",
    defaultQuantity: readEnvNumber("SAMCO_DEFAULT_QUANTITY", 100),
    entryPriceMin: readEnvNumber("SAMCO_ENTRY_PRICE_MIN", 0),
    entryPriceMax: readSamcoEntryPriceMaxDefault(),
    dryRun: readEnvBoolean("SAMCO_DRY_RUN", true),
    liveTradingEnabled: readEnvBoolean("SAMCO_LIVE_TRADING_ENABLED", false),
    eodSquareOffStart: readEnv("SAMCO_EOD_SQUARE_OFF_START") || "15:00",
    eodSquareOffEnd: readEnv("SAMCO_EOD_SQUARE_OFF_END") || "15:15",
    ledgerPath: readEnv("SAMCO_LEDGER_PATH") || "data/samco-ledger.json",
  },

  bollinger: {
    length: 20,
    stdDev: 2,
    maType: "SMA" as const,
    field: "close" as const,
  },

  rsi: {
    period: 14,
    field: "close" as const,
    overbought: 70,
    oversold: 20,
  },

  macd: {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
  },

  thresholds: {
    bbClosePctThreshold: 0.3,
    bbParallelSlopeTolerance: 0.02,
    rsiNearBand: 5,
    slopeLookback: 5,
  },

  morningDecision: {
    windowStart: "09:15",
    windowEnd: "12:00",
    timezone: "Asia/Kolkata",
    rsiOversold: 20,
    rsiOverbought: 70,
  },

  deepakDecision: {
    sessionStart: "09:15",
    sessionEnd: "15:30",
    initialRunSize: 4,
    profitTarget: 0.7,
    adaptiveTarget: {
      enabled: true,
      lookback: 20,
    },
    morningRules: {
      enabled: true,
      setupWindowStart: "09:15",
      setupWindowEnd: "10:15",
      entryTimeIst: "10:30",
      buyRsiStartMax: 40,
      buyRsiEndMax: 50,
      sellRsiStartMin: 60,
      sellRsiPeakMin: 65,
      sellRsiEndMin: 50,
      majorityMinPairs: 3,
    },
    dualBandDeferral: {
      enabled: true,
      minBothCandles: 2,
      majorityAfterTimeIst: "10:15",
      resolveRunLength: 3,
    },
    rsiExtremeContinueDefer: {
      enabled: true,
      maxRsiAtSellDefer: 40,
      minRsiOnBuyRecover: 40,
      minRsiAtBuyDefer: 60,
      maxRsiOnSellRecover: 60,
      recoverRunLength: 3,
      tipDeadlineIst: "12:00",
    },
  } satisfies DeepakDecisionConfig,

  deepakDecision2: {
    sessionStart: "10:15",
    sessionEnd: "15:30",
    initialRunSize: 4,
    profitTarget: 0.7,
    adaptiveTarget: {
      enabled: true,
      lookback: 20,
    },
  } satisfies DeepakDecisionConfig,

  deepakWatchParty: {
    entryTimeIst: "10:15",
    watchVariant: "deepak2",
    sessionEnd: "15:30",
  } satisfies DeepakWatchPartyConfig,

  deepakDecision3: {
    sessionStart: "09:15",
    sessionEnd: "15:30",
    initialRunSize: 4,
    profitTarget: 0.7,
    adaptiveTarget: {
      enabled: true,
      lookback: 20,
    },
    requireCrossedAnchor: true,
    continueScenariosOnly: true,
    requireEntryRangeGteTarget: true,
    minSectorBreadth: 3,
  } satisfies Deepak3DecisionConfig,

  sidewaysTrend: {
    sessionStart: "09:15",
    sessionEnd: "12:00",
    timezone: "Asia/Kolkata",
    priceProximityPct: 0.3,
    minCandlesInWindow: 3,
    warmupDays: 35,
    rsiNeutralMin: 35,
    rsiNeutralMax: 65,
    macdHistogramFlatThreshold: 0.15,
  },

  /** deeppro — Stch Mtm exhaustion reversal (pink-circle pattern) */
  deeppro: {
    sessionStart: "09:15",
    sessionEnd: "15:30",
    /**
     * Matches Zerodha Kite Stch Mtm:
     * %K=10, %K smooth=3, %K double-smooth=3, %D (signal EMA)=10.
     * Chart study label often shows "(10, 3, 3)" for the K/smooth group;
     * the signal line is Kite's separate %D default of 10.
     */
    smi: {
      lengthK: 10,
      lengthD: 3,
      /** Signal line = EMA(SMI, lengthEma). Must be 10 to match Kite %D. */
      lengthEma: 10,
    },
    /** SMI overbought threshold (Kite shaded zone ~40) — SELL path */
    overboughtLevel: 40,
    /**
     * Require a deep overbought peak in lookback (chart-quality filter).
     * Tuned on Kite 15m historical only — slight slack under a strict 70 so near-miss
     * exhaustion peaks (e.g. ~69) still count on live Kite candles.
     */
    minPeakSmi: 65,
    /** SMI oversold threshold (mirror of overbought) — BUY path */
    oversoldLevel: -40,
    /** Require a deep oversold trough in lookback (mirror of minPeakSmi) */
    maxTroughSmi: -65,
    /**
     * Bars used for peak/trough SMI + Bollinger tag checks (~4h on 15m).
     * Longer than a single morning burst so the same impulse's deep OB/OS counts
     * even when the SMI cross prints a few bars later.
     */
    lookbackBars: 16,
    /**
     * When true, publish BUY/SELL only at the Stch Mtm SMI↔signal cross candle.
     * Disables look-ahead remapping to stall / SMI-exit / MACD-cross events.
     */
    signalOnSmiCrossOnly: true,
    /**
     * Max body/range to treat a post-cross candle as stall/doji.
     * Unused while `signalOnSmiCrossOnly` is true (kept for optional chart annotation).
     */
    stallBodyRatioMax: 0.35,
    /**
     * Exclusive IST deadline for the deeppro event candle (hard cap).
     * Quality filters below further tighten the practical entry window.
     */
    entryDeadlineIst: "14:00",
    /**
     * Min |Δ MACD histogram| / close * 100 on the SMI cross bar.
     * Price-normalized so PNB and TCS share one threshold; filters weak fades
     * that rarely reach the 0.30%+ square-off bands.
     */
    minMacdHistDeltaPct: 0.01,
    /**
     * Post-detect quality gates tuned on Kite 15m watchlist study (2026-06-29)
     * to favor same-day square-off profit ≥ ~0.75%.
     *
     * Intentionally does NOT over-trust: extreme peak/trough SMI alone, ultra-low
     * BUY RSI (≤30), or SELL BB-upper match tags — those did not separate winners.
     */
    qualityFilter: {
      enabled: true,
      sell: {
        /** Inclusive event window — winners clustered 10:45–12:30. */
        eventFromIst: "10:45",
        eventToIst: "12:30",
        /** Ideal exhaustion RSI at the SMI cross candle. */
        minEventRsi: 67,
        /** Tight upper-band proximity (keeps DRREDDY ~1.67 / CIPLA ~1.59). */
        maxBbUpperGapPct: 1.75,
        /** Only SMI↔signal line crosses (no stall / exit remaps). */
        allowedEventKinds: ["smi_cross"],
      },
      buy: {
        /** Hard cap; practical entries are further limited by paths below. */
        eventToIst: "13:15",
        /** Soft RSI cap — do not require ultra-oversold ≤30. */
        maxEventRsi: 50,
        /** Outer BB lower proximity cap (matched path / extreme exception). */
        maxBbLowerGapPct: 1.0,
        /** Only SMI↔signal line crosses (no stall / exit remaps). */
        allowedEventKinds: ["smi_cross"],
        /** If BB lower is close/crossed, allow slightly higher RSI. */
        matchedBbMaxEventRsi: 60,
        /**
         * Path B — unmatched proximity BUYs only in the morning.
         * Tuned on 2026-06-01 (late bank/metal stalls failed) vs 2026-06-29 winners.
         */
        unmatchedEventToIst: "10:30",
        unmatchedMaxBbLowerGapPct: 0.65,
        /**
         * Path A — after this IST time, BB-matched BUY needs RSI recovering
         * (≥40). Mid-morning waterfall touches stay out; afternoon recovery stays in.
         */
        matchedRecoveryAfterIst: "11:00",
        matchedRecoveryMinEventRsi: 40,
        /** Reject chop when price tags both Bollinger bands on the cross candle. */
        rejectBothBandsMatched: true,
        /**
         * Path C — rare extreme late cross (EICHERMOT-style): RSI≤12 with
         * deeply negative MACD hist, still near the lower band.
         */
        allowExtremeStallException: true,
        extremeStallMaxEventRsi: 12,
        extremeStallMaxBbLowerGapPct: 0.9,
        extremeStallMaxMacdHist: -5,
        extremeStallEventToIst: "12:30",
      },
    },
  },

  /**
   * RulePNB — PNB-only favourable profit-range indicator gates (60d study).
   * Completely separate from Deepak / Deepak-2 / Deeppro. Applies only to PNB.
   * Tuned from rule-free best BUY/SELL buckets: 1.7%–0.9% quality +
   * 3%–1.8% biggest-mover BUY / mid-low SELL bands.
   */
  rulePnb: {
    /** Exclusive symbol — RulePNB never evaluates other stocks. */
    tradingSymbol: "PNB",
    sessionStart: "09:15",
    sessionEnd: "15:30",
    /** Exclusive IST deadline for the entry candle (hard cap). */
    entryDeadlineIst: "14:00",
    /**
     * Matches Zerodha Kite Stch Mtm (same as deeppro):
     * %K=10, %K smooth=3, %D (signal EMA)=10.
     */
    smi: {
      lengthK: 10,
      lengthD: 3,
      lengthEma: 10,
    },
    /** Best BUY quality (1.7%–0.9% band): RSI ~25–50, SMI ≤ −40, near BB lower. */
    buyQuality: {
      minRsi: 25,
      maxRsi: 50,
      maxSmi: -40,
      maxBbLowerGapPct: 0.7,
    },
    /**
     * Biggest-mover BUY (3%–1.8%): prefer negative SMI; RSI mixed;
     * BB lower gaps can be wider (trend-day opens).
     */
    buyExtended: {
      requireNegativeSmi: true,
      maxBbLowerGapPct: 1.4,
    },
    /** Best SELL quality: RSI ~50–70, SMI ≥ 40, near BB upper. */
    sellQuality: {
      minRsi: 50,
      maxRsi: 70,
      minSmi: 40,
      maxBbUpperGapPct: 0.8,
    },
    /** Falling-knife BUY guards + SELL cascade; rising-knife SELL guards + BUY cascade. */
    buyGuards: {
      requireSmiRising: true,
      requireMacdHistRising: true,
      requireNextBarConfirmation: true,
      maxOpenDrawdownPct: 0.8,
    },
    sellCascade: {
      enabled: true,
      requireSmiFalling: true,
      requireMacdHistFalling: true,
      requireNextBarLower: true,
      minOpenDrawdownPct: null,
    },
    sellGuards: {
      requireSmiFalling: true,
      requireMacdHistFalling: true,
      requireNextBarConfirmation: true,
      maxOpenRallyPct: 0.8,
    },
    buyCascade: {
      enabled: true,
      requireSmiRising: true,
      requireMacdHistRising: true,
      requireNextBarHigher: true,
      minOpenRallyPct: null,
    },
  },

  /**
   * RuleSUNPHARMA — SUNPHARMA-only favourable profit-range indicator gates (60d study).
   * Completely separate from Deepak / Deepak-2 / Deeppro / RulePNB.
   * Applies only to SUNPHARMA. Tuned from rule-free best BUY/SELL buckets:
   * 1.7%–0.9% BUY quality · mid/low SELL · 3%–1.8% biggest-mover BUY.
   */
  ruleSunpharma: {
    /** Exclusive symbol — RuleSUNPHARMA never evaluates other stocks. */
    tradingSymbol: "SUNPHARMA",
    sessionStart: "09:15",
    sessionEnd: "15:30",
    /** Exclusive IST deadline for the entry candle (hard cap). */
    entryDeadlineIst: "14:00",
    /**
     * Matches Zerodha Kite Stch Mtm (same as deeppro / RulePNB):
     * %K=10, %K smooth=3, %D (signal EMA)=10.
     */
    smi: {
      lengthK: 10,
      lengthD: 3,
      lengthEma: 10,
    },
    /** Best BUY quality (1.7%–0.9% band): RSI ~33–56, SMI ≤ −40, near BB lower. */
    buyQuality: {
      minRsi: 33,
      maxRsi: 56,
      maxSmi: -40,
      maxBbLowerGapPct: 0.5,
    },
    /**
     * Biggest-mover BUY (3%–1.8%): less oversold than mid bucket;
     * mid-zone SMI OK (not overbought); still near BB lower (tight gap).
     */
    buyExtended: {
      requireNegativeSmi: false,
      maxSmi: 40,
      maxBbLowerGapPct: 0.5,
    },
    /** Best SELL quality (0.8%–0.4% / mid): RSI ~56–72, SMI ≥ 40, tight BB upper. */
    sellQuality: {
      minRsi: 56,
      maxRsi: 72,
      minSmi: 40,
      maxBbUpperGapPct: 0.3,
    },
    /** Falling-knife BUY guards + SELL cascade; rising-knife SELL guards + BUY cascade. */
    buyGuards: {
      requireSmiRising: true,
      requireMacdHistRising: true,
      requireNextBarConfirmation: true,
      maxOpenDrawdownPct: 0.8,
    },
    sellCascade: {
      enabled: true,
      requireSmiFalling: true,
      requireMacdHistFalling: true,
      requireNextBarLower: true,
      minOpenDrawdownPct: null,
    },
    sellGuards: {
      requireSmiFalling: true,
      requireMacdHistFalling: true,
      requireNextBarConfirmation: true,
      maxOpenRallyPct: 0.8,
    },
    buyCascade: {
      enabled: true,
      requireSmiRising: true,
      requireMacdHistRising: true,
      requireNextBarHigher: true,
      minOpenRallyPct: null,
    },
  },

  /**
   * RuleSUNPHARMA1 — SUNPHARMA-only SMI cross + fixed % square-off.
   * Totally separate from RuleSUNPHARMA / Deepak / Deeppro / RulePNB / favourable rules.
   * Not wired to any Day Scan / Post-Mortem widget.
   *
   * SELL: SMI (black) crosses below signal (red) → square-off when drop % ≥ squareOffPct
   * BUY:  SMI (black) crosses above signal (red) → square-off when rise % ≥ squareOffPct
   */
  ruleSunpharma1: {
    tradingSymbol: "SUNPHARMA",
    sessionStart: "09:15",
    sessionEnd: "15:30",
    /**
     * Chart-aligned Stch Mtm (matches SMI down-cross study):
     * %K=10, double-smooth=3, signal EMA=3.
     */
    smi: {
      lengthK: 10,
      lengthD: 3,
      lengthEma: 3,
    },
    /** Same-day square-off when favourable mid move reaches this % from entry mid. */
    squareOffPct: 0.45,
  },

  /**
   * Deeppro1 — generic all-stock SMI cross + fixed % square-off.
   * Same logic as RuleSUNPHARMA1 / RulePNB1 (black↓red → SELL, black↑red → BUY, SQ 0.45%),
   * but no symbol lock. Uses Stch Mtm (10,3,3) — not Deeppro's (10,3,10).
   * Wired to Day Scan + Day Scan Post-Mortem.
   */
  deeppro1: {
    sessionStart: "09:15",
    sessionEnd: "15:30",
    /**
     * Chart-aligned Stch Mtm (matches RuleSUNPHARMA1 / SMI down-cross study):
     * %K=10, double-smooth=3, signal EMA=3.
     */
    smi: {
      lengthK: 10,
      lengthD: 3,
      lengthEma: 3,
    },
    /** Same-day square-off when favourable mid move reaches this % from entry mid. */
    squareOffPct: 0.45,
  },

  /**
   * Per-symbol favourable profit-range rules (separate from Deepak/Deeppro/RulePNB/RuleSUNPHARMA).
   * Each entry is locked to one trading symbol. Thresholds from 60d rule-free IQR studies.
   */
  favourableSymbolRules: {
    ruleLtm: {
      tradingSymbol: "LTM",
      displayName: "RuleLTM",
      sector: "IT",
      sessionStart: "09:15",
      sessionEnd: "15:30",
      entryDeadlineIst: "14:00",
      smi: { lengthK: 10, lengthD: 3, lengthEma: 10 },
      /** Mid/low BUY: softer RSI, negative SMI, near BB lower. */
      buyQuality: {
        minRsi: 30,
        maxRsi: 55,
        maxSmi: -40,
        maxBbLowerGapPct: 0.8,
      },
      /** High-band biggest movers: mid SMI OK, wider BB lower. */
      buyExtended: {
        requireNegativeSmi: false,
        maxSmi: 40,
        maxBbLowerGapPct: 1.5,
      },
      /** Mid/low SELL: RSI elevated, SMI ≥ 40, BB upper. */
      sellQuality: {
        minRsi: 50,
        maxRsi: 75,
        minSmi: 40,
        maxBbUpperGapPct: 0.8,
      },
      buyGuards: {
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarConfirmation: true,
        maxOpenDrawdownPct: 0.8,
      },
      sellCascade: {
        enabled: true,
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarLower: true,
        minOpenDrawdownPct: null,
      },
      sellGuards: {
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarConfirmation: true,
        maxOpenRallyPct: 0.8,
      },
      buyCascade: {
        enabled: true,
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarHigher: true,
        minOpenRallyPct: null,
      },
    },
    ruleIcicigi: {
      tradingSymbol: "ICICIGI",
      displayName: "RuleICICIGI",
      sector: "Insurance",
      sessionStart: "09:15",
      sessionEnd: "15:30",
      entryDeadlineIst: "14:00",
      smi: { lengthK: 10, lengthD: 3, lengthEma: 10 },
      buyQuality: {
        minRsi: 30,
        maxRsi: 50,
        maxSmi: -40,
        maxBbLowerGapPct: 0.7,
      },
      buyExtended: {
        requireNegativeSmi: true,
        maxSmi: 0,
        maxBbLowerGapPct: 1.0,
      },
      /**
       * Falling-knife guards (2026-07-29 loss study): require SMI + MACD hist
       * turn-up, next-bar mid confirmation, and skip if already down >0.8% from open.
       */
      buyGuards: {
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarConfirmation: true,
        maxOpenDrawdownPct: 0.8,
      },
      /**
       * Flip the same falling-knife print into a SELL: oversold BUY-quality levels
       * with SMI+MACD still falling and next mid lower → enter on confirm bar.
       * 60d Yahoo study: ~19 signals, ~84% best-SQ positive (incl. 29 Jul +1.5%).
       */
      sellCascade: {
        enabled: true,
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarLower: true,
        minOpenDrawdownPct: null,
      },
      sellGuards: {
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarConfirmation: true,
        maxOpenRallyPct: 0.8,
      },
      buyCascade: {
        enabled: true,
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarHigher: true,
        minOpenRallyPct: null,
      },
      sellQuality: {
        minRsi: 45,
        maxRsi: 75,
        minSmi: 20,
        maxBbUpperGapPct: 1.0,
      },
    },
    ruleTechm: {
      tradingSymbol: "TECHM",
      displayName: "RuleTECHM",
      sector: "IT",
      sessionStart: "09:15",
      sessionEnd: "15:30",
      entryDeadlineIst: "14:00",
      smi: { lengthK: 10, lengthD: 3, lengthEma: 10 },
      /** Low-band BUY quality is the clearest oversold setup. */
      buyQuality: {
        minRsi: 20,
        maxRsi: 45,
        maxSmi: -40,
        maxBbLowerGapPct: 0.7,
      },
      buyExtended: {
        requireNegativeSmi: false,
        maxSmi: 40,
        maxBbLowerGapPct: 2.2,
      },
      sellQuality: {
        minRsi: 50,
        maxRsi: 80,
        minSmi: 40,
        maxBbUpperGapPct: 1.0,
      },
      buyGuards: {
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarConfirmation: true,
        maxOpenDrawdownPct: 0.8,
      },
      sellCascade: {
        enabled: true,
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarLower: true,
        minOpenDrawdownPct: null,
      },
      sellGuards: {
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarConfirmation: true,
        maxOpenRallyPct: 0.8,
      },
      buyCascade: {
        enabled: true,
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarHigher: true,
        minOpenRallyPct: null,
      },
    },
    ruleTvsmotor: {
      tradingSymbol: "TVSMOTOR",
      displayName: "RuleTVSMOTOR",
      sector: "Automobile",
      sessionStart: "09:15",
      sessionEnd: "15:30",
      entryDeadlineIst: "14:00",
      smi: { lengthK: 10, lengthD: 3, lengthEma: 10 },
      buyQuality: {
        minRsi: 30,
        maxRsi: 55,
        maxSmi: -30,
        maxBbLowerGapPct: 0.6,
      },
      buyExtended: {
        requireNegativeSmi: false,
        maxSmi: 40,
        maxBbLowerGapPct: 1.4,
      },
      sellQuality: {
        minRsi: 55,
        maxRsi: 75,
        minSmi: 40,
        maxBbUpperGapPct: 0.7,
      },
      buyGuards: {
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarConfirmation: true,
        maxOpenDrawdownPct: 0.8,
      },
      sellCascade: {
        enabled: true,
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarLower: true,
        minOpenDrawdownPct: null,
      },
      sellGuards: {
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarConfirmation: true,
        maxOpenRallyPct: 0.8,
      },
      buyCascade: {
        enabled: true,
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarHigher: true,
        minOpenRallyPct: null,
      },
    },
    rulePolicybzr: {
      tradingSymbol: "POLICYBZR",
      displayName: "RulePOLICYBZR",
      sector: "Insurance",
      sessionStart: "09:15",
      sessionEnd: "15:30",
      entryDeadlineIst: "14:00",
      smi: { lengthK: 10, lengthD: 3, lengthEma: 10 },
      buyQuality: {
        minRsi: 25,
        maxRsi: 55,
        maxSmi: -25,
        maxBbLowerGapPct: 1.0,
      },
      /** Q4 2025: mid-SMI extended BUYs improved positive-% vs negative-only. */
      buyExtended: {
        requireNegativeSmi: false,
        maxSmi: 40,
        maxBbLowerGapPct: 1.6,
      },
      /** Q4 2025: raise SMI floor (40→60); weak SMI≥40 sells were only ~60% positive. */
      sellQuality: {
        minRsi: 55,
        maxRsi: 85,
        minSmi: 60,
        maxBbUpperGapPct: 0.7,
      },
      buyGuards: {
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarConfirmation: true,
        maxOpenDrawdownPct: 0.8,
      },
      sellCascade: {
        enabled: true,
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarLower: true,
        minOpenDrawdownPct: null,
      },
      sellGuards: {
        requireSmiFalling: true,
        requireMacdHistFalling: true,
        requireNextBarConfirmation: true,
        maxOpenRallyPct: 0.8,
      },
      buyCascade: {
        enabled: true,
        requireSmiRising: true,
        requireMacdHistRising: true,
        requireNextBarHigher: true,
        minOpenRallyPct: null,
      },
    },
  },

  volume: {
    smaPeriod: 20,
    spikeThreshold: 1.5,
    dryUpThreshold: 0.7,
    directionLookback: 5,
  },

  depth: {
    imbalanceBullish: 1.2,
    imbalanceBearish: 0.8,
    wallThresholdQty: 10_000,
    tightSpreadPct: 0.1,
    wallProximityPct: 0.5,
    nearLevels: 5,
  },

  confidence: {
    technicalWeight: 0.6,
    volumeWeight: 0.25,
    depthWeight: 0.15,
    historicalTechnicalWeight: 0.7,
    historicalVolumeWeight: 0.3,
    strongMin: 75,
    moderateMin: 50,
    weakMin: 25,
  },

  minCandlesRequired: 26 + 9 + 20,

  symbolBatchDelayMs: readEnvNumber("SYMBOL_BATCH_DELAY_MS", 100),
  dayScanConcurrency: readEnvNumber("DAY_SCAN_CONCURRENCY", 4),
  dayScanSymbolTimeoutMs: readEnvNumber("DAY_SCAN_SYMBOL_TIMEOUT_MS", 0),
  dayScanFailFastOnAuthError: readEnvBoolean("DAY_SCAN_FAIL_FAST_ON_AUTH", true),
  dayScanKiteRetries: readEnvNumber("DAY_SCAN_KITE_RETRIES", 1),
} as const;

export type AppConfig = typeof config;

export function getKiteRedirectUrl(): string {
  if (config.kite.redirectUrl) {
    return config.kite.redirectUrl;
  }
  return `${config.kite.apiBaseUrl}/api/kite/callback`;
}

export function getKiteAppUrl(): string {
  return config.kite.appUrl || "http://localhost:5173";
}

export function assertKiteApiKeys(): void {
  const missing: string[] = [];

  if (!config.kite.apiKey) {
    missing.push("KITE_API_KEY");
  }
  if (!config.kite.apiSecret) {
    missing.push("KITE_API_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Kite API keys. Set ${missing.join(", ")} in .env.`,
    );
  }
}

export function assertKiteCredentials(): void {
  assertKiteApiKeys();

  const token = config.kite.accessToken.trim();
  if (
    !token ||
    token === "your_daily_access_token" ||
    token === "your_access_token"
  ) {
    throw new Error(
      "Missing Kite access token. Connect via /api/kite/login or set KITE_ACCESS_TOKEN in .env.",
    );
  }
}

export function assertSamcoApiKeys(): void {
  const missing: string[] = [];

  if (!config.samco.apiKey) {
    missing.push("SAMCO_API_KEY");
  }
  if (!config.samco.apiSecret) {
    missing.push("SAMCO_API_SECRET");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Samco API keys. Set ${missing.join(", ")} in .env.`,
    );
  }
}
