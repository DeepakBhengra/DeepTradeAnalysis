import { useCallback, useEffect, useState } from "react";

import type { OrderBookSnapshot, OrderBookTouchEvent } from "../types/orderBook";
import {
  EMPTY_ORDER_BOOK_TOUCH_REPORT,
  downloadOrderBookTouchReportXls,
  reduceOrderBookTouchReport,
} from "../utils/orderBookTouchReport";

export function useOrderBookTouchReport(
  snapshot: OrderBookSnapshot | null,
  symbol: string | null,
): {
  events: OrderBookTouchEvent[];
  download: () => void;
} {
  const [state, setState] = useState(EMPTY_ORDER_BOOK_TOUCH_REPORT);

  useEffect(() => {
    setState(EMPTY_ORDER_BOOK_TOUCH_REPORT);
  }, [symbol]);

  useEffect(() => {
    if (!snapshot || !symbol) {
      return;
    }
    setState((prev) => reduceOrderBookTouchReport(prev, snapshot, new Date()));
  }, [snapshot, symbol]);

  const download = useCallback(() => {
    downloadOrderBookTouchReportXls(state.events);
  }, [state.events]);

  return { events: state.events, download };
}
