import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BacktestResultsTable } from "./BacktestResultsTable";
import type { DeepakBacktestPayload } from "../types/backtest";

const emptyPayload: DeepakBacktestPayload = {
  symbol: "RELIANCE",
  tradingSymbol: "RELIANCE",
  fromDate: "2026-05-01",
  toDate: "2026-06-19",
  trades: [],
  summary: {
    tradingDaysScanned: 10,
    dateRange: { from: "2026-05-01", to: "2026-06-19" },
    totalSignals: 0,
    buyCount: 0,
    sellCount: 0,
    targetsHit: 0,
    targetsMissed: 0,
    avgProfit: null,
  },
  runAt: "2026-06-27T10:00:00.000Z",
};

describe("BacktestResultsTable", () => {
  it("shows empty-state message when there are no trades", () => {
    render(<BacktestResultsTable payload={emptyPayload} />);

    expect(screen.getByText(/No BUY\/SELL signals in the selected date range/)).toBeTruthy();
    expect(screen.getByText(/Days scanned:/)).toBeTruthy();
  });

  it("renders trade rows with side coloring", () => {
    const payload: DeepakBacktestPayload = {
      ...emptyPayload,
      summary: {
        ...emptyPayload.summary,
        totalSignals: 1,
        buyCount: 1,
        targetsHit: 1,
        targetsMissed: 0,
        avgProfit: 0.7,
      },
      trades: [
        {
          date: "2026-06-09",
          side: "BUY",
          scenarioNumber: 1,
          scenarioKey: "deepak strong direction switch - up",
          entryTimeIst: "10:30",
          entryPrice: 100.5,
          exitTimeIst: "10:45",
          exitPrice: 101.2,
          targetHit: true,
          profit: 0.7,
          profitTarget: 0.7,
          bbMatchType: "crossed",
        },
      ],
    };

    render(<BacktestResultsTable payload={payload} />);

    expect(screen.getByText("BUY")).toBeTruthy();
    expect(screen.getByText("strong direction switch - up")).toBeTruthy();
    expect(screen.getByText("100.50")).toBeTruthy();
  });
});
