import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDayScanSimulation } from "../api/client";
import type { DayScanSimulationPayload } from "../types/backtest";
import type { DayScanSimulationVariant } from "../utils/dayScanSimulationVariant";
import {
  msUntilNextQuarterHourIst,
  shouldLiveRefreshDayScan,
} from "../utils/istTime";

export const SIMULATION_INTERVAL_MS = 10_000;

export type SimulationStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "waiting"
  | "complete";

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

interface FetchOptions {
  refresh?: boolean;
}

export function useDayScanSimulation(
  analysisDate: string,
  variant: DayScanSimulationVariant = "all",
  now: () => Date = () => new Date(),
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
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIndexRef = useRef(0);
  const sessionCandleCountRef = useRef(0);
  const statusRef = useRef<SimulationStatus>("idle");
  const analysisDateRef = useRef(analysisDate);
  const nowRef = useRef(now);

  useEffect(() => {
    analysisDateRef.current = analysisDate;
  }, [analysisDate]);

  useEffect(() => {
    nowRef.current = now;
  }, [now]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearWaitTimer = useCallback(() => {
    if (waitTimerRef.current) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  }, []);

  const fetchAtIndex = useCallback(
    async (
      index: number,
      options?: FetchOptions,
    ): Promise<DayScanSimulationPayload | null> => {
      const requestId = ++requestIdRef.current;

      try {
        const payload = await fetchDayScanSimulation(
          analysisDate,
          index,
          variant,
          options,
        );

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

  const shouldKeepWaitingForLiveCandles = useCallback((): boolean => {
    return shouldLiveRefreshDayScan(analysisDateRef.current, nowRef.current());
  }, []);

  const finishComplete = useCallback(() => {
    clearTimer();
    clearWaitTimer();
    setStatus("complete");
    statusRef.current = "complete";
  }, [clearTimer, clearWaitTimer]);

  const scheduleLiveCandleWaitRef = useRef<() => void>(() => {});

  const probeForNextLiveCandle = useCallback(async () => {
    if (statusRef.current !== "waiting") {
      return;
    }
    if (!shouldKeepWaitingForLiveCandles()) {
      finishComplete();
      return;
    }

    const previousCount = sessionCandleCountRef.current;
    const nextIndex = sessionIndexRef.current + 1;

    setLoading(true);
    setError(null);

    // Force re-prefetch so newly completed 15m candles extend sessionCandleCount.
    const probe = await fetchAtIndex(0, { refresh: true });
    if (statusRef.current !== "waiting") {
      setLoading(false);
      return;
    }

    if (!probe) {
      setLoading(false);
      scheduleLiveCandleWaitRef.current();
      return;
    }

    const newCount = probe.simulation.sessionCandleCount;
    if (newCount > previousCount && nextIndex < newCount) {
      const next = await fetchAtIndex(nextIndex);
      setLoading(false);
      if (statusRef.current !== "waiting") {
        return;
      }
      if (!next) {
        scheduleLiveCandleWaitRef.current();
        return;
      }
      setStatus("playing");
      statusRef.current = "playing";
      clearWaitTimer();
      timerRef.current = setInterval(() => {
        void advanceRef.current();
      }, SIMULATION_INTERVAL_MS);
      return;
    }

    // Still no new candle — restore the last frame we were on, then wait again.
    if (sessionIndexRef.current > 0 || previousCount > 0) {
      await fetchAtIndex(sessionIndexRef.current);
    }
    setLoading(false);
    if (statusRef.current === "waiting") {
      scheduleLiveCandleWaitRef.current();
    }
  }, [
    clearWaitTimer,
    fetchAtIndex,
    finishComplete,
    shouldKeepWaitingForLiveCandles,
  ]);

  const enterLiveWait = useCallback(
    (options?: { probeImmediately?: boolean }) => {
      clearTimer();
      clearWaitTimer();
      setStatus("waiting");
      statusRef.current = "waiting";
      if (options?.probeImmediately === false) {
        scheduleLiveCandleWaitRef.current();
        return;
      }
      // Probe right away — the in-memory session may be stale vs the live clock.
      void probeForNextLiveCandle();
    },
    [clearTimer, clearWaitTimer, probeForNextLiveCandle],
  );

  const scheduleLiveCandleWait = useCallback(() => {
    clearWaitTimer();
    if (!shouldKeepWaitingForLiveCandles()) {
      if (statusRef.current === "waiting") {
        finishComplete();
      }
      return;
    }

    const delayMs = msUntilNextQuarterHourIst(nowRef.current());
    waitTimerRef.current = setTimeout(() => {
      void probeForNextLiveCandle();
    }, delayMs);
  }, [
    clearWaitTimer,
    finishComplete,
    probeForNextLiveCandle,
    shouldKeepWaitingForLiveCandles,
  ]);

  scheduleLiveCandleWaitRef.current = scheduleLiveCandleWait;

  const advanceRef = useRef<() => Promise<void>>(async () => {});

  const advance = useCallback(async () => {
    const nextIndex = sessionIndexRef.current + 1;
    const maxIndex = sessionCandleCountRef.current - 1;

    if (nextIndex > maxIndex) {
      if (shouldKeepWaitingForLiveCandles()) {
        enterLiveWait();
        return;
      }
      finishComplete();
      return;
    }

    setLoading(true);
    await fetchAtIndex(nextIndex);
    setLoading(false);
  }, [
    enterLiveWait,
    fetchAtIndex,
    finishComplete,
    shouldKeepWaitingForLiveCandles,
  ]);

  advanceRef.current = advance;

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setInterval(() => {
      void advance();
    }, SIMULATION_INTERVAL_MS);
  }, [advance, clearTimer]);

  const start = useCallback(() => {
    void (async () => {
      if (statusRef.current === "playing" || statusRef.current === "waiting") {
        return;
      }

      if (statusRef.current === "paused") {
        const maxIndex = sessionCandleCountRef.current - 1;
        if (
          sessionIndexRef.current >= maxIndex &&
          shouldKeepWaitingForLiveCandles()
        ) {
          enterLiveWait();
          return;
        }
        setStatus("playing");
        statusRef.current = "playing";
        startTimer();
        return;
      }

      clearTimer();
      clearWaitTimer();
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

      const maxIndex = payload.simulation.sessionCandleCount - 1;
      if (maxIndex <= 0 && shouldKeepWaitingForLiveCandles()) {
        enterLiveWait();
        return;
      }

      setStatus("playing");
      statusRef.current = "playing";
      startTimer();
    })();
  }, [
    clearTimer,
    clearWaitTimer,
    enterLiveWait,
    fetchAtIndex,
    shouldKeepWaitingForLiveCandles,
    startTimer,
  ]);

  const pause = useCallback(() => {
    if (
      statusRef.current !== "playing" &&
      statusRef.current !== "waiting"
    ) {
      return;
    }
    clearTimer();
    clearWaitTimer();
    setStatus("paused");
    statusRef.current = "paused";
  }, [clearTimer, clearWaitTimer]);

  const reset = useCallback(() => {
    clearTimer();
    clearWaitTimer();
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
  }, [clearTimer, clearWaitTimer]);

  const stop = useCallback(() => {
    clearTimer();
    clearWaitTimer();
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
  }, [clearTimer, clearWaitTimer, fetchAtIndex]);

  /**
   * Stop playback and jump to the newest session candle for this date/variant.
   * Used when auto-refreshing a live (IST today) simulation.
   * Force-refreshes candles so the session can grow mid-day.
   */
  const reloadLatest = useCallback(() => {
    void (async () => {
      clearTimer();
      clearWaitTimer();
      setLoading(true);
      setError(null);
      setStatus("loading");
      statusRef.current = "loading";

      const first = await fetchAtIndex(0, { refresh: true });
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

      if (shouldKeepWaitingForLiveCandles()) {
        // Candles were just force-refreshed; schedule the next boundary probe.
        enterLiveWait({ probeImmediately: false });
        return;
      }

      setStatus("complete");
      statusRef.current = "complete";
    })();
  }, [
    clearTimer,
    clearWaitTimer,
    enterLiveWait,
    fetchAtIndex,
    shouldKeepWaitingForLiveCandles,
  ]);

  useEffect(() => {
    reset();
  }, [analysisDate, variant, reset]);

  useEffect(() => {
    return () => {
      clearTimer();
      clearWaitTimer();
    };
  }, [clearTimer, clearWaitTimer]);

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
