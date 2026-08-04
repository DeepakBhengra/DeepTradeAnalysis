import { describe, expect, it } from "vitest";

import type {
  DayScanSimulationExit,
  DayScanSimulationPayload,
  DayScanSimulationSignal,
} from "../types/backtest";
import { DAY_ORDER_INITIAL_CASH, ORDER_QUANTITY } from "../types/dayOrder";
import {
  createInitialDayOrderPortfolio,
  entrySignalKey,
  exitSignalKey,
  processDayOrderTick,
} from "./dayOrderEngine";

function makeSignal(
  overrides: Partial<DayScanSimulationSignal> = {},
): DayScanSimulationSignal {
  return {
    date: "2026-06-09",
    strategy: "deepak",
    side: "BUY",
    scenarioNumber: 1,
    scenarioKey: "buy-1",
    entryTimeIst: "09:30",
    entryPrice: 500,
    exitTimeIst: null,
    exitPrice: null,
    targetHit: false,
    profit: null,
    profitTarget: 10,
    bbMatchType: "crossed",
    symbol: "Reliance Industries",
    tradingSymbol: "RELIANCE",
    sector: "Energy",
    ...overrides,
  };
}

function makeExit(
  signal: DayScanSimulationSignal,
  overrides: Partial<DayScanSimulationExit> = {},
): DayScanSimulationExit {
  return {
    date: signal.date,
    strategy: signal.strategy,
    side: signal.side,
    scenarioNumber: signal.scenarioNumber,
    scenarioKey: signal.scenarioKey,
    tradingSymbol: signal.tradingSymbol,
    symbol: signal.symbol,
    sector: signal.sector,
    entryTimeIst: signal.entryTimeIst,
    entryPrice: signal.entryPrice,
    exitTimeIst: "10:00",
    exitPrice: 520,
    targetHit: true,
    profit: 20,
    profitTarget: signal.profitTarget,
    bbMatchType: signal.bbMatchType,
    ...overrides,
  };
}

function makePayload(
  entries: DayScanSimulationSignal[],
  exits: DayScanSimulationExit[],
  sessionIndex = 0,
  simulatedTimeIst = "09:30",
): DayScanSimulationPayload {
  return {
    date: "2026-06-09",
    simulation: {
      sessionIndex,
      sessionCandleCount: 5,
      simulatedTimeIst,
    },
    entries,
    exits,
    errors: [],
    summary: {
      stocksScanned: 20,
      stocksWithSignals: entries.length,
      entryCount: entries.length,
      exitCount: exits.length,
      openPositions: entries.length - exits.length,
      buyCount: entries.filter((entry) => entry.side === "BUY").length,
      sellCount: entries.filter((entry) => entry.side === "SELL").length,
      targetsHit: exits.filter((exit) => exit.targetHit).length,
      avgProfit: null,
      errorCount: 0,
    },
  };
}

describe("dayOrderEngine", () => {
  it("builds stable signal keys", () => {
    const signal = makeSignal();
    expect(entrySignalKey(signal)).toBe("deepak-RELIANCE-09:30-1");
    expect(exitSignalKey(makeExit(signal))).toBe("deepak-RELIANCE-09:30-1");
  });

  it("opens a BUY entry only on the matching simulated candle", () => {
    const signal = makeSignal({ entryPrice: 500, entryTimeIst: "09:30" });
    const portfolio = processDayOrderTick(
      createInitialDayOrderPortfolio(),
      makePayload([signal], [], 0, "09:30"),
    );

    expect(portfolio.openPositions).toHaveLength(1);
    expect(portfolio.openPositions[0].quantity).toBe(ORDER_QUANTITY);
    expect(portfolio.cash).toBe(DAY_ORDER_INITIAL_CASH - 500 * ORDER_QUANTITY);
  });

  it("does not enter when the entry time has already passed", () => {
    const signal = makeSignal({ entryTimeIst: "10:15" });
    const portfolio = processDayOrderTick(
      createInitialDayOrderPortfolio(),
      makePayload([signal], [], 4, "13:00"),
    );

    expect(portfolio.openPositions).toHaveLength(0);
    expect(portfolio.skippedEntryKeys).toContain(entrySignalKey(signal));
  });

  it("opens multiple entries on the same candle when funds allow", () => {
    const first = makeSignal({
      tradingSymbol: "RELIANCE",
      entryPrice: 500,
      entryTimeIst: "10:15",
    });
    const second = makeSignal({
      tradingSymbol: "TCS",
      entryPrice: 600,
      entryTimeIst: "10:15",
      scenarioNumber: 2,
      scenarioKey: "buy-2",
    });

    const portfolio = processDayOrderTick(
      createInitialDayOrderPortfolio(),
      makePayload([first, second], [], 0, "10:15"),
    );

    expect(portfolio.openPositions).toHaveLength(2);
    expect(portfolio.cash).toBe(DAY_ORDER_INITIAL_CASH - (500 + 600) * ORDER_QUANTITY);
  });

  it("opens a later entry while another position is still open", () => {
    const first = makeSignal({
      tradingSymbol: "RELIANCE",
      entryPrice: 1500,
      entryTimeIst: "09:30",
    });
    const second = makeSignal({
      tradingSymbol: "TCS",
      entryPrice: 1500,
      entryTimeIst: "10:00",
    });

    const at0930 = processDayOrderTick(
      createInitialDayOrderPortfolio(),
      makePayload([first, second], [], 0, "09:30"),
    );
    expect(at0930.openPositions).toHaveLength(1);

    const at1000 = processDayOrderTick(
      at0930,
      makePayload([first, second], [], 1, "10:00"),
    );

    expect(at1000.openPositions).toHaveLength(2);
    expect(at1000.openPositions.map((position) => position.tradingSymbol)).toEqual([
      "RELIANCE",
      "TCS",
    ]);
  });

  it("enters a new signal on its entry candle after an earlier position exits", () => {
    const first = makeSignal({
      tradingSymbol: "RELIANCE",
      entryPrice: 1500,
      entryTimeIst: "09:30",
    });
    const second = makeSignal({
      tradingSymbol: "TCS",
      entryPrice: 1500,
      entryTimeIst: "10:15",
    });
    const firstExit = makeExit(first, { exitTimeIst: "10:00", exitPrice: 1510 });

    const at0930 = processDayOrderTick(
      createInitialDayOrderPortfolio(),
      makePayload([first, second], [], 0, "09:30"),
    );
    const at1000 = processDayOrderTick(
      at0930,
      makePayload([first, second], [firstExit], 1, "10:00"),
    );
    expect(at1000.openPositions).toHaveLength(0);

    const at1015 = processDayOrderTick(
      at1000,
      makePayload([first, second], [firstExit], 2, "10:15"),
    );

    expect(at1015.openPositions).toHaveLength(1);
    expect(at1015.openPositions[0].tradingSymbol).toBe("TCS");
  });

  it("does not retry a missed entry after cash is freed", () => {
    const first = makeSignal({
      tradingSymbol: "RELIANCE",
      entryPrice: 1900,
      entryTimeIst: "09:30",
    });
    const second = makeSignal({
      tradingSymbol: "TCS",
      entryPrice: 1900,
      entryTimeIst: "09:45",
    });
    const firstExit = makeExit(first, { exitTimeIst: "10:00", exitPrice: 1910 });

    // Cap cash so only one max-price entry fits (independent of ₹1cr default).
    const limitedCash = {
      ...createInitialDayOrderPortfolio(),
      cash: 200_000,
    };

    const at0930 = processDayOrderTick(
      limitedCash,
      makePayload([first, second], [], 0, "09:30"),
    );
    const at0945 = processDayOrderTick(
      at0930,
      makePayload([first, second], [], 1, "09:45"),
    );
    expect(at0945.skippedEntryKeys).toContain(entrySignalKey(second));

    const at1000 = processDayOrderTick(
      at0945,
      makePayload([first, second], [firstExit], 2, "10:00"),
    );
    expect(at1000.fills.some((fill) => fill.tradingSymbol === "TCS")).toBe(false);
  });

  it("skips entries above max price and marks them missed", () => {
    const signal = makeSignal({ entryPrice: 1901, entryTimeIst: "09:30" });
    const portfolio = processDayOrderTick(
      createInitialDayOrderPortfolio(),
      makePayload([signal], [], 0, "09:30"),
    );

    expect(portfolio.openPositions).toHaveLength(0);
    expect(portfolio.skippedEntryKeys).toContain(entrySignalKey(signal));
  });

  it("squares off at scan exit and realizes P&L", () => {
    const signal = makeSignal({ entryPrice: 500, entryTimeIst: "09:30" });
    const exit = makeExit(signal, { exitPrice: 520, exitTimeIst: "10:00" });
    const opened = processDayOrderTick(
      createInitialDayOrderPortfolio(),
      makePayload([signal], [], 0, "09:30"),
    );
    const closed = processDayOrderTick(
      opened,
      makePayload([signal], [exit], 1, "10:00"),
    );

    expect(closed.openPositions).toHaveLength(0);
    expect(closed.realizedPnL).toBe(2000);
  });

  it("does not duplicate entries on repeated ticks", () => {
    const signal = makeSignal({ entryTimeIst: "09:30" });
    const payload = makePayload([signal], [], 0, "09:30");
    const first = processDayOrderTick(createInitialDayOrderPortfolio(), payload);
    const second = processDayOrderTick(first, payload);

    expect(second.openPositions).toHaveLength(1);
    expect(second.fills.filter((fill) => fill.kind === "entry")).toHaveLength(1);
  });
});
