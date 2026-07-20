import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DayScanSimulationProvider,
  useDayScanSimulationContext,
} from "../context/DayScanSimulationContext";
import { useDayOrderSimulation } from "./useDayOrderSimulation";

const { fetchDayScanSimulationMock } = vi.hoisted(() => ({
  fetchDayScanSimulationMock: vi.fn(),
}));

vi.mock("../api/client", () => ({
  fetchDayScanSimulation: fetchDayScanSimulationMock,
}));

function makePayload(sessionIndex: number) {
  return {
    date: "2026-06-09",
    simulation: {
      sessionIndex,
      sessionCandleCount: 3,
      simulatedTimeIst: sessionIndex === 0 ? "09:15" : sessionIndex === 1 ? "09:30" : "09:45",
    },
    entries:
      sessionIndex >= 1
        ? [
            {
              date: "2026-06-09",
              strategy: "deepak" as const,
              side: "BUY" as const,
              scenarioNumber: 1,
              scenarioKey: "buy-1",
              entryTimeIst: "09:30",
              entryPrice: 500,
              exitTimeIst: null,
              exitPrice: null,
              targetHit: false,
              profit: null,
              profitTarget: 10,
              bbMatchType: "crossed" as const,
              symbol: "Reliance Industries",
              tradingSymbol: "RELIANCE",
              sector: "Energy",
            },
          ]
        : [],
    exits: [],
    errors: [],
    summary: {
      stocksScanned: 20,
      stocksWithSignals: sessionIndex >= 1 ? 1 : 0,
      entryCount: sessionIndex >= 1 ? 1 : 0,
      exitCount: 0,
      openPositions: sessionIndex >= 1 ? 1 : 0,
      buyCount: sessionIndex >= 1 ? 1 : 0,
      sellCount: 0,
      targetsHit: 0,
      avgProfit: null,
      errorCount: 0,
    },
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <DayScanSimulationProvider>{children}</DayScanSimulationProvider>;
}

function useScanAndOrder() {
  const scan = useDayScanSimulationContext();
  const order = useDayOrderSimulation();
  return { scan, order };
}

describe("useDayOrderSimulation", () => {
  beforeEach(() => {
    fetchDayScanSimulationMock.mockReset();
    fetchDayScanSimulationMock.mockImplementation(async (_date, index) =>
      makePayload(index),
    );
  });

  it("blocks start until day scan is running", () => {
    const { result } = renderHook(() => useDayOrderSimulation(), { wrapper });

    expect(result.current.canStart).toBe(false);
    expect(result.current.startBlockedReason).toContain("Start Day Scan Simulator");
  });

  it("allows start after scan starts with matching date", async () => {
    const { result } = renderHook(() => useScanAndOrder(), { wrapper });

    await act(async () => {
      result.current.scan.start();
    });

    await waitFor(() => {
      expect(result.current.scan.status).toBe("playing");
    });

    expect(result.current.order.canStart).toBe(true);
  });

  it("does not open positions on the start candle", async () => {
    fetchDayScanSimulationMock.mockImplementation(async (_date, index) =>
      makePayload(Math.max(index, 1)),
    );

    const { result } = renderHook(() => useScanAndOrder(), { wrapper });

    await act(async () => {
      result.current.scan.start();
    });

    await waitFor(() => {
      expect(result.current.scan.status).toBe("playing");
    });

    await waitFor(() => {
      expect(result.current.scan.data?.entries.length).toBeGreaterThan(0);
    });

    await act(async () => {
      result.current.order.start();
    });

    expect(result.current.order.status).toBe("running");
    expect(result.current.order.portfolio.openPositions).toHaveLength(0);
  });

  it("resets portfolio when order date changes", () => {
    const { result } = renderHook(() => useDayOrderSimulation(), { wrapper });

    act(() => {
      result.current.setOrderDate("2026-06-10");
    });

    expect(result.current.orderDate).toBe("2026-06-10");
    expect(result.current.portfolio.cash).toBe(300_000);
    expect(result.current.status).toBe("idle");
  });
});
