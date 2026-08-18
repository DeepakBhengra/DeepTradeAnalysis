import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDayScanSimulation } from "../api/client";
import type { DayScanSimulationPayload } from "../types/backtest";
import type { DayScanSimulationVariant } from "../utils/dayScanSimulationVariant";

export const SIMULATION_INTERVAL_MS = 10_000;

export type SimulationStatus = "idle" | "loading" | "playing" | "paused" | "complete";

interface UseDayScanSimulationResult {
  data: DayScanSimulationPayload | null;
  loading: boolean;
  error: string | null;
  status: SimulationStatus;
  sessionIndex: number;
  sessionCandleCount: number;
  simulatedTimeIst: string | null;
  start: () => void;
  pause: () => void;
  stop: () => void;
  /** Re-fetch the latest available candle frame (used for IST-today auto-refresh). */
  reloadLatest: () => void;
}

export function useDayScanSimulation(
  analysisDate: string,
  variant: DayScanSimulationVariant = "all",
): UseDayScanSimulationResult {
  const [data, setData] = useState<DayScanSimulationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SimulationStatus>("idle");
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionCandleCount, setSessionCandleCount] = useState(0);
  const [simulatedTimeIst, setSimulatedTimeIst] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIndexRef = useRef(0);
  const sessionCandleCountRef = useRef(0);
  const statusRef = useRef<SimulationStatus>("idle");

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchAtIndex = useCallback(
    async (index: number): Promise<DayScanSimulationPayload | null> => {
      const requestId = ++requestIdRef.current;

      try {
        const payload = await fetchDayScanSimulation(analysisDate, index, variant);

        if (requestId !== requestIdRef.current) {
          return null;
        }

        setData(payload);
        setError(null);
        setSessionIndex(payload.simulation.sessionIndex);
        sessionIndexRef.current = payload.simulation.sessionIndex;

        const count = payload.simulation.sessionCandleCount;
        setSessionCandleCount(count);
        sessionCandleCountRef.current = count;
        setSimulatedTimeIst(payload.simulation.simulatedTimeIst);

        return payload;
      } catch (err) {
        if (requestId !== requestIdRef.current) {
          return null;
        }

        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setData(null);
        return null;
      }
    },
    [analysisDate, variant],
  );

  const advance = useCallback(async () => {
    const nextIndex = sessionIndexRef.current + 1;
    const maxIndex = sessionCandleCountRef.current - 1;

    if (nextIndex > maxIndex) {
      clearTimer();
      setStatus("complete");
      statusRef.current = "complete";
      return;
    }

    setLoading(true);
    await fetchAtIndex(nextIndex);
    setLoading(false);
  }, [clearTimer, fetchAtIndex]);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      void advance();
    }, SIMULATION_INTERVAL_MS);
  }, [advance, clearTimer]);

  const start = useCallback(() => {
    void (async () => {
      if (statusRef.current === "playing") {
        return;
      }

      if (statusRef.current === "paused") {
        setStatus("playing");
        statusRef.current = "playing";
        startTimer();
        return;
      }

      clearTimer();
      setLoading(true);
      setError(null);
      setStatus("loading");
      statusRef.current = "loading";
      sessionIndexRef.current = 0;

      const payload = await fetchAtIndex(0);
      setLoading(false);

      if (!payload) {
        setStatus("idle");
        statusRef.current = "idle";
        return;
      }

      setStatus("playing");
      statusRef.current = "playing";
      startTimer();
    })();
  }, [clearTimer, fetchAtIndex, startTimer]);

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") {
      return;
    }
    clearTimer();
    setStatus("paused");
    statusRef.current = "paused";
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    requestIdRef.current += 1;
    setStatus("idle");
    statusRef.current = "idle";
    setSessionIndex(0);
    sessionIndexRef.current = 0;
    setSimulatedTimeIst(null);
    setData(null);
    setError(null);
    setSessionCandleCount(0);
    sessionCandleCountRef.current = 0;
    setLoading(false);
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setStatus("idle");
    statusRef.current = "idle";
    setSessionIndex(0);
    sessionIndexRef.current = 0;
    setError(null);

    void (async () => {
      setLoading(true);
      const payload = await fetchAtIndex(0);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setLoading(false);
      if (!payload) {
        setData(null);
        setSessionCandleCount(0);
        sessionCandleCountRef.current = 0;
        setSimulatedTimeIst(null);
      }
    })();
  }, [clearTimer, fetchAtIndex]);

  /**
   * Stop playback and jump to the newest session candle for this date/variant.
   * Used when auto-refreshing a live (IST today) simulation.
   */
  const reloadLatest = useCallback(() => {
    void (async () => {
      clearTimer();
      setLoading(true);
      setError(null);
      setStatus("loading");
      statusRef.current = "loading";

      const first = await fetchAtIndex(0);
      if (!first) {
        setLoading(false);
        if (statusRef.current === "loading") {
          setStatus("idle");
          statusRef.current = "idle";
        }
        return;
      }

      const lastIndex = Math.max(0, first.simulation.sessionCandleCount - 1);
      if (lastIndex > 0) {
        const latest = await fetchAtIndex(lastIndex);
        if (!latest) {
          setLoading(false);
          if (statusRef.current === "loading") {
            setStatus("idle");
            statusRef.current = "idle";
          }
          return;
        }
      }

      setLoading(false);
      setStatus("complete");
      statusRef.current = "complete";
    })();
  }, [clearTimer, fetchAtIndex]);

  useEffect(() => {
    reset();
  }, [analysisDate, variant, reset]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    data,
    loading,
    error,
    status,
    sessionIndex,
    sessionCandleCount,
    simulatedTimeIst,
    start,
    pause,
    stop,
    reloadLatest,
  };
}
