import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DayScanEntrySignalsTable } from "./DayScanEntrySignalsTable";
import type { DayScanSimulationSignal } from "../types/backtest";

const sampleEntry: DayScanSimulationSignal = {
  date: "2026-05-11",
  strategy: "deepak",
  symbol: "NSE:RELIANCE",
  tradingSymbol: "RELIANCE",
  sector: "IT",
  side: "SELL",
  scenarioNumber: 4,
  scenarioKey: "deepak continue downward direction - 2",
  entryTimeIst: "13:30",
  entryPrice: 1040.25,
  exitTimeIst: null,
  exitPrice: null,
  targetHit: false,
  profit: null,
  profitTarget: 0.7,
  bbMatchType: "crossed",
};

describe("DayScanEntrySignalsTable", () => {
  it("shows empty-state message when there are no entries", () => {
    render(<DayScanEntrySignalsTable entries={[]} simulatedTimeIst={null} />);

    expect(screen.getByText(/No entry signals yet/)).toBeTruthy();
  });

  it("renders strategy column and entry fields", () => {
    render(
      <DayScanEntrySignalsTable entries={[sampleEntry]} simulatedTimeIst="13:30" />,
    );

    expect(screen.getByText("RELIANCE")).toBeTruthy();
    expect(screen.getByText("Deepak")).toBeTruthy();
    expect(screen.getByText("13:30")).toBeTruthy();
    expect(screen.getByText("1040.25")).toBeTruthy();
    expect(screen.getByText("SELL")).toBeTruthy();
  });
});
