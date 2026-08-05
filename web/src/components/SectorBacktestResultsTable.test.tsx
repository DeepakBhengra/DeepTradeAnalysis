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
    expect(screen.getByText("Entry Signals (BUY / SELL)")).toBeTruthy();
    expect(screen.getByText("Exit Signals")).toBeTruthy();
    expect(screen.getByText(/No exits yet/)).toBeTruthy();
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

  it("renders entry signals and a separate exit section for closed trades", () => {
    const payload: DeepakDayScanPayload = {
      ...emptyPayload,
      summary: {
        ...emptyPayload.summary,
        stocksWithSignals: 2,
        totalSignals: 2,
        buyCount: 1,
        sellCount: 1,
        targetsHit: 1,
        targetsMissed: 1,
        avgProfit: 2.5,
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
        {
          symbol: "NSE:TCS",
          tradingSymbol: "TCS",
          sector: "IT",
          date: "2026-05-04",
          side: "BUY",
          scenarioNumber: 1,
          scenarioKey: "deeppro1 buy SMI up-cross",
          entryTimeIst: "10:15",
          entryPrice: 3500,
          exitTimeIst: "11:00",
          exitPrice: 3515.75,
          targetHit: true,
          profit: 15.75,
          profitTarget: 15.75,
          bbMatchType: "crossed",
          exitReason: "target",
        },
      ],
    };

    render(<SectorBacktestResultsTable payload={payload} />);

    expect(screen.getByText("Entry Signals (BUY / SELL)")).toBeTruthy();
    expect(screen.getByText("Exit Signals")).toBeTruthy();
    expect(screen.getByText("RELIANCE")).toBeTruthy();
    expect(screen.getAllByText("TCS")).toHaveLength(2);
    expect(screen.getByText("SELL")).toBeTruthy();
    expect(screen.getByText("4.50")).toBeTruthy();
    expect(screen.getByText("1040.25")).toBeTruthy();
    expect(screen.getByText("continue downward direction - 2")).toBeTruthy();
    expect(screen.getByText("close")).toBeTruthy();
    expect(screen.getByText("11:00")).toBeTruthy();
    expect(screen.getByText("3515.75")).toBeTruthy();
    expect(screen.getAllByText("15.75").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/No exits yet/)).toBeNull();
  });
});
