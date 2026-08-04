import { useCallback, useEffect, useRef, useState } from "react";

import { useDayScanSimulationContext } from "../context/DayScanSimulationContext";
import type { DayOrderPortfolio, DayOrderSimStatus } from "../types/dayOrder";
import { catchUpDayOrderPortfolio } from "../utils/dayOrderCatchUp";
import {
  computeDayOrderPnL,
  createInitialDayOrderPortfolio,
  processDayOrderTick,
} from "../utils/dayOrderEngine";

interface UseDayOrderSimulationResult {
  orderDate: string;
  setOrderDate: (date: string) => void;
  status: DayOrderSimStatus;
  portfolio: DayOrderPortfolio;
  pnl: ReturnType<typeof computeDayOrderPnL>;
  canStart: boolean;
  startBlockedReason: string | null;
  dateMismatch: boolean;
  catchingUp: boolean;
  start: () => void;
  stop: () => void;
}

function getStartBlockedReason(
  scanStatus: string,
  dateMismatch: boolean,
): string | null {
  if (dateMismatch) {
    return "Order date must match Day Scan Simulator date.";
  }
  if (scanStatus === "idle" || scanStatus === "loading") {
    return "Start Day Scan Simulator with the same date first.";
  }
  return null;
}

export function useDayOrderSimulation(): UseDayOrderSimulationResult {
  const {
    analysisDate: scanDate,
    setAnalysisDate,
    data,
    status: scanStatus,
    sessionIndex,
    ruleVariant,
  } = useDayScanSimulationContext();

  const [orderDate, setOrderDateLocal] = useState(scanDate);
  const [status, setStatus] = useState<DayOrderSimStatus>("idle");
  const [catchingUp, setCatchingUp] = useState(false);
  const [portfolio, setPortfolio] = useState<DayOrderPortfolio>(
    createInitialDayOrderPortfolio,
  );

  const processedSessionIndexRef = useRef<number | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const prevScanStatusRef = useRef(scanStatus);
  const dataRef = useRef(data);
  dataRef.current = data;
  const sessionIndexRef = useRef(sessionIndex);
  sessionIndexRef.current = sessionIndex;
  const scanDateRef = useRef(scanDate);
  scanDateRef.current = scanDate;
  const ruleVariantRef = useRef(ruleVariant);
  ruleVariantRef.current = ruleVariant;
  const startRequestIdRef = useRef(0);

  const dateMismatch = orderDate !== scanDate;
  const startBlockedReason = getStartBlockedReason(scanStatus, dateMismatch);
  const canStart =
    startBlockedReason == null && status !== "running" && !catchingUp;

  const setOrderDate = useCallback(
    (date: string) => {
      setOrderDateLocal(date);
      setAnalysisDate(date);
    },
    [setAnalysisDate],
  );

  useEffect(() => {
    setOrderDateLocal(scanDate);
  }, [scanDate]);

  const resetPortfolio = useCallback(() => {
    startRequestIdRef.current += 1;
    setPortfolio(createInitialDayOrderPortfolio());
    processedSessionIndexRef.current = null;
    setCatchingUp(false);
    setStatus("idle");
  }, []);

  useEffect(() => {
    resetPortfolio();
  }, [orderDate, ruleVariant, resetPortfolio]);

  useEffect(() => {
    if (scanStatus === "idle" && statusRef.current !== "idle") {
      resetPortfolio();
    }
  }, [scanStatus, resetPortfolio]);

  const start = useCallback(() => {
    if (statusRef.current === "running" || catchingUp) {
      return;
    }
    if (startBlockedReason != null) {
      return;
    }

    const requestId = ++startRequestIdRef.current;
    const currentIndex = sessionIndexRef.current;
    const currentData = dataRef.current;
    const date = scanDateRef.current;
    const variant = ruleVariantRef.current;

    void (async () => {
      setCatchingUp(true);
      setStatus("running");
      try {
        // Replay every candle from 09:15 through the current scan candle so
        // morning entries/exits are never skipped when Order Sim joins late.
        const caughtUp = await catchUpDayOrderPortfolio({
          date,
          variant,
          throughIndex: currentIndex,
          currentPayload: currentData,
        });
        if (requestId !== startRequestIdRef.current) {
          return;
        }
        processedSessionIndexRef.current = currentIndex;
        setPortfolio(caughtUp);
      } catch {
        if (requestId !== startRequestIdRef.current) {
          return;
        }
        // Fallback: at least trade the current candle.
        const initial = createInitialDayOrderPortfolio();
        if (currentData) {
          processedSessionIndexRef.current = currentIndex;
          setPortfolio(processDayOrderTick(initial, currentData));
        } else {
          processedSessionIndexRef.current = null;
          setPortfolio(initial);
        }
      } finally {
        if (requestId === startRequestIdRef.current) {
          setCatchingUp(false);
        }
      }
    })();
  }, [startBlockedReason, catchingUp]);

  const stop = useCallback(() => {
    startRequestIdRef.current += 1;
    setCatchingUp(false);
    setStatus("idle");
    processedSessionIndexRef.current = null;
  }, []);

  // Auto-start paper trading as soon as Day Scan Simulator begins playing.
  useEffect(() => {
    const prev = prevScanStatusRef.current;
    prevScanStatusRef.current = scanStatus;

    const scanJustStarted =
      (scanStatus === "playing" || scanStatus === "paused") &&
      (prev === "idle" || prev === "loading");

    if (
      scanJustStarted &&
      statusRef.current === "idle" &&
      !dateMismatch &&
      startBlockedReason == null
    ) {
      start();
    }
  }, [scanStatus, dateMismatch, startBlockedReason, start]);

  useEffect(() => {
    if (statusRef.current !== "running" || catchingUp || !data) {
      return;
    }

    if (
      processedSessionIndexRef.current != null &&
      sessionIndex < processedSessionIndexRef.current
    ) {
      processedSessionIndexRef.current = null;
    }

    if (processedSessionIndexRef.current === sessionIndex) {
      return;
    }

    processedSessionIndexRef.current = sessionIndex;
    setPortfolio((current) => processDayOrderTick(current, data));
  }, [data, sessionIndex, catchingUp]);

  useEffect(() => {
    if (statusRef.current === "running" && !catchingUp && scanStatus === "complete") {
      setStatus("complete");
    }
  }, [scanStatus, catchingUp]);

  const pnl = computeDayOrderPnL(portfolio);

  return {
    orderDate,
    setOrderDate,
    status,
    portfolio,
    pnl,
    canStart,
    startBlockedReason,
    dateMismatch,
    catchingUp,
    start,
    stop,
  };
}
