import { KiteConnect } from "kiteconnect";
import type { Connect, HistoricalData, Instrument } from "kiteconnect";
import {
  assertKiteApiKeys,
  config,
  dashboardSymbols,
  type DashboardSymbolConfig,
} from "../config.js";
import { getActiveKiteAccessToken } from "../kite/kiteAuth.js";
import { applySymbolAlias, getSymbolAliasHint } from "../symbols/aliases.js";
import type { Candle } from "../types.js";
import { formatUnknownError } from "../utils/formatError.js";

export interface ChartQueryOptions {
  symbol?: string;
  exchange?: string;
  segment?: string;
  interval?: "15m";
  range?: "5d" | "1mo" | "3mo";
  analysisDate?: string;
  fromDate?: string;
  toDate?: string;
  kiteRetries?: number;
}

const KITE_AUTH_ERROR =
  "Kite access_token expired or invalid. Generate a new token and update KITE_ACCESS_TOKEN in .env.";

const cachedInstrumentTokens = new Map<string, number>();
const cachedInstrumentsByExchange = new Map<string, Instrument[]>();
const instrumentsLoadPromises = new Map<string, Promise<Instrument[]>>();

let sharedKiteClient: Connect | null = null;

class KiteRequestSemaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
    this.active += 1;
  }

  release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

const kiteRequestSemaphore = new KiteRequestSemaphore(config.kite.maxConcurrentRequests);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getKiteClient(): Connect {
  if (!sharedKiteClient) {
    sharedKiteClient = createKiteClient();
  } else {
    sharedKiteClient.setAccessToken(getActiveKiteAccessToken());
  }

  return sharedKiteClient;
}

function isTransientKiteError(error: unknown): boolean {
  if (isKiteAuthError(error)) {
    return false;
  }

  if (typeof error === "object" && error !== null) {
    const kiteError = error as {
      error_type?: string;
      message?: string;
      status?: number;
    };

    if (
      kiteError.error_type === "NetworkException" ||
      kiteError.error_type === "TooManyRequests"
    ) {
      return true;
    }

    if (
      kiteError.status === 429 ||
      kiteError.status === 503 ||
      kiteError.status === 504
    ) {
      return true;
    }

    const message = kiteError.message?.toLowerCase() ?? "";
    if (
      message.includes("econnaborted") ||
      message.includes("etimedout") ||
      message.includes("econnreset") ||
      message.includes("timeout") ||
      message.includes("socket hang up")
    ) {
      return true;
    }
  }

  return false;
}

async function withKiteRequestLimit<T>(operation: () => Promise<T>): Promise<T> {
  await kiteRequestSemaphore.acquire();
  try {
    return await operation();
  } finally {
    kiteRequestSemaphore.release();
  }
}

async function withKiteRetry<T>(
  operation: () => Promise<T>,
  maxAttemptsOverride?: number,
): Promise<T> {
  const maxAttempts = Math.max(
    1,
    maxAttemptsOverride ?? config.kite.requestRetries,
  );
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await withKiteRequestLimit(operation);
    } catch (error) {
      lastError = error;
      if (!isTransientKiteError(error) || attempt === maxAttempts) {
        throw error;
      }

      await delay(config.kite.retryDelayMs * attempt);
    }
  }

  throw lastError;
}

function instrumentCacheKey(
  exchange: string,
  tradingSymbol: string,
  segment: string,
): string {
  return `${exchange}:${tradingSymbol}:${segment}`;
}

function findDashboardSymbolByInput(symbol: string): DashboardSymbolConfig | undefined {
  const normalized = symbol.trim();

  return Object.values(dashboardSymbols).find(
    (entry) =>
      entry.symbol === normalized ||
      entry.tradingSymbol === normalized ||
      entry.id === normalized,
  );
}

function normalizeTradingSymbol(symbol: string): string {
  const registryMatch = findDashboardSymbolByInput(symbol);
  if (registryMatch) {
    return registryMatch.tradingSymbol;
  }

  if (symbol === config.symbol) {
    return config.tradingSymbol;
  }

  if (symbol.includes(":")) {
    return symbol.split(":")[1] ?? symbol;
  }

  if (symbol.endsWith(".NS")) {
    return symbol.slice(0, -3);
  }

  return applySymbolAlias(symbol);
}

function resolveSegment(
  tradingSymbol: string,
  segment?: string,
): string {
  if (segment) {
    return segment;
  }

  const registryMatch = Object.values(dashboardSymbols).find(
    (entry) => entry.tradingSymbol === tradingSymbol,
  );

  return registryMatch?.segment ?? "NSE";
}

function resolveExchange(
  tradingSymbol: string,
  exchange?: string,
): string {
  if (exchange) {
    return exchange;
  }

  const registryMatch = Object.values(dashboardSymbols).find(
    (entry) => entry.tradingSymbol === tradingSymbol,
  );

  return registryMatch?.exchange ?? config.exchange;
}

function rangeToDays(range: ChartQueryOptions["range"]): number {
  switch (range) {
    case "1mo":
      return 30;
    case "3mo":
      return 90;
    case "5d":
    default:
      return 5;
  }
}

function formatIstDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function getHistoricalWindow(range: ChartQueryOptions["range"]): {
  from: string;
  to: string;
} {
  const now = new Date();
  const days = rangeToDays(range);
  const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const from = formatIstDate(fromDate).replace(
    /\d{2}:\d{2}:\d{2}$/,
    "09:15:00",
  );

  return {
    from,
    to: formatIstDate(now),
  };
}

function getHistoricalWindowForDate(analysisDate: string): {
  from: string;
  to: string;
} {
  const warmupDays = config.sidewaysTrend.warmupDays;
  const analysisStart = new Date(`${analysisDate}T09:15:00+05:30`);
  const fromDate = new Date(
    analysisStart.getTime() - warmupDays * 24 * 60 * 60 * 1000,
  );
  const from = formatIstDate(fromDate).replace(/\d{2}:\d{2}:\d{2}$/, "09:15:00");

  return {
    from,
    to: `${analysisDate} 15:30:00`,
  };
}

function getHistoricalWindowForDateRange(fromDate: string, toDate: string): {
  from: string;
  to: string;
} {
  const warmupDays = config.sidewaysTrend.warmupDays;
  const rangeStart = new Date(`${fromDate}T09:15:00+05:30`);
  const warmedFrom = new Date(
    rangeStart.getTime() - warmupDays * 24 * 60 * 60 * 1000,
  );
  const from = formatIstDate(warmedFrom).replace(/\d{2}:\d{2}:\d{2}$/, "09:15:00");

  return {
    from,
    to: `${toDate} 15:30:00`,
  };
}

function resolveFetchWindow(options: ChartQueryOptions): { from: string; to: string } {
  if (options.fromDate && options.toDate) {
    return getHistoricalWindowForDateRange(options.fromDate, options.toDate);
  }

  if (options.analysisDate) {
    return getHistoricalWindowForDate(options.analysisDate);
  }

  return getHistoricalWindow(options.range ?? "5d");
}

export function createKiteClient(): Connect {
  assertKiteApiKeys();

  const kite = new KiteConnect({
    api_key: config.kite.apiKey,
    timeout: config.kite.requestTimeoutMs,
  });
  kite.setAccessToken(getActiveKiteAccessToken());
  return kite;
}

async function getExchangeInstruments(
  kite: Connect,
  exchange: string,
): Promise<Instrument[]> {
  const cached = cachedInstrumentsByExchange.get(exchange);
  if (cached) {
    return cached;
  }

  let inFlight = instrumentsLoadPromises.get(exchange);
  if (!inFlight) {
    inFlight = kite
      .getInstruments(exchange as Instrument["exchange"])
      .then((instruments) => {
        cachedInstrumentsByExchange.set(exchange, instruments);
        instrumentsLoadPromises.delete(exchange);
        return instruments;
      })
      .catch((error) => {
        instrumentsLoadPromises.delete(exchange);
        throw error;
      });
    instrumentsLoadPromises.set(exchange, inFlight);
  }

  return inFlight;
}

export async function warmKiteExchangeInstruments(exchange = "NSE"): Promise<void> {
  const kite = getKiteClient();
  await withKiteRetry(() => getExchangeInstruments(kite, exchange));
}

async function resolveInstrumentToken(
  kite: Connect,
  tradingSymbol: string,
  exchange: string,
  segment: string,
): Promise<number> {
  const cacheKey = instrumentCacheKey(exchange, tradingSymbol, segment);
  const cached = cachedInstrumentTokens.get(cacheKey);

  if (cached != null) {
    return cached;
  }

  if (
    tradingSymbol === config.tradingSymbol &&
    exchange === config.exchange &&
    segment === dashboardSymbols.pnb.segment &&
    config.kite.instrumentToken != null
  ) {
    cachedInstrumentTokens.set(cacheKey, config.kite.instrumentToken);
    return config.kite.instrumentToken;
  }

  const instruments = await getExchangeInstruments(kite, exchange);
  const match = instruments.find(
    (instrument) =>
      instrument.tradingsymbol === tradingSymbol &&
      instrument.segment === segment,
  );

  if (!match) {
    const aliasHint = getSymbolAliasHint(tradingSymbol);
    const suggestions = instruments
      .filter(
        (instrument) =>
          instrument.segment === segment &&
          instrument.instrument_type === "EQ" &&
          instrument.tradingsymbol.startsWith(tradingSymbol),
      )
      .slice(0, 3)
      .map((instrument) => instrument.tradingsymbol);

    let message = `Instrument not found: ${exchange}:${tradingSymbol} (segment ${segment})`;
    if (aliasHint) {
      message += `. Try "${aliasHint}" — that is the NSE ticker for this symbol.`;
    } else if (suggestions.length > 0) {
      message += `. Did you mean: ${suggestions.join(", ")}?`;
    } else {
      message += ". Use the official NSE trading symbol (e.g. SBIN for State Bank of India).";
    }

    throw new Error(message);
  }

  const token = Number(match.instrument_token);
  cachedInstrumentTokens.set(cacheKey, token);
  return token;
}

export function parseKiteDateAsIst(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }

  const trimmed = String(value).trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  return new Date(`${normalized}+05:30`);
}

function toCandle(record: HistoricalData): Candle | null {
  if (
    record.open == null ||
    record.high == null ||
    record.low == null ||
    record.close == null ||
    record.volume == null
  ) {
    return null;
  }

  return {
    timestamp: parseKiteDateAsIst(record.date),
    open: record.open,
    high: record.high,
    low: record.low,
    close: record.close,
    volume: record.volume,
  };
}

function isKiteAuthError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const kiteError = error as {
    status?: number;
    error_type?: string;
    message?: string;
  };

  if (kiteError.status === 401 || kiteError.error_type === "TokenException") {
    return true;
  }

  const message = kiteError.message?.toLowerCase() ?? "";
  return (
    message.includes("token") ||
    message.includes("unauthorized") ||
    message.includes("access denied")
  );
}

function wrapKiteError(error: unknown): Error {
  if (isKiteAuthError(error)) {
    return new Error(KITE_AUTH_ERROR);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(formatUnknownError(error));
}

export async function fetchPnbCandles(
  options: ChartQueryOptions = {},
): Promise<Candle[]> {
  const tradingSymbol = normalizeTradingSymbol(
    options.symbol ?? config.tradingSymbol,
  );
  const exchange = resolveExchange(tradingSymbol, options.exchange);
  const segment = resolveSegment(tradingSymbol, options.segment);
  const interval = options.interval ?? config.interval;

  if (interval !== "15m") {
    throw new Error("Only 15m interval is supported");
  }

  const kite = getKiteClient();
  const kiteRetries = options.kiteRetries ?? config.kite.requestRetries;

  try {
    const instrumentToken = await withKiteRetry(
      () => resolveInstrumentToken(kite, tradingSymbol, exchange, segment),
      kiteRetries,
    );
    const { from, to } = resolveFetchWindow(options);
    const rows = await withKiteRetry(
      () =>
        kite.getHistoricalData(
          instrumentToken,
          "15minute",
          from,
          to,
          false,
          false,
        ),
      kiteRetries,
    );

    return rows
      .map((row: HistoricalData) => toCandle(row))
      .filter((candle): candle is Candle => candle !== null)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch (error) {
    throw wrapKiteError(error);
  }
}

export function getLatestClosedCandle(candles: Candle[]): Candle | undefined {
  if (candles.length === 0) {
    return undefined;
  }

  const last = candles[candles.length - 1];
  const now = Date.now();
  const candleEnd = last.timestamp.getTime() + 15 * 60 * 1000;

  if (candleEnd <= now) {
    return last;
  }

  return candles.length > 1 ? candles[candles.length - 2] : undefined;
}
