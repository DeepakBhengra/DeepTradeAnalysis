export interface SamcoAuthStatus {
  connected: boolean;
  sessionTokenPresent: boolean;
  dryRun: boolean;
  liveTradingEnabled: boolean;
  baseUrl: string;
  productType: string;
  orderType: string;
  defaultQuantity: number;
  effectiveQuantity: number;
  settingsDateKey: string;
  envDefaultQuantity: number;
  envDefaultDryRun: boolean;
  openPositionsCount: number;
  srcIp?: string;
}

export interface SamcoRuntimeSettings {
  dateKey: string;
  quantity: number;
  effectiveQuantity: number;
  dryRun: boolean;
  entryPriceMin: number;
  entryPriceMax: number;
  ruleVariant: string;
  envDefaultQuantity: number;
  envDefaultDryRun: boolean;
  envDefaultEntryPriceMin: number;
  envDefaultEntryPriceMax: number;
  envDefaultRuleVariant: string;
  liveTradingEnabled: boolean;
}

export interface SamcoTradeLogRecord {
  id: string;
  timestamp: string;
  dateKey: string;
  level: "info" | "warn" | "error";
  message: string;
  signalKey?: string;
  dryRun: boolean;
  action?: "entry" | "exit" | "eod" | "reconcile";
}

export interface SamcoLogsResponse {
  dateKey: string;
  records: SamcoTradeLogRecord[];
}

export interface SamcoLedgerEntry {
  signalKey: string;
  strategy: string;
  tradingSymbol: string;
  stockName?: string;
  exchange: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number | null;
  limitPrice?: number | null;
  entryTimeIst: string;
  orderNumber: string | null;
  status: string;
  exitReason?: string;
  exitTimeIst?: string | null;
  exitPrice?: number | null;
  exitLimitPrice?: number | null;
  exitSide?: "BUY" | "SELL";
  closedAt?: string;
  lastError?: string;
  rejectedReason?: string;
  source?: string;
}

export interface SamcoLedger {
  version: number;
  updatedAt: string;
  entries: SamcoLedgerEntry[];
}

export interface SamcoOrderView {
  id: string;
  bucket: "open" | "executed" | "rejected";
  kind: "entry" | "exit";
  stockName: string;
  tradingSymbol: string;
  timing: string;
  side: "BUY" | "SELL";
  limitPrice: number | null;
  quantity: number;
  orderNumber: string | null;
  status: string;
  strategy: string;
  signalKey: string;
  reason?: string;
}

export interface SamcoOrdersResponse {
  open: SamcoOrderView[];
  executed: SamcoOrderView[];
  rejected: SamcoOrderView[];
  updatedAt: string;
  signalSource: {
    date: string | null;
    variant: string | null;
    tradeCount: number;
    runAt: string | null;
    isToday?: boolean;
  };
}

async function samcoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      cache: "no-store",
      ...init,
      headers: {
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      "Cannot reach the API on port 3001. Start both servers with: npm run dev:dashboard",
    );
  }

  if (!response.ok) {
    let message = `Samco request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchSamcoStatus(): Promise<SamcoAuthStatus> {
  return samcoFetch<SamcoAuthStatus>("/api/samco/status");
}

export async function fetchSamcoSettings(): Promise<SamcoRuntimeSettings> {
  return samcoFetch<SamcoRuntimeSettings>("/api/samco/settings");
}

export async function updateSamcoSettings(body: {
  dryRun?: boolean;
  quantity?: number;
  entryPriceMin?: number;
  entryPriceMax?: number;
  ruleVariant?: string;
  confirmLive?: boolean;
}): Promise<SamcoRuntimeSettings> {
  return samcoFetch<SamcoRuntimeSettings>("/api/samco/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function setSamcoLiveTrading(
  enabled: boolean,
  confirmLive = false,
): Promise<{ liveTradingEnabled: boolean }> {
  return samcoFetch<{ liveTradingEnabled: boolean }>("/api/samco/live-trading", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, confirmLive }),
  });
}

export async function refreshSamcoSession(): Promise<{
  connected: boolean;
  sessionTokenPresent: boolean;
}> {
  return samcoFetch("/api/samco/session/refresh", { method: "POST" });
}

export interface SamcoCycleResponse {
  ok: boolean;
  cleared?: boolean;
  cycle: {
    processed: boolean;
    signalSource: "dayscan" | "poll" | "none";
    entriesPlaced: number;
    exitsPlaced: number;
    eodSquareOff: boolean;
    stocksScanned: number;
    scanErrors: number;
  };
  orders: SamcoOrdersResponse;
  logs?: SamcoLogsResponse;
  status: SamcoAuthStatus;
}

/** Process one trading cycle and return fresh order buckets + auth status. */
export async function runSamcoTradingCycle(options?: {
  clearPrevious?: boolean;
  logDate?: string;
}): Promise<SamcoCycleResponse> {
  return samcoFetch<SamcoCycleResponse>("/api/samco/cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clearPrevious: options?.clearPrevious === true,
      logDate: options?.logDate,
    }),
  });
}

export async function fetchSamcoLedger(): Promise<SamcoLedger> {
  return samcoFetch<SamcoLedger>("/api/samco/ledger");
}

export async function fetchSamcoOrders(): Promise<SamcoOrdersResponse> {
  return samcoFetch<SamcoOrdersResponse>("/api/samco/orders");
}

export async function pushDayScanSignalsToSamco(body: {
  date: string;
  variant: string;
  runAt?: string;
  trades: Array<{
    tradingSymbol: string;
    symbol?: string;
    sector?: string;
    side: "BUY" | "SELL";
    scenarioNumber?: number;
    scenarioKey?: string;
    entryTimeIst: string;
    entryPrice: number;
    exitTimeIst?: string | null;
    exitPrice?: number | null;
    targetHit?: boolean;
    exitReason?: string | null;
    stopLossHit?: boolean;
  }>;
}): Promise<{
  ok: boolean;
  snapshot: unknown;
  materialize?: {
    mode: "full" | "current_candle" | "catch_up";
    entriesPlaced: number;
    exitsPlaced: number;
    entriesSkipped?: number;
  };
  settings?: SamcoRuntimeSettings;
}> {
  return samcoFetch("/api/samco/day-scan-signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchSamcoLogs(date?: string): Promise<SamcoLogsResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return samcoFetch<SamcoLogsResponse>(`/api/samco/logs${query}`);
}

export async function downloadSamcoLogs(
  date: string,
  format: "csv" | "json",
): Promise<void> {
  const query = new URLSearchParams({ date, format });
  const response = await fetch(`/api/samco/logs/download?${query.toString()}`);

  if (!response.ok) {
    let message = `Download failed: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `samco-logs-${date}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
