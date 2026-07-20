import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboard } from "../api/client";
import type { DashboardPayload } from "../types/dashboard";

const POLL_INTERVAL_MS = 60_000;

function payloadMatchesDate(
  payload: DashboardPayload,
  requestedDate: string | null,
): boolean {
  const payloadDate = payload.analysisDate ?? null;
  return payloadDate === requestedDate;
}

function mismatchMessage(
  payload: DashboardPayload,
  requestedDate: string | null,
): string {
  const payloadDate = payload.analysisDate ?? null;

  if (requestedDate != null && payloadDate == null) {
    return (
      "Historical backtesting requires a restarted API server. " +
      "Stop any process on port 3001, then run: npm run dev:dashboard"
    );
  }

  return `Dashboard date mismatch: expected ${requestedDate ?? "live"}, received ${payloadDate ?? "live"}.`;
}

export function useDashboardData(
  symbol: string,
  analysisDate: string | null,
) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      const payload = await fetchDashboard(symbol, analysisDate);

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!payloadMatchesDate(payload, analysisDate)) {
        setData(null);
        setError(mismatchMessage(payload, analysisDate));
        return;
      }

      setData(payload);
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setData(null);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [symbol, analysisDate]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    void refresh();

    if (analysisDate) {
      return;
    }

    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [refresh, analysisDate]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}
