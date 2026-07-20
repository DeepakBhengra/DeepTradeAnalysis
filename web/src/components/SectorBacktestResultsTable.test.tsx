import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectorBacktestResultsTable } from "./SectorBacktestResultsTable";
import type { DeepakDayScanPayload } from "../types/backtest";

const emptyPayload: DeepakDayScanPayload = {
  date: "2026-05-11",
  trades: [],
  errors: [],
  summary: {
    stocksScanned: 20,
    stocksWithSignals: 0,
    totalSignals: 0,
    buyCount: 0,
    sellCount: 0,
    targetsHit: 0,
    targetsMissed: 0,
    avgProfit: null,
    errorCount: 0,
  },
  runAt: "2026-06-27T10:00:00.000Z",
};

describe("SectorBacktestResultsTable", () => {
  it("shows empty-state message when there are no trades", () => {
    render(<SectorBacktestResultsTable payload={emptyPayload} />);

    expect(
      screen.getByText(/No BUY\/SELL signals on 2026-05-11 across the sector watchlist/),
    ).toBeTruthy();
    expect(screen.getByText(/Stocks scanned:/)).toBeTruthy();
  });

  it("hides Download CSV when csvFilePrefix is omitted", () => {
    render(<SectorBacktestResultsTable payload={emptyPayload} />);
    expect(screen.queryByRole("button", { name: "Download CSV" })).toBeNull();
  });

  it("shows Download CSV when csvFilePrefix is set", () => {
    render(
      <SectorBacktestResultsTable
        payload={emptyPayload}
        csvFilePrefix="deepak-day-scan"
      />,
    );
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeTruthy();
  });

  it("renders stock, hit, target, and profit columns", () => {
    const payload: DeepakDayScanPayload = {
      ...emptyPayload,
      summary: {
        ...emptyPayload.summary,
        stocksWithSignals: 1,
        totalSignals: 1,
        sellCount: 1,
        targetsHit: 0,
        targetsMissed: 1,
        avgProfit: null,
      },
      trades: [
        {
          symbol: "NSE:RELIANCE",
          tradingSymbol: "RELIANCE",
          sector: "IT",
          date: "2026-05-04",
          side: "SELL",
          scenarioNumber: 4,
          scenarioKey: "deepak continue downward direction - 2",
          entryTimeIst: "13:30",
          entryPrice: 1040.25,
          exitTimeIst: null,
          exitPrice: null,
          targetHit: false,
          profit: null,
          profitTarget: 4.5,
          bbMatchType: "close",
        },
      ],
    };

    render(<SectorBacktestResultsTable payload={payload} />);

    expect(screen.getByText("RELIANCE")).toBeTruthy();
    expect(screen.getByText("IT")).toBeTruthy();
    expect(screen.getByText("SELL")).toBeTruthy();
    expect(screen.getByText("4.50")).toBeTruthy();
    expect(screen.getByText("1040.25")).toBeTruthy();
    expect(screen.getByText("continue downward direction - 2")).toBeTruthy();
    expect(screen.getByText("close")).toBeTruthy();
  });
});
