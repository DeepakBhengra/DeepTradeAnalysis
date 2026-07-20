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
