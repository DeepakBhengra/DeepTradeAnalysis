import { useCallback, useEffect, useRef, useState } from "react";

import { fetchLiveOrderBook } from "../api/client";
import type {
  OrderBookRecordInterval,
  OrderBookRecordingSample,
} from "../types/orderBook";
import {
  ORDER_BOOK_RECORD_DURATION_MS,
  ORDER_BOOK_RECORD_POLL_MS,
  buildOrderBookRecordingSample,
  downloadOrderBookRecordingXls,
  orderBookChangeFingerprint,
} from "../utils/orderBookRecording";

export function useOrderBookRecorder(symbol: string | null) {
  const [interval, setRecordInterval] = useState<OrderBookRecordInterval>("1m");
  const [recording, setRecording] = useState(false);
  const [samples, setSamples] = useState<OrderBookRecordingSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef(0);
  const intervalRef = useRef(interval);
  const lastFingerprintRef = useRef<string | null>(null);
  intervalRef.current = interval;

  const capture = useCallback(async () => {
    if (!symbol) {
      return;
    }

    const sessionId = sessionIdRef.current;
    try {
      const snapshot = await fetchLiveOrderBook(symbol);
      if (sessionId !== sessionIdRef.current) {
        return;
      }
      const fingerprint = orderBookChangeFingerprint(snapshot);
      if (fingerprint === lastFingerprintRef.current) {
        return;
      }
      lastFingerprintRef.current = fingerprint;
      setSamples((prev) => [
        ...prev,
        buildOrderBookRecordingSample(snapshot, intervalRef.current),
      ]);
      setError(null);
    } catch (err) {
      if (sessionId !== sessionIdRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [symbol]);

  const start = useCallback(() => {
    if (!symbol || recording) {
      return;
    }
    sessionIdRef.current += 1;
    lastFingerprintRef.current = null;
    setSamples([]);
    setError(null);
    setRecording(true);
  }, [symbol, recording]);

  const stop = useCallback(() => {
    sessionIdRef.current += 1;
    setRecording(false);
  }, []);

  const download = useCallback(() => {
    downloadOrderBookRecordingXls(samples);
  }, [samples]);

  useEffect(() => {
    if (!recording || !symbol) {
      return;
    }

    void capture();
    const poll = window.setInterval(() => {
      void capture();
    }, ORDER_BOOK_RECORD_POLL_MS);
    const autoStop = window.setTimeout(() => {
      stop();
    }, ORDER_BOOK_RECORD_DURATION_MS[interval]);

    return () => {
      sessionIdRef.current += 1;
      window.clearInterval(poll);
      window.clearTimeout(autoStop);
    };
  }, [recording, symbol, interval, capture, stop]);

  return {
    interval,
    setRecordInterval,
    recording,
    samples,
    error,
    start,
    stop,
    download,
  };
}
