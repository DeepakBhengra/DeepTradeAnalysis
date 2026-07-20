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
  envDefaultQuantity: number;
  envDefaultDryRun: boolean;
  envDefaultEntryPriceMin: number;
  envDefaultEntryPriceMax: number;
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
  exchange: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number | null;
  entryTimeIst: string;
  orderNumber: string | null;
  status: string;
  exitReason?: string;
  closedAt?: string;
  lastError?: string;
}

export interface SamcoLedger {
  version: number;
  updatedAt: string;
  entries: SamcoLedgerEntry[];
}

async function samcoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, init);
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

export async function fetchSamcoLedger(): Promise<SamcoLedger> {
  return samcoFetch<SamcoLedger>("/api/samco/ledger");
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
