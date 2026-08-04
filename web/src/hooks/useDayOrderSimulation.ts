import { useCallback, useEffect, useRef, useState } from "react";

import { useDayScanSimulationContext } from "../context/DayScanSimulationContext";
import type { DayOrderPortfolio, DayOrderSimStatus } from "../types/dayOrder";
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

  const dateMismatch = orderDate !== scanDate;
  const startBlockedReason = getStartBlockedReason(scanStatus, dateMismatch);
  const canStart = startBlockedReason == null && status !== "running";

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
    setPortfolio(createInitialDayOrderPortfolio());
    processedSessionIndexRef.current = null;
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
    if (statusRef.current === "running") {
      return;
    }
    if (startBlockedReason != null) {
      return;
    }

    const initial = createInitialDayOrderPortfolio();
    const currentData = dataRef.current;
    const currentIndex = sessionIndexRef.current;

    // Trade the current scan candle immediately so 09:15 entries are not skipped.
    if (currentData) {
      processedSessionIndexRef.current = currentIndex;
      setPortfolio(processDayOrderTick(initial, currentData));
    } else {
      processedSessionIndexRef.current = null;
      setPortfolio(initial);
    }
    setStatus("running");
  }, [startBlockedReason]);

  const stop = useCallback(() => {
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
    if (statusRef.current !== "running" || !data) {
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
  }, [data, sessionIndex]);

  useEffect(() => {
    if (statusRef.current === "running" && scanStatus === "complete") {
      setStatus("complete");
    }
  }, [scanStatus]);

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
    start,
    stop,
  };
}
