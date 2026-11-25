import { useCallback, useEffect, useRef, useState } from "react";

import type {
  OrderBookRecordInterval,
  OrderBookRecordingSample,
  OrderBookSnapshot,
} from "../types/orderBook";
import {
  ORDER_BOOK_RECORD_DURATION_MS,
  buildOrderBookRecordingSample,
  downloadOrderBookRecordingXls,
  orderBookChangeFingerprint,
} from "../utils/orderBookRecording";

export function useOrderBookRecorder(
  symbol: string | null,
  liveSnapshot: OrderBookSnapshot | null = null,
) {
  const [interval, setRecordInterval] = useState<OrderBookRecordInterval>("1m");
  const [recording, setRecording] = useState(false);
  const [samples, setSamples] = useState<OrderBookRecordingSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef(interval);
  const lastFingerprintRef = useRef<string | null>(null);
  intervalRef.current = interval;

  const start = useCallback(() => {
    if (!symbol || recording) {
      return;
    }
    lastFingerprintRef.current = null;
    setSamples([]);
    setError(null);
    setRecording(true);
  }, [symbol, recording]);

  const stop = useCallback(() => {
    setRecording(false);
  }, []);

  const download = useCallback(() => {
    downloadOrderBookRecordingXls(samples);
  }, [samples]);

  useEffect(() => {
    if (!recording || !symbol || !liveSnapshot) {
      return;
    }

    const fingerprint = orderBookChangeFingerprint(liveSnapshot);
    if (fingerprint === lastFingerprintRef.current) {
      return;
    }
    lastFingerprintRef.current = fingerprint;
    setSamples((prev) => [
      ...prev,
      buildOrderBookRecordingSample(liveSnapshot, intervalRef.current),
    ]);
    setError(null);
  }, [recording, symbol, liveSnapshot]);

  useEffect(() => {
    if (!recording || !symbol) {
      return;
    }

    const autoStop = window.setTimeout(() => {
      stop();
    }, ORDER_BOOK_RECORD_DURATION_MS[interval]);

    return () => {
      window.clearTimeout(autoStop);
    };
  }, [recording, symbol, interval, stop]);

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
