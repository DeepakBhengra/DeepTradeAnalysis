import { useCallback, useEffect, useRef, useState } from "react";

import { fetchLiveOrderBook } from "../api/client";
import type { OrderBookSnapshot } from "../types/orderBook";

const POLL_INTERVAL_MS = 5_000;

export function useLiveOrderBook(symbol: string | null, enabled: boolean) {
  const [data, setData] = useState<OrderBookSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!symbol || !enabled) {
      return;
    }

    const requestId = ++requestIdRef.current;

    try {
      const snapshot = await fetchLiveOrderBook(symbol);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setData(snapshot);
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [symbol, enabled]);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!symbol || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      requestIdRef.current += 1;
      clearInterval(timer);
    };
  }, [symbol, enabled, refresh]);

  return { data, loading, error, refresh };
}
