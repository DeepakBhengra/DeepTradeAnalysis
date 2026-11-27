import { useEffect, useRef, useState } from "react";

import type {
  OrderBookRecordInterval,
  OrderBookRecordingSample,
  OrderBookSnapshot,
} from "../types/orderBook";
import {
  ORDER_BOOK_RECORD_DURATION_MS,
  buildOrderBookRecordingSample,
  orderBookChangeFingerprint,
  trimOrderBookLiveTrail,
} from "../utils/orderBookRecording";

/**
 * Always-on rolling trail for the live graph. Appends about once a second while
 * Kite snapshots arrive, independent of Start/Stop recording. Caps at 30 ticks.
 */
export function useOrderBookLiveTrail(
  snapshot: OrderBookSnapshot | null,
  interval: OrderBookRecordInterval,
  symbol: string | null,
): OrderBookRecordingSample[] {
  const [samples, setSamples] = useState<OrderBookRecordingSample[]>([]);
  const intervalRef = useRef(interval);
  const lastAppendKeyRef = useRef<string | null>(null);
  intervalRef.current = interval;

  useEffect(() => {
    lastAppendKeyRef.current = null;
    setSamples([]);
  }, [symbol]);

  useEffect(() => {
    setSamples((prev) =>
      trimOrderBookLiveTrail(prev, ORDER_BOOK_RECORD_DURATION_MS[interval]),
    );
  }, [interval]);

  useEffect(() => {
    if (!snapshot || !symbol) {
      return;
    }

    const now = Date.now();
    const key = `${orderBookChangeFingerprint(snapshot)}@${Math.floor(now / 1000)}`;
    if (lastAppendKeyRef.current === key) {
      return;
    }
    lastAppendKeyRef.current = key;

    const sample = buildOrderBookRecordingSample(
      snapshot,
      intervalRef.current,
      new Date(now),
    );
    setSamples((prev) =>
      trimOrderBookLiveTrail(
        [...prev, sample],
        ORDER_BOOK_RECORD_DURATION_MS[intervalRef.current],
        now,
      ),
    );
  }, [snapshot, symbol]);

  return samples;
}
