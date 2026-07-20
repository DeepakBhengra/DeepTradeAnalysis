export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    if (typeof record.message === "string" && record.message.length > 0) {
      if (typeof record.error_type === "string") {
        return `${record.error_type}: ${record.message}`;
      }
      return record.message;
    }

    if (typeof record.error === "string" && record.error.length > 0) {
      return record.error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export function readApiErrorBody(
  body: { error?: unknown } | null | undefined,
  fallback: string,
): string {
  if (body?.error == null) {
    return fallback;
  }

  return formatUnknownError(body.error);
}

/** Browser fetch() network failures surface as this generic message. */
export function formatNetworkFetchError(error: unknown, context: string): string {
  const message = formatUnknownError(error);
  const lower = message.toLowerCase();

  if (
    message === "Failed to fetch" ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("connection refused") ||
    lower.includes("econnrefused")
  ) {
    return `Cannot connect to the API server (${context}). Run npm run dev:dashboard in the project folder, wait for both API (port 3001) and web (port 5173) to start, then open http://localhost:5173.`;
  }

  return message;
}
