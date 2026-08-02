import { useCallback, useEffect, useRef, useState } from "react";

import { ScanStoppedError } from "../api/client";

type DayScanFetcher<T> = (date: string, signal: AbortSignal) => Promise<T>;

export function useCancellableDayScan<T>(fetchScan: DayScanFetcher<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingElapsedSec, setLoadingElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadingStartedAtRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setData(null);
    setLoading(false);
    setLoadingElapsedSec(0);
    setError(null);
    setInfo(null);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      loadingStartedAtRef.current = null;
      setLoadingElapsedSec(0);
      return;
    }

    loadingStartedAtRef.current = Date.now();
    const timer = window.setInterval(() => {
      if (loadingStartedAtRef.current) {
        setLoadingElapsedSec(
          Math.floor((Date.now() - loadingStartedAtRef.current) / 1000),
        );
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loading]);

  const run = useCallback(
    async (date: string) => {
      if (!date) {
        setError("Select a date.");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setLoading(true);
        setError(null);
        setInfo(null);
        const payload = await fetchScan(date, controller.signal);
        if (controller.signal.aborted || abortRef.current !== controller) {
          return;
        }
        setData(payload);
      } catch (err) {
        if (err instanceof ScanStoppedError || controller.signal.aborted) {
          // Ignore aborts from reset()/unmount; only surface explicit Stop.
          if (abortRef.current === controller) {
            setInfo("Scan stopped.");
          }
          return;
        }
        if (abortRef.current !== controller) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setData(null);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [fetchScan],
  );

  return { data, loading, loadingElapsedSec, error, info, run, stop, reset };
}
