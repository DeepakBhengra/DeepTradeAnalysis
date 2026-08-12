import { useCallback, useEffect, useRef, useState } from "react";

import { useDayScanSimulationContext } from "../context/DayScanSimulationContext";
import type { DayOrderPortfolio, DayOrderRunSettings, DayOrderSimStatus } from "../types/dayOrder";
import { DEFAULT_DAY_ORDER_RUN_SETTINGS } from "../types/dayOrder";
import { catchUpDayOrderPortfolio } from "../utils/dayOrderCatchUp";
import {
  closeDayOrderPositionAtMark,
  computeDayOrderPnL,
  createInitialDayOrderPortfolio,
  marksMapFromSimulation,
  processDayOrderTick,
  validateDayOrderRunSettings,
} from "../utils/dayOrderEngine";
import type { DayScanSimulationMark } from "../types/backtest";

interface UseDayOrderSimulationResult {
  orderDate: string;
  setOrderDate: (date: string) => void;
  status: DayOrderSimStatus;
  portfolio: DayOrderPortfolio;
  pnl: ReturnType<typeof computeDayOrderPnL>;
  marks: DayScanSimulationMark[];
  canStart: boolean;
  startBlockedReason: string | null;
  dateMismatch: boolean;
  catchingUp: boolean;
  runSettings: DayOrderRunSettings;
  setRunSettings: (settings: DayOrderRunSettings) => void;
  settingsError: string | null;
  start: () => void;
  stop: () => void;
  /** Voluntarily exit an open position at the current mark mid. */
  closePosition: (signalKey: string) => boolean;
}

function getStartBlockedReason(
  scanStatus: string,
  dateMismatch: boolean,
  settingsError: string | null,
): string | null {
  if (dateMismatch) {
    return "Order date must match Day Scan Simulator date.";
  }
  if (settingsError != null) {
    return settingsError;
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
  const [runSettings, setRunSettingsState] = useState<DayOrderRunSettings>(
    DEFAULT_DAY_ORDER_RUN_SETTINGS,
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
  /** Settings locked for the active run (catch-up + live ticks). */
  const activeSettingsRef = useRef<DayOrderRunSettings>(DEFAULT_DAY_ORDER_RUN_SETTINGS);

  const settingsError = validateDayOrderRunSettings(runSettings);
  const dateMismatch = orderDate !== scanDate;
  const startBlockedReason = getStartBlockedReason(
    scanStatus,
    dateMismatch,
    settingsError,
  );
  const canStart =
    startBlockedReason == null && status !== "running" && !catchingUp;

  const setOrderDate = useCallback(
    (date: string) => {
      setOrderDateLocal(date);
      setAnalysisDate(date);
    },
    [setAnalysisDate],
  );

  const setRunSettings = useCallback((settings: DayOrderRunSettings) => {
    setRunSettingsState(settings);
  }, []);

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

  // Changing qty / price range while idle clears the previous paper book.
  useEffect(() => {
    if (statusRef.current === "idle") {
      setPortfolio(createInitialDayOrderPortfolio());
      processedSessionIndexRef.current = null;
    }
  }, [runSettings]);

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
    const settings = { ...runSettings };
    activeSettingsRef.current = settings;

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
          settings,
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
          setPortfolio(processDayOrderTick(initial, currentData, settings));
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
  }, [startBlockedReason, catchingUp, runSettings]);

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
    setPortfolio((current) =>
      processDayOrderTick(current, data, activeSettingsRef.current),
    );
  }, [data, sessionIndex, catchingUp]);

  useEffect(() => {
    if (statusRef.current === "running" && !catchingUp && scanStatus === "complete") {
      setStatus("complete");
    }
  }, [scanStatus, catchingUp]);

  const pnl = computeDayOrderPnL(
    portfolio,
    marksMapFromSimulation(data?.marks),
  );

  const closePosition = useCallback((signalKey: string): boolean => {
    const marksMap = marksMapFromSimulation(dataRef.current?.marks);
    let closed = false;
    setPortfolio((current) => {
      const position = current.openPositions.find(
        (row) => row.signalKey === signalKey,
      );
      if (!position) {
        return current;
      }
      const mark = marksMap.get(position.tradingSymbol);
      const exitPrice =
        typeof mark === "number" && Number.isFinite(mark)
          ? mark
          : position.entryPrice;
      if (!Number.isFinite(exitPrice)) {
        return current;
      }
      const timeIst =
        dataRef.current?.simulation.simulatedTimeIst ?? position.entryTimeIst;
      const sessionIdx =
        dataRef.current?.simulation.sessionIndex ??
        processedSessionIndexRef.current ??
        0;
      closed = true;
      return closeDayOrderPositionAtMark(
        current,
        signalKey,
        exitPrice,
        timeIst,
        sessionIdx,
      );
    });
    return closed;
  }, []);

  return {
    orderDate,
    setOrderDate,
    status,
    portfolio,
    pnl,
    marks: data?.marks ?? [],
    canStart,
    startBlockedReason,
    dateMismatch,
    catchingUp,
    runSettings,
    setRunSettings,
    settingsError,
    start,
    stop,
    closePosition,
  };
}
