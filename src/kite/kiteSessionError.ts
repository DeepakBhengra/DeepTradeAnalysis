import { formatUnknownError } from "../utils/formatError.js";

export const KITE_AUTH_ERROR =
  "Kite access_token expired or invalid. Generate a new token and update KITE_ACCESS_TOKEN in .env.";

export const KITE_TOKEN_REJECTED_ERROR =
  "Kite rejected this access token (incorrect api_key or access_token). Click Login via Zerodha to generate today's token. Do not paste request_token, PIN, or an instrument id.";

function kiteErrorFields(error: unknown): {
  status?: unknown;
  errorType: string;
  message: string;
} {
  if (typeof error !== "object" || error === null) {
    return { errorType: "", message: formatUnknownError(error) };
  }

  const record = error as {
    status?: unknown;
    error_type?: unknown;
    message?: unknown;
  };

  return {
    status: record.status,
    errorType: typeof record.error_type === "string" ? record.error_type : "",
    message: formatUnknownError(error),
  };
}

export function isKiteAuthError(error: unknown): boolean {
  const { status, errorType, message } = kiteErrorFields(error);
  if (status === 401 || status === 403 || errorType === "TokenException") {
    return true;
  }

  const lower = message.toLowerCase();
  return (
    lower.includes("token") ||
    lower.includes("unauthorized") ||
    lower.includes("access denied") ||
    lower.includes("api_key") ||
    lower.includes("kite not connected")
  );
}

export function describeKiteSessionError(error: unknown): string {
  if (isKiteAuthError(error)) {
    const { message } = kiteErrorFields(error);
    if (/valid kite access token|kite not connected/i.test(message)) {
      return message;
    }
    return KITE_TOKEN_REJECTED_ERROR;
  }

  return formatUnknownError(error);
}

export function httpStatusForKiteFailure(
  error: unknown,
  kind: "token" | "data",
): number {
  if (!isKiteAuthError(error)) {
    return 500;
  }

  return kind === "token" ? 400 : 401;
}
