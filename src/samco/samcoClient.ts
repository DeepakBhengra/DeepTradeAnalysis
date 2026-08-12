import { config } from "../config.js";
import {
  clearSamcoSessionToken,
  getSamcoSessionToken,
  hasValidSamcoSessionToken,
  persistSamcoSessionTokenToEnv,
  setSamcoSessionToken,
} from "./samcoTokenStore.js";
import { assertSamcoEgressIpForLiveOrders } from "./samcoStaticIp.js";

export type SamcoFetch = typeof fetch;

let samcoFetch: SamcoFetch = globalThis.fetch.bind(globalThis);

export function setSamcoFetch(fetchFn: SamcoFetch): void {
  samcoFetch = fetchFn;
}

export function resetSamcoFetch(): void {
  samcoFetch = globalThis.fetch.bind(globalThis);
}

export interface SamcoApiErrorBody {
  status?: string;
  statusMessage?: string;
  message?: string;
  rejectionReason?: string;
  error?: string;
  errorMessage?: string;
}

export function formatSamcoApiErrorMessage(
  statusCode: number,
  body: SamcoApiErrorBody | string,
): string {
  if (typeof body === "string") {
    const trimmed = body.trim();
    return trimmed || `Samco API error (${statusCode})`;
  }

  const parts = [
    body.statusMessage,
    body.rejectionReason,
    body.message,
    body.errorMessage,
    body.error,
  ].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  );
  if (parts.length > 0) {
    return parts.join(" — ");
  }

  try {
    const json = JSON.stringify(body);
    if (json && json !== "{}") {
      return `Samco API error (${statusCode}): ${json}`;
    }
  } catch {
    // ignore serialization failures
  }

  return `Samco API error (${statusCode})`;
}

export class SamcoApiError extends Error {
  readonly statusCode: number;
  readonly body: SamcoApiErrorBody | string;

  constructor(statusCode: number, body: SamcoApiErrorBody | string) {
    super(formatSamcoApiErrorMessage(statusCode, body));
    this.name = "SamcoApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

/** True when Samco rejected the call because the trading session is missing/expired. */
export function isSamcoSessionAuthError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const normalized = message.toLowerCase();
  if (
    normalized.includes("trading session is missing") ||
    normalized.includes("session is missing") ||
    normalized.includes("invalid session") ||
    normalized.includes("session expired") ||
    normalized.includes("generate a fresh session") ||
    (normalized.includes("session token") && normalized.includes("expired"))
  ) {
    return true;
  }

  if (error instanceof SamcoApiError) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return true;
    }
    const bodyMessage =
      typeof error.body === "string"
        ? error.body
        : [
            error.body.statusMessage,
            error.body.message,
            error.body.errorMessage,
            error.body.error,
          ]
            .filter((part): part is string => typeof part === "string")
            .join(" ");
    const bodyNormalized = bodyMessage.toLowerCase();
    return (
      bodyNormalized.includes("trading session is missing") ||
      bodyNormalized.includes("unauthorized") ||
      bodyNormalized.includes("generate a fresh session")
    );
  }

  return normalized.includes("unauthorized");
}

export interface SamcoSessionTokenResponse {
  status?: string;
  statusMessage?: string;
  sessionToken?: string;
  accountID?: string;
  accountName?: string;
}

export interface SamcoWhoAmIResponse {
  status?: string;
  statusMessage?: string;
  srcIp?: string;
  primaryIp?: string;
  secondaryIp?: string;
}

export interface SamcoPlaceOrderRequest {
  symbolName: string;
  exchange: string;
  transactionType: "BUY" | "SELL";
  orderType: string;
  quantity: string;
  disclosedQuantity?: string;
  orderValidity: string;
  productType: string;
  afterMarketOrderFlag: string;
  price?: string;
}

export interface SamcoPlaceOrderResponse {
  status?: string;
  statusMessage?: string;
  orderNumber?: string;
  exchangeOrderStatus?: string;
  orderDetails?: {
    filledQuantity?: string;
    avgExecutionPrice?: string;
    tradingSymbol?: string;
    transactionType?: string;
    productType?: string;
    orderPrice?: string;
  };
}

export interface SamcoOrderStatusResponse {
  status?: string;
  statusMessage?: string;
  orderNumber?: string;
  orderStatus?: string;
  orderDetails?: {
    pendingQuantity?: string;
    avgExecutionPrice?: string;
    filledQuantity?: string;
    tradingSymbol?: string;
    transactionType?: string;
    productType?: string;
    orderPrice?: string;
  };
}

export interface SamcoPositionDetail {
  exchange?: string;
  tradingSymbol?: string;
  productCode?: string;
  netQuantity?: string;
  transactionType?: string;
  positionType?: string;
}

export interface SamcoPositionsResponse {
  status?: string;
  statusMessage?: string;
  positionDetails?: SamcoPositionDetail[];
}

export interface SamcoSquareOffRequestItem {
  exchange: string;
  symbolName: string;
  productType: string;
  netQuantity: string;
  transactionType: "BUY" | "SELL";
}

export interface SamcoSquareOffResponse {
  status?: string;
  statusMessage?: string;
  positionSquareOffResponseList?: Array<{
    status?: string;
    statusMessage?: string;
  }>;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SamcoApiError(response.status, text);
  }
}

async function samcoRequest<T>(
  method: "GET" | "POST",
  path: string,
  options?: {
    body?: unknown;
    query?: Record<string, string>;
    sessionToken?: string;
  },
): Promise<T> {
  const url = new URL(path, config.samco.baseUrl);
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const token = options?.sessionToken ?? getSamcoSessionToken();
  if (token) {
    headers["x-session-token"] = token;
  }

  const response = await samcoFetch(url.toString(), {
    method,
    headers,
    body: options?.body == null ? undefined : JSON.stringify(options.body),
  });

  const payload = await parseJsonResponse<T & SamcoApiErrorBody>(response);
  if (!response.ok) {
    throw new SamcoApiError(response.status, payload);
  }

  if (payload.status === "Failure") {
    throw new SamcoApiError(400, payload);
  }

  return payload;
}

/**
 * Authenticated Samco call: ensure a token exists, and on session-missing /
 * Unauthorized clear the stale token, regenerate once, then retry.
 */
async function samcoAuthedRequest<T>(
  method: "GET" | "POST",
  path: string,
  options?: {
    body?: unknown;
    query?: Record<string, string>;
  },
): Promise<T> {
  await ensureSamcoSessionToken();
  try {
    return await samcoRequest<T>(method, path, options);
  } catch (error) {
    if (!isSamcoSessionAuthError(error)) {
      throw error;
    }

    clearSamcoSessionToken();
    await generateSamcoSessionToken();
    return samcoRequest<T>(method, path, options);
  }
}

export async function generateSamcoSessionToken(): Promise<SamcoSessionTokenResponse> {
  const payload = await samcoRequest<SamcoSessionTokenResponse>(
    "POST",
    "/session/token",
    {
      body: {
        apiKey: config.samco.apiKey,
        apiSecret: config.samco.apiSecret,
      },
    },
  );

  if (!payload.sessionToken) {
    throw new Error("Samco session token response did not include sessionToken.");
  }

  setSamcoSessionToken(payload.sessionToken);
  persistSamcoSessionTokenToEnv(payload.sessionToken);
  return payload;
}

export async function ensureSamcoSessionToken(): Promise<string> {
  if (hasValidSamcoSessionToken()) {
    return getSamcoSessionToken();
  }

  const session = await generateSamcoSessionToken();
  return session.sessionToken ?? "";
}

export async function refreshSamcoSessionToken(): Promise<SamcoSessionTokenResponse> {
  clearSamcoSessionToken();
  return generateSamcoSessionToken();
}

export async function getSamcoWhoAmI(): Promise<SamcoWhoAmIResponse> {
  return samcoAuthedRequest<SamcoWhoAmIResponse>("GET", "/ip/whoami");
}

export async function placeSamcoOrder(
  request: SamcoPlaceOrderRequest,
): Promise<SamcoPlaceOrderResponse> {
  await assertSamcoEgressIpForLiveOrders();
  return samcoAuthedRequest<SamcoPlaceOrderResponse>("POST", "/order/placeOrder", {
    body: request,
  });
}

export async function getSamcoOrderStatus(
  orderNumber: string,
): Promise<SamcoOrderStatusResponse> {
  return samcoAuthedRequest<SamcoOrderStatusResponse>("GET", "/order/getOrderStatus", {
    query: { orderNumber },
  });
}

export async function getSamcoPositions(
  positionType = "DAY",
): Promise<SamcoPositionsResponse> {
  return samcoAuthedRequest<SamcoPositionsResponse>("GET", "/position/getPositions", {
    query: { positionType },
  });
}

export async function squareOffSamcoPositions(
  requests: SamcoSquareOffRequestItem[],
): Promise<SamcoSquareOffResponse> {
  await assertSamcoEgressIpForLiveOrders();
  return samcoAuthedRequest<SamcoSquareOffResponse>("POST", "/position/squareOff", {
    body: { positionSquareOffRequestList: requests },
  });
}

const FILLED_ORDER_STATUSES = new Set([
  "EXECUTED",
  "COMPLETE",
  "COMPLETED",
]);

const TERMINAL_ORDER_STATUSES = new Set([
  ...FILLED_ORDER_STATUSES,
  "REJECTED",
  "CANCELLED",
  "CANCELED",
]);

export function isSamcoOrderFilled(status: string | undefined): boolean {
  if (!status) {
    return false;
  }
  return FILLED_ORDER_STATUSES.has(status.toUpperCase());
}

export function isSamcoOrderTerminal(status: string | undefined): boolean {
  if (!status) {
    return false;
  }
  return TERMINAL_ORDER_STATUSES.has(status.toUpperCase());
}

export async function waitForSamcoOrderFill(
  orderNumber: string,
  options?: { timeoutMs?: number; pollIntervalMs?: number },
): Promise<SamcoOrderStatusResponse> {
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const pollIntervalMs = options?.pollIntervalMs ?? 1_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await getSamcoOrderStatus(orderNumber);
    if (isSamcoOrderTerminal(status.orderStatus)) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for Samco order ${orderNumber} to fill.`);
}
