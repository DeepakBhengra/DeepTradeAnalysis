import type {
  DayScanSimulationExit,
  DayScanSimulationPayload,
  DayScanSimulationSignal,
} from "../types/backtest";
import type {
  DayOrderFill,
  DayOrderOpenPosition,
  DayOrderPnLSummary,
  DayOrderPortfolio,
  DayOrderRunSettings,
} from "../types/dayOrder";
import {
  DAY_ORDER_INITIAL_CASH,
  DEFAULT_DAY_ORDER_RUN_SETTINGS,
} from "../types/dayOrder";
import { formatDayScanStrategy } from "./backtestFormat";

let fillIdCounter = 0;

function createFillId(): string {
  fillIdCounter += 1;
  return `day-order-fill-${fillIdCounter}-${Date.now()}`;
}

export function entrySignalKey(signal: DayScanSimulationSignal): string {
  return `${signal.strategy}-${signal.tradingSymbol}-${signal.entryTimeIst}-${signal.scenarioNumber}`;
}

export function exitSignalKey(exit: DayScanSimulationExit): string {
  return `${exit.strategy}-${exit.tradingSymbol}-${exit.entryTimeIst}-${exit.scenarioNumber}`;
}

export function createInitialDayOrderPortfolio(): DayOrderPortfolio {
  return {
    cash: DAY_ORDER_INITIAL_CASH,
    openPositions: [],
    fills: [],
    realizedPnL: 0,
    skippedEntryKeys: [],
  };
}

function compareTimeIst(a: string, b: string): number {
  return a.localeCompare(b);
}

function requiredCapital(entryPrice: number, quantity: number): number {
  return entryPrice * quantity;
}

function deployedCapital(positions: DayOrderOpenPosition[]): number {
  return positions.reduce(
    (total, position) => total + position.entryPrice * position.quantity,
    0,
  );
}

export function computeDayOrderPnL(portfolio: DayOrderPortfolio): DayOrderPnLSummary {
  const deployed = deployedCapital(portfolio.openPositions);
  const equity = portfolio.cash + deployed;
  const unrealizedPnL = 0;
  const totalPnL = equity - DAY_ORDER_INITIAL_CASH;

  return {
    cash: portfolio.cash,
    deployedCapital: deployed,
    equity,
    unrealizedPnL,
    realizedPnL: portfolio.realizedPnL,
    totalPnL,
    returnPct:
      DAY_ORDER_INITIAL_CASH > 0 ? (totalPnL / DAY_ORDER_INITIAL_CASH) * 100 : 0,
  };
}

function createEntryFill(
  signal: DayScanSimulationSignal,
  signalKey: string,
  sessionIndex: number,
  quantity: number,
): DayOrderFill {
  return {
    id: createFillId(),
    kind: "entry",
    signalKey,
    tradingSymbol: signal.tradingSymbol,
    symbol: signal.symbol,
    strategy: signal.strategy,
    side: signal.side,
    quantity,
    price: signal.entryPrice,
    timeIst: signal.entryTimeIst,
    sessionIndex,
    realizedPnL: null,
  };
}

function createExitFill(
  exit: DayScanSimulationExit,
  position: DayOrderOpenPosition,
  sessionIndex: number,
  realizedPnL: number,
): DayOrderFill {
  const exitSide: DayOrderFill["side"] = position.side === "BUY" ? "SELL" : "BUY";

  return {
    id: createFillId(),
    kind: "exit",
    signalKey: position.signalKey,
    tradingSymbol: exit.tradingSymbol,
    symbol: exit.symbol,
    strategy: exit.strategy,
    side: exitSide,
    quantity: position.quantity,
    price: exit.exitPrice,
    timeIst: exit.exitTimeIst,
    sessionIndex,
    realizedPnL,
  };
}

function computeRealizedPnL(position: DayOrderOpenPosition, exitPrice: number): number {
  if (position.side === "BUY") {
    return (exitPrice - position.entryPrice) * position.quantity;
  }
  return (position.entryPrice - exitPrice) * position.quantity;
}

function processExits(
  portfolio: DayOrderPortfolio,
  exits: DayScanSimulationExit[],
  sessionIndex: number,
): DayOrderPortfolio {
  let next = portfolio;

  const sortedExits = [...exits].sort((a, b) =>
    compareTimeIst(a.exitTimeIst, b.exitTimeIst),
  );

  for (const exit of sortedExits) {
    const signalKey = exitSignalKey(exit);
    const positionIndex = next.openPositions.findIndex(
      (position) => position.signalKey === signalKey,
    );

    if (positionIndex < 0) {
      continue;
    }

    const position = next.openPositions[positionIndex];
    const pnl = computeRealizedPnL(position, exit.exitPrice);
    const marginReleased = requiredCapital(position.entryPrice, position.quantity);
    const exitProceeds =
      position.side === "BUY"
        ? exit.exitPrice * position.quantity
        : marginReleased + pnl;

    const fill = createExitFill(exit, position, sessionIndex, pnl);
    const openPositions = next.openPositions.filter((_, index) => index !== positionIndex);

    next = {
      cash: next.cash + exitProceeds,
      openPositions,
      fills: [...next.fills, fill],
      realizedPnL: next.realizedPnL + pnl,
      skippedEntryKeys: next.skippedEntryKeys,
    };
  }

  return next;
}

function canOpenEntry(
  portfolio: DayOrderPortfolio,
  entryPrice: number,
  quantity: number,
): boolean {
  return portfolio.cash >= requiredCapital(entryPrice, quantity);
}

function isEntryPriceInRange(
  entryPrice: number,
  settings: DayOrderRunSettings,
): boolean {
  return (
    entryPrice >= settings.minEntryPrice && entryPrice <= settings.maxEntryPrice
  );
}

function processEntries(
  portfolio: DayOrderPortfolio,
  entries: DayScanSimulationSignal[],
  sessionIndex: number,
  simulatedTimeIst: string,
  settings: DayOrderRunSettings,
): DayOrderPortfolio {
  let next: DayOrderPortfolio = {
    ...portfolio,
    skippedEntryKeys: [...portfolio.skippedEntryKeys],
  };
  const skippedKeys = new Set(next.skippedEntryKeys);
  const openKeys = new Set(next.openPositions.map((position) => position.signalKey));
  const closedKeys = new Set(
    next.fills.filter((fill) => fill.kind === "exit").map((fill) => fill.signalKey),
  );

  for (const signal of entries) {
    const signalKey = entrySignalKey(signal);
    if (
      signal.entryTimeIst < simulatedTimeIst &&
      !openKeys.has(signalKey) &&
      !closedKeys.has(signalKey)
    ) {
      skippedKeys.add(signalKey);
    }
  }

  const sortedEntries = [...entries].sort((a, b) =>
    compareTimeIst(a.entryTimeIst, b.entryTimeIst),
  );

  for (const signal of sortedEntries) {
    const signalKey = entrySignalKey(signal);

    if (openKeys.has(signalKey) || closedKeys.has(signalKey) || skippedKeys.has(signalKey)) {
      continue;
    }

    if (signal.entryTimeIst !== simulatedTimeIst) {
      continue;
    }

    if (!isEntryPriceInRange(signal.entryPrice, settings)) {
      skippedKeys.add(signalKey);
      continue;
    }

    if (!canOpenEntry(next, signal.entryPrice, settings.quantity)) {
      skippedKeys.add(signalKey);
      continue;
    }

    const margin = requiredCapital(signal.entryPrice, settings.quantity);
    const position: DayOrderOpenPosition = {
      signalKey,
      tradingSymbol: signal.tradingSymbol,
      symbol: signal.symbol,
      strategy: signal.strategy,
      side: signal.side,
      quantity: settings.quantity,
      entryPrice: signal.entryPrice,
      entryTimeIst: signal.entryTimeIst,
    };

    next = {
      cash: next.cash - margin,
      openPositions: [...next.openPositions, position],
      fills: [
        ...next.fills,
        createEntryFill(signal, signalKey, sessionIndex, settings.quantity),
      ],
      realizedPnL: next.realizedPnL,
      skippedEntryKeys: [...skippedKeys],
    };
    openKeys.add(signalKey);
  }

  next.skippedEntryKeys = [...skippedKeys];
  return next;
}

export function processDayOrderTick(
  portfolio: DayOrderPortfolio,
  payload: DayScanSimulationPayload,
  settings: DayOrderRunSettings = DEFAULT_DAY_ORDER_RUN_SETTINGS,
): DayOrderPortfolio {
  const sessionIndex = payload.simulation.sessionIndex;
  const simulatedTimeIst = payload.simulation.simulatedTimeIst;
  const afterExits = processExits(portfolio, payload.exits, sessionIndex);
  return processEntries(
    afterExits,
    payload.entries,
    sessionIndex,
    simulatedTimeIst,
    settings,
  );
}

/** Validate UI-editable run settings; returns an error message or null. */
export function validateDayOrderRunSettings(settings: DayOrderRunSettings): string | null {
  if (!Number.isInteger(settings.quantity) || settings.quantity < 1) {
    return "Quantity must be a positive integer.";
  }
  if (!Number.isFinite(settings.minEntryPrice) || settings.minEntryPrice < 0) {
    return "Min entry price must be a number ≥ 0.";
  }
  if (!Number.isFinite(settings.maxEntryPrice) || settings.maxEntryPrice < 0) {
    return "Max entry price must be a number ≥ 0.";
  }
  if (settings.minEntryPrice > settings.maxEntryPrice) {
    return "Min entry price cannot be greater than max entry price.";
  }
  return null;
}
