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
    smi: {
      lengthK: 10,
      lengthD: 3,
      lengthEma: 3,
    },
    /** SMI overbought threshold (Kite shaded zone ~40) — SELL path */
    overboughtLevel: 40,
    /**
     * Require a deep overbought peak in lookback (chart-quality filter).
     * 65 (not 70) absorbs typical Kite vs chart/Yahoo 15m OHLC SMI drift of ~5–7 pts
     * so pink-circle days like SUNPHARMA 25/29 Jun still qualify on live Kite data.
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
    /** Max body/range to treat a post-cross candle as stall/doji */
    stallBodyRatioMax: 0.35,
    /**
     * Exclusive IST deadline for the deeppro event candle.
     * Late entries disproportionately land in the weak 0.08–0.25% same-day band;
     * mid/high bands (0.30–0.70, 0.75–2.0) cluster earlier in the session.
     */
    entryDeadlineIst: "14:00",
    /**
     * Min |Δ MACD histogram| / close * 100 on the SMI cross bar.
     * Price-normalized so PNB and TCS share one threshold; filters weak fades
     * that rarely reach the 0.30%+ square-off bands.
     */
    minMacdHistDeltaPct: 0.01,
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
