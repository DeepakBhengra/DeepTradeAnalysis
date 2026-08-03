import { useEffect, useRef } from "react";

import {
  DAY_SCAN_LIVE_REFRESH_UNTIL_IST,
  shouldLiveRefreshDayScan,
} from "../utils/istTime";

const LIVE_REFRESH_MS = 15 * 60 * 1000;

interface UseDayScanLiveRefreshOptions {
  /** Selected Day Scan session date (YYYY-MM-DD). */
  date: string;
  /** True after the user has started at least one scan for the current controls. */
  hasStarted: boolean;
  /** Skip ticks while a scan is already in flight. */
  loading: boolean;
  /** Widget must be visible. */
  isActive: boolean;
  /** Trigger another scan for `date`. */
  run: (date: string) => void | Promise<void>;
  /** Override interval for tests. */
  intervalMs?: number;
  /** Override until HH:mm IST for tests. */
  untilHm?: string;
  /** Override "now" for tests. */
  now?: () => Date;
}

/**
 * When Day Scan date is today (IST), after the first run keep refreshing every
 * 15 minutes until 15:15 IST.
 */
export function useDayScanLiveRefresh({
  date,
  hasStarted,
  loading,
  isActive,
  run,
  intervalMs = LIVE_REFRESH_MS,
  untilHm = DAY_SCAN_LIVE_REFRESH_UNTIL_IST,
  now = () => new Date(),
}: UseDayScanLiveRefreshOptions): void {
  const runRef = useRef(run);
  const loadingRef = useRef(loading);
  const dateRef = useRef(date);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  useEffect(() => {
    if (!hasStarted || !isActive) {
      return;
    }
    if (!shouldLiveRefreshDayScan(date, now(), untilHm)) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!shouldLiveRefreshDayScan(dateRef.current, now(), untilHm)) {
        window.clearInterval(timer);
        return;
      }
      if (loadingRef.current) {
        return;
      }
      void runRef.current(dateRef.current);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasStarted, isActive, date, intervalMs, untilHm, now]);
}
