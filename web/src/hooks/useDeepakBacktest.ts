import { useCallback, useState } from "react";

import { fetchDeepakBacktest } from "../api/client";
import type { DeepakBacktestPayload } from "../types/backtest";

export function useDeepakBacktest() {
  const [data, setData] = useState<DeepakBacktestPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (symbol: string, fromDate: string, toDate: string) => {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) {
      setError("Enter a valid symbol.");
      return;
    }

    if (!fromDate || !toDate) {
      setError("Select both from and to dates.");
      return;
    }

    if (fromDate > toDate) {
      setError("From date must be on or before to date.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = await fetchDeepakBacktest(normalized, fromDate, toDate);
      setData(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, run };
}
