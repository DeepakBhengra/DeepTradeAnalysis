import { useCallback, useEffect, useRef, useState } from "react";

import type { DashboardPayload } from "../types/dashboard";
import type {
  OrderSide,
  OrderType,
  PlaceOrderInput,
  PnLSummary,
  PortfolioState,
} from "../types/paperTrading";
import {
  cancelPendingOrder,
  computePnL,
  createInitialPortfolio,
  describeFill,
  describeOrderPlacement,
  placeOrder as placeOrderEngine,
  processPendingOrders,
} from "../utils/paperTrading";

interface UsePaperTradingResult {
  portfolio: PortfolioState;
  pnl: PnLSummary;
  currentPrice: number | null;
  canTrade: boolean;
  lastError: string | null;
  lastConfirmation: string | null;
  placeOrder: (input: PlaceOrderInput) => boolean;
  cancelOrder: (orderId: string) => void;
  resetPortfolio: () => void;
}

function getLatestCandle(data: DashboardPayload | null) {
  if (!data?.series.length) {
    return null;
  }
  return data.series[data.series.length - 1];
}

export function usePaperTrading(
  data: DashboardPayload | null,
  sessionIndex: number,
  symbol: string,
  analysisDate: string,
): UsePaperTradingResult {
  const [portfolio, setPortfolio] = useState<PortfolioState>(createInitialPortfolio);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastConfirmation, setLastConfirmation] = useState<string | null>(null);
  const processedSessionIndexRef = useRef<number | null>(null);
  const portfolioRef = useRef(portfolio);

  portfolioRef.current = portfolio;

  const latestCandle = getLatestCandle(data);
  const currentPrice = latestCandle?.close ?? data?.close ?? null;
  const canTrade = currentPrice != null && data?.mode === "simulation";

  const resetPortfolio = useCallback(() => {
    setPortfolio(createInitialPortfolio());
    setLastError(null);
    setLastConfirmation(null);
    processedSessionIndexRef.current = null;
  }, []);

  useEffect(() => {
    resetPortfolio();
  }, [symbol, analysisDate, resetPortfolio]);

  useEffect(() => {
    if (!lastConfirmation) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLastConfirmation(null);
    }, 6000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [lastConfirmation]);

  useEffect(() => {
    if (!latestCandle || data?.mode !== "simulation") {
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

    setPortfolio((current) => {
      const next = processPendingOrders(
        current,
        {
          open: latestCandle.open,
          high: latestCandle.high,
          low: latestCandle.low,
          close: latestCandle.close,
        },
        sessionIndex,
      );

      const newFills = next.fills.slice(current.fills.length);
      if (newFills.length > 0) {
        const latestFill = newFills[newFills.length - 1];
        queueMicrotask(() => {
          setLastConfirmation(describeFill(latestFill));
          setLastError(null);
        });
      }

      return next;
    });
  }, [data?.mode, latestCandle, sessionIndex]);

  const placeOrder = useCallback(
    (input: PlaceOrderInput): boolean => {
      const result = placeOrderEngine(
        portfolioRef.current,
        input,
        currentPrice,
        sessionIndex,
      );

      if (!result.success) {
        setLastError(result.error ?? "Unable to place order.");
        setLastConfirmation(null);
        return false;
      }

      const referencePrice =
        input.orderType === "MARKET" ? currentPrice! : input.price!;
      setLastError(null);
      setLastConfirmation(describeOrderPlacement(input, referencePrice));
      setPortfolio(result.portfolio);
      return true;
    },
    [currentPrice, sessionIndex],
  );

  const cancelOrder = useCallback((orderId: string) => {
    setPortfolio((current) => cancelPendingOrder(current, orderId));
    setLastError(null);
  }, []);

  const pnl = computePnL(portfolio, currentPrice);

  return {
    portfolio,
    pnl,
    currentPrice,
    canTrade,
    lastError,
    lastConfirmation,
    placeOrder,
    cancelOrder,
    resetPortfolio,
  };
}

export type { OrderSide, OrderType };
