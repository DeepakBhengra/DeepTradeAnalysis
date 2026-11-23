import { useCallback, useEffect, useRef, useState } from "react";

import { fetchLiveOrderBook } from "../api/client";
import type {
  OrderBookRecordInterval,
  OrderBookRecordingSample,
} from "../types/orderBook";
import {
  ORDER_BOOK_RECORD_INTERVAL_MS,
  buildOrderBookRecordingSample,
  downloadOrderBookRecordingXls,
} from "../utils/orderBookRecording";

export function useOrderBookRecorder(symbol: string | null) {
  const [interval, setRecordInterval] = useState<OrderBookRecordInterval>("1m");
  const [recording, setRecording] = useState(false);
  const [samples, setSamples] = useState<OrderBookRecordingSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  const capture = useCallback(async () => {
    if (!symbol) {
      return;
    }

    const requestId = ++requestIdRef.current;
    try {
      const snapshot = await fetchLiveOrderBook(symbol);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setSamples((prev) => [
        ...prev,
        buildOrderBookRecordingSample(snapshot, intervalRef.current),
      ]);
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [symbol]);

  const start = useCallback(() => {
    if (!symbol || recording) {
      return;
    }
    requestIdRef.current += 1;
    setSamples([]);
    setError(null);
    setRecording(true);
  }, [symbol, recording]);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
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
    const timer = window.setInterval(() => {
      void capture();
    }, ORDER_BOOK_RECORD_INTERVAL_MS[interval]);

    return () => {
      requestIdRef.current += 1;
      window.clearInterval(timer);
    };
  }, [recording, symbol, interval, capture]);

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
