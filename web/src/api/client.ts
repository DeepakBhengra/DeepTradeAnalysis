import type { Decision, DashboardPayload } from "../types/dashboard";

export type { Decision, DashboardPayload };

import type { DeepakBacktestPayload } from "../types/backtest";
import type {
  DeepakDayScanPayload,
  DeepakWatchPartyDayScanPayload,
  DayScanSimulationPayload,
} from "../types/backtest";
import type {
  PostMortemReportCache,
  PostMortemSignalDaysCache,
} from "../types/postMortemCache";
import type { DeepakPostMortemReport, PostMortemVariant } from "../types/postMortem";
import type { DashboardSeriesPoint } from "../types/dashboard";
import type { SignalDayOption } from "../utils/signalDaysFromTrades";
import { formatNetworkFetchError, readApiErrorBody } from "../utils/formatError";
import { FAVOURABLE_RULE_LABEL, FAVOURABLE_RULE_SLUG } from "../utils/favourableSymbolRule";

export {
  FAVOURABLE_RULE_LABEL,
  FAVOURABLE_RULE_SLUG,
  FAVOURABLE_RULE_SYMBOL,
  isFavourableSymbolRuleVariant,
  type FavourableSymbolRuleVariant,
} from "../utils/favourableSymbolRule";

export type DashboardId = "pnb" | "niftyBank";

/** Day scans fetch ~100 symbols in batches; allow up to 25 minutes under Kite rate limits. */
const DAY_SCAN_REQUEST_TIMEOUT_MS = 1_500_000;
const API_HEALTH_TIMEOUT_MS = 8_000;

export class ScanStoppedError extends Error {
  constructor() {
    super("Scan stopped.");
    this.name = "ScanStoppedError";
  }
}

function linkAbortSignal(userSignal?: AbortSignal): AbortController {
  const linked = new AbortController();
  if (!userSignal) {
    return linked;
  }
  if (userSignal.aborted) {
    linked.abort();
    return linked;
  }
  userSignal.addEventListener("abort", () => linked.abort(), { once: true });
  return linked;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number,
  timeoutMessage: string,
  userSignal?: AbortSignal,
): Promise<T> {
  const linked = linkAbortSignal(userSignal);
  const timeout = setTimeout(() => linked.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: linked.signal });
    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          response.status === 500
            ? "Cannot reach the API server on port 3001. Restart with: npm run dev:dashboard (API + web), then retry."
            : `Request failed: ${response.status}`,
        );
      }
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      throw new Error(readApiErrorBody(body, `Request failed: ${response.status}`));
    }
    return response.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      if (userSignal?.aborted) {
        throw new ScanStoppedError();
      }
      throw new Error(timeoutMessage);
    }
    throw new Error(formatNetworkFetchError(err, "request failed"));
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDashboard(
  symbol: string = "pnb",
  analysisDate?: string | null,
): Promise<DashboardPayload> {
  const params = new URLSearchParams({ symbol });
  if (analysisDate != null && analysisDate.length > 0) {
    params.set("date", analysisDate);
  }

  const url = `/api/dashboard?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      throw new Error(readApiErrorBody(body, `Dashboard request failed: ${response.status}`));
    }
    return response.json() as Promise<DashboardPayload>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Dashboard request timed out after 120s. Check Kite credentials and API server.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDashboardSimulation(
  symbol: string,
  analysisDate: string,
  sessionIndex: number,
): Promise<DashboardPayload> {
  const params = new URLSearchParams({
    symbol,
    date: analysisDate,
    sessionIndex: String(sessionIndex),
  });

  const url = `/api/dashboard/simulate?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      throw new Error(readApiErrorBody(body, `Simulation request failed: ${response.status}`));
    }
    return response.json() as Promise<DashboardPayload>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Simulation request timed out after 120s. Check Kite credentials and API server.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDeepakBacktest(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<DeepakBacktestPayload> {
  const params = new URLSearchParams({
    symbol,
    from: fromDate,
    to: toDate,
  });

  const url = `/api/backtest/deepak?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = readApiErrorBody(body, `Backtest request failed: ${response.status}`);
      if (message.includes("API route not found")) {
        throw new Error(
          "Backtest API not available. Stop any old server on port 3001 and restart with: npm run dev:dashboard",
        );
      }
      throw new Error(message);
    }
    return response.json() as Promise<DeepakBacktestPayload>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Backtest request timed out after 120s. Check Kite credentials and API server.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDeepak2Backtest(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<DeepakBacktestPayload> {
  const params = new URLSearchParams({
    symbol,
    from: fromDate,
    to: toDate,
  });

  const url = `/api/backtest/deepak-2?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = readApiErrorBody(body, `Backtest request failed: ${response.status}`);
      if (message.includes("API route not found")) {
        throw new Error(
          "Backtest API not available. Stop any old server on port 3001 and restart with: npm run dev:dashboard",
        );
      }
      throw new Error(message);
    }
    return response.json() as Promise<DeepakBacktestPayload>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Backtest request timed out after 120s. Check Kite credentials and API server.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchDeepproBacktest(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<DeepakBacktestPayload> {
  const params = new URLSearchParams({
    symbol,
    from: fromDate,
    to: toDate,
  });

  const url = `/api/backtest/deeppro?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = readApiErrorBody(body, `Backtest request failed: ${response.status}`);
      if (message.includes("API route not found")) {
        throw new Error(
          "Deeppro backtest API not available. Stop any old server on port 3001 and restart with: npm run dev:dashboard",
        );
      }
      throw new Error(message);
    }
    return response.json() as Promise<DeepakBacktestPayload>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Deeppro backtest request timed out after 120s. Check Kite credentials and API server.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchRulePnbBacktest(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<DeepakBacktestPayload> {
  const params = new URLSearchParams({
    symbol,
    from: fromDate,
    to: toDate,
  });

  const url = `/api/backtest/rule-pnb?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = readApiErrorBody(body, `Backtest request failed: ${response.status}`);
      if (message.includes("API route not found")) {
        throw new Error(
          "RulePNB backtest API not available. Stop any old server on port 3001 and restart with: npm run dev:dashboard",
        );
      }
      throw new Error(message);
    }
    return response.json() as Promise<DeepakBacktestPayload>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("RulePNB backtest request timed out after 120s. Check Kite credentials and API server.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchRuleSunpharmaBacktest(
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<DeepakBacktestPayload> {
  const params = new URLSearchParams({
    symbol,
    from: fromDate,
    to: toDate,
  });

  const url = `/api/backtest/rule-sunpharma?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = readApiErrorBody(body, `Backtest request failed: ${response.status}`);
      if (message.includes("API route not found")) {
        throw new Error(
          "RuleSUNPHARMA backtest API not available. Stop any old server on port 3001 and restart with: npm run dev:dashboard",
        );
      }
      throw new Error(message);
    }
    return response.json() as Promise<DeepakBacktestPayload>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        "RuleSUNPHARMA backtest request timed out after 120s. Check Kite credentials and API server.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchFavourableSymbolBacktest(
  ruleSlug: string,
  symbol: string,
  fromDate: string,
  toDate: string,
): Promise<DeepakBacktestPayload> {
  const params = new URLSearchParams({
    symbol,
    from: fromDate,
    to: toDate,
  });

  const url = `/api/backtest/symbol-rule/${encodeURIComponent(ruleSlug)}?${params.toString()}`;
  const variantKey = (
    Object.entries(FAVOURABLE_RULE_SLUG) as Array<
      [keyof typeof FAVOURABLE_RULE_SLUG, string]
    >
  ).find(([, slug]) => slug === ruleSlug)?.[0];
  const label = variantKey ? FAVOURABLE_RULE_LABEL[variantKey] : ruleSlug;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = readApiErrorBody(body, `Backtest request failed: ${response.status}`);
      if (message.includes("API route not found")) {
        throw new Error(
          `${label} backtest API not available. Stop any old server on port 3001 and restart with: npm run dev:dashboard`,
        );
      }
      throw new Error(message);
    }
    return response.json() as Promise<DeepakBacktestPayload>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `${label} backtest request timed out after 120s. Check Kite credentials and API server.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function assertApiReachable(): Promise<void> {
  await fetchJsonWithTimeout<{ ok: boolean }>(
    "/api/health",
    API_HEALTH_TIMEOUT_MS,
    "API health check timed out. The API server on port 3001 may be hung — restart with npm run dev:dashboard.",
  );
}

async function fetchDayScanPayload<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  try {
    await assertApiReachable();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Cannot reach the API server") ||
      message.includes("Request failed: 500") ||
      message.includes("timed out")
    ) {
      throw new Error(
        "Cannot reach the API server on port 3001. Restart with: npm run dev:dashboard, ensure Kite is connected, then retry the scan.",
      );
    }
    throw err;
  }

  try {
    return await fetchJsonWithTimeout<T>(
      url,
      DAY_SCAN_REQUEST_TIMEOUT_MS,
      `Day scan timed out after ${DAY_SCAN_REQUEST_TIMEOUT_MS / 60_000} minutes. Kite may be slow — retry, or refresh KITE_ACCESS_TOKEN in .env.`,
      signal,
    );
  } catch (err) {
    if (err instanceof ScanStoppedError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("API route not found")) {
      throw new Error(
        "Day scan API not available (missing deeppro/deepak route). Stop any old server on port 3001 and restart with: npm run dev:dashboard",
      );
    }
    throw err;
  }
}

export async function fetchDeepakDayScan(
  date: string,
  signal?: AbortSignal,
): Promise<DeepakDayScanPayload> {
  const params = new URLSearchParams({ date });
  const url = `/api/backtest/deepak/day-scan?${params.toString()}`;
  return fetchDayScanPayload<DeepakDayScanPayload>(url, signal);
}

export async function fetchDeepak2DayScan(
  date: string,
  signal?: AbortSignal,
): Promise<DeepakDayScanPayload> {
  const params = new URLSearchParams({ date });
  const url = `/api/backtest/deepak-2/day-scan?${params.toString()}`;
  return fetchDayScanPayload<DeepakDayScanPayload>(url, signal);
}

export async function fetchDeepakWatchPartyDayScan(
  date: string,
  signal?: AbortSignal,
): Promise<DeepakWatchPartyDayScanPayload> {
  const params = new URLSearchParams({ date });
  const url = `/api/backtest/deepak-watch-party/day-scan?${params.toString()}`;
  return fetchDayScanPayload<DeepakWatchPartyDayScanPayload>(url, signal);
}

export async function fetchDeepak3DayScan(
  date: string,
  signal?: AbortSignal,
): Promise<DeepakDayScanPayload> {
  const params = new URLSearchParams({ date });
  const url = `/api/backtest/deepak-3/day-scan?${params.toString()}`;
  return fetchDayScanPayload<DeepakDayScanPayload>(url, signal);
}

export async function fetchDeepproDayScan(
  date: string,
  signal?: AbortSignal,
): Promise<DeepakDayScanPayload> {
  const params = new URLSearchParams({ date });
  const url = `/api/backtest/deeppro/day-scan?${params.toString()}`;
  return fetchDayScanPayload<DeepakDayScanPayload>(url, signal);
}

export async function fetchRulePnbDayScan(
  date: string,
  signal?: AbortSignal,
): Promise<DeepakDayScanPayload> {
  const params = new URLSearchParams({ date });
  const url = `/api/backtest/rule-pnb/day-scan?${params.toString()}`;
  return fetchDayScanPayload<DeepakDayScanPayload>(url, signal);
}

export async function fetchRuleSunpharmaDayScan(
  date: string,
  signal?: AbortSignal,
): Promise<DeepakDayScanPayload> {
  const params = new URLSearchParams({ date });
  const url = `/api/backtest/rule-sunpharma/day-scan?${params.toString()}`;
  return fetchDayScanPayload<DeepakDayScanPayload>(url, signal);
}

export async function fetchFavourableSymbolDayScan(
  ruleSlug: string,
  date: string,
  signal?: AbortSignal,
): Promise<DeepakDayScanPayload> {
  const params = new URLSearchParams({ date });
  const url = `/api/backtest/symbol-rule/${encodeURIComponent(ruleSlug)}/day-scan?${params.toString()}`;
  return fetchDayScanPayload<DeepakDayScanPayload>(url, signal);
}

export async function fetchDayScanSimulation(
  date: string,
  sessionIndex: number,
): Promise<DayScanSimulationPayload> {
  const params = new URLSearchParams({
    date,
    sessionIndex: String(sessionIndex),
  });

  const url = `/api/backtest/day-scan/simulate?${params.toString()}`;
  const timeoutMs = sessionIndex === 0 ? DAY_SCAN_REQUEST_TIMEOUT_MS : 120_000;

  try {
    return await fetchJsonWithTimeout<DayScanSimulationPayload>(
      url,
      timeoutMs,
      `Day scan simulation request timed out after ${timeoutMs / 1000}s. Initial load prefetches all watchlist symbols — try again, or check Kite credentials and API server.`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("API route not found")) {
      throw new Error(
        "Day scan simulation API not available. Stop any old server on port 3001 and restart with: npm run dev:dashboard",
      );
    }
    throw err;
  }
}

export async function fetchCachedPostMortemSignalDays(
  symbol: string,
  fromDate: string,
  toDate: string,
  variant: PostMortemVariant,
): Promise<PostMortemSignalDaysCache | null> {
  const params = new URLSearchParams({
    symbol,
    from: fromDate,
    to: toDate,
    variant,
  });
  const response = await fetch(`/api/post-mortem/signal-days?${params.toString()}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(readApiErrorBody(body, `HTTP ${response.status}`));
  }
  return (await response.json()) as PostMortemSignalDaysCache;
}

export async function savePostMortemSignalDays(input: {
  symbol: string;
  fromDate: string;
  toDate: string;
  variant: PostMortemVariant;
  days: SignalDayOption[];
  tradingDaysScanned: number;
  totalSignals: number;
}): Promise<PostMortemSignalDaysCache> {
  const response = await fetch("/api/post-mortem/signal-days", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(readApiErrorBody(body, `HTTP ${response.status}`));
  }
  return (await response.json()) as PostMortemSignalDaysCache;
}

export async function fetchCachedPostMortemReport(
  symbol: string,
  date: string,
  variant: PostMortemVariant,
): Promise<PostMortemReportCache | null> {
  const params = new URLSearchParams({ symbol, date, variant });
  const response = await fetch(`/api/post-mortem/report?${params.toString()}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(readApiErrorBody(body, `HTTP ${response.status}`));
  }
  return (await response.json()) as PostMortemReportCache;
}

export async function savePostMortemReport(input: {
  symbol: string;
  date: string;
  variant: PostMortemVariant;
  mode: string;
  report: DeepakPostMortemReport;
  series: DashboardSeriesPoint[];
}): Promise<{ savedAt: string }> {
  const response = await fetch("/api/post-mortem/report", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(readApiErrorBody(body, `HTTP ${response.status}`));
  }
  return (await response.json()) as { savedAt: string };
}
