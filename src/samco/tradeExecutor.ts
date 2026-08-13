import { config } from "../config.js";
import type { DeepakDecisionResult, DeepakTradeSignal } from "../types.js";
import { formatIstTime, getIstTimeParts, parseHmToMinutes } from "../utils/marketTime.js";
import {
  getSamcoOrderStatus,
  getSamcoPositions,
  isSamcoOrderFilled,
  placeSamcoOrder,
  squareOffSamcoPositions,
  waitForSamcoOrderFill,
  type SamcoPlaceOrderRequest,
} from "./samcoClient.js";
import {
  formatSamcoLimitPrice,
  resolveSamcoPlaceOrderType,
} from "./samcoOrderType.js";
import { getSamcoLiveTradingEnabled } from "./samcoLiveTrading.js";
import {
  getSamcoDryRun,
  getSamcoEffectiveQuantity,
  getSamcoEntryPriceRange,
  getSamcoStopLossPct,
} from "./samcoRuntimeSettings.js";
import { withSamcoMaterializeLock } from "./samcoMaterializeLock.js";
import {
  findLedgerEntry,
  getOpenLedgerEntries,
  loadPositionLedger,
  savePositionLedger,
  upsertLedgerEntry,
  type LedgerEntry,
  type PositionLedger,
} from "./positionLedger.js";
import {
  buildSignalKey,
  oppositeTransactionType,
  type SamcoStrategy,
} from "./signalKeys.js";
import {
  isStopLossHit,
  normalizeStopLossPct,
} from "../utils/stopLossPct.js";

export interface TradeExecutorLog {
  level: "info" | "warn" | "error";
  message: string;
  signalKey?: string;
}

export interface ProcessDecisionResult {
  entriesPlaced: number;
  exitsPlaced: number;
  eodSquareOffs: number;
  /** Entries that matched timing but already existed in the ledger (rescan skip). */
  entriesSkipped: number;
  logs: TradeExecutorLog[];
}

export interface TradeExecutorOptions {
  tradingSymbol?: string;
  exchange?: string;
  dryRun?: boolean;
  liveTradingEnabled?: boolean;
  stockName?: string;
  source?: "dayscan" | "poll";
}

function defaultOptions(): Required<TradeExecutorOptions> {
  return {
    tradingSymbol: config.tradingSymbol,
    exchange: config.exchange,
    dryRun: getSamcoDryRun(),
    liveTradingEnabled: getSamcoLiveTradingEnabled(),
    stockName: "",
    source: "poll",
  };
}

function shouldExitSignal(signal: DeepakTradeSignal): boolean {
  if (!signal.exit) {
    return false;
  }
  return (
    signal.exit.targetHit === true ||
    signal.exit.exitReason === "deepak2_stop"
  );
}

function buildPlaceOrderRequest(
  signal: DeepakTradeSignal,
  options: Required<TradeExecutorOptions>,
): SamcoPlaceOrderRequest {
  // Samco placeOrder accepts only L / SL (not MKT). Price is mandatory for both.
  const orderType = resolveSamcoPlaceOrderType(config.samco.orderType);
  const request: SamcoPlaceOrderRequest = {
    symbolName: options.tradingSymbol,
    exchange: options.exchange,
    transactionType: signal.side,
    orderType,
    quantity: String(getSamcoEffectiveQuantity()),
    disclosedQuantity: "",
    orderValidity: "DAY",
    productType: config.samco.productType,
    afterMarketOrderFlag: "NO",
    price: formatSamcoLimitPrice(signal.price),
  };

  return request;
}

/** Persist a pending claim before calling Samco so a rescan cannot double-place. */
function claimPendingEntry(
  ledger: PositionLedger,
  draft: Omit<LedgerEntry, "status" | "orderNumber"> & {
    orderNumber?: string | null;
  },
): { ledger: PositionLedger; claimed: boolean } {
  if (findLedgerEntry(ledger, draft.signalKey)) {
    return { ledger, claimed: false };
  }
  const next = upsertLedgerEntry(ledger, {
    ...draft,
    orderNumber: draft.orderNumber ?? null,
    status: "pending",
  });
  savePositionLedger(next);
  return { ledger: next, claimed: true };
}

function persistLedgerEntry(
  ledger: PositionLedger,
  entry: LedgerEntry,
): PositionLedger {
  const next = upsertLedgerEntry(ledger, entry);
  savePositionLedger(next);
  return next;
}

async function placeEntryOrder(
  signal: DeepakTradeSignal,
  strategy: SamcoStrategy,
  options: Required<TradeExecutorOptions>,
  logs: TradeExecutorLog[],
): Promise<LedgerEntry | null> {
  const signalKey = buildSignalKey({
    strategy,
    tradingSymbol: options.tradingSymbol,
    entryTimeIst: signal.timeIst,
    scenarioNumber: signal.scenarioNumber,
  });

  const { min: entryPriceMin, max: entryPriceMax } = getSamcoEntryPriceRange();
  if (signal.price < entryPriceMin || signal.price > entryPriceMax) {
    const reason = `Skipped entry outside price range (${signal.price} not in [${entryPriceMin}, ${entryPriceMax}]).`;
    logs.push({
      level: "warn",
      message: reason,
      signalKey,
    });
    return {
      signalKey,
      strategy,
      tradingSymbol: options.tradingSymbol,
      stockName: options.stockName || options.tradingSymbol,
      exchange: options.exchange,
      side: signal.side,
      quantity: getSamcoEffectiveQuantity(),
      entryPrice: signal.price,
      limitPrice: signal.price,
      entryTimeIst: signal.timeIst,
      orderNumber: null,
      status: "failed",
      exitReason: "price_filter",
      rejectedReason: reason,
      lastError: reason,
      source: options.source,
    };
  }

  const request = buildPlaceOrderRequest(signal, options);

  if (options.dryRun || !options.liveTradingEnabled) {
    logs.push({
      level: "info",
      message: `Dry-run entry ${signal.side} ${options.tradingSymbol} qty=${request.quantity} (${strategy}).`,
      signalKey,
    });
    return {
      signalKey,
      strategy,
      tradingSymbol: options.tradingSymbol,
      stockName: options.stockName || options.tradingSymbol,
      exchange: options.exchange,
      side: signal.side,
      quantity: getSamcoEffectiveQuantity(),
      entryPrice: signal.price,
      limitPrice: signal.price,
      entryTimeIst: signal.timeIst,
      orderNumber: null,
      status: "open",
      source: options.source,
    };
  }

  const placed = await placeSamcoOrder(request);
  const orderNumber = placed.orderNumber;
  if (!orderNumber) {
    throw new Error("Samco place order succeeded without orderNumber.");
  }

  const fillStatus = await waitForSamcoOrderFill(orderNumber);
  if (!isSamcoOrderFilled(fillStatus.orderStatus)) {
    throw new Error(
      `Samco entry order ${orderNumber} ended in status ${fillStatus.orderStatus ?? "unknown"}.`,
    );
  }

  const filledQty = Number(fillStatus.orderDetails?.filledQuantity ?? request.quantity);
  const entryPrice = Number(
    fillStatus.orderDetails?.avgExecutionPrice ??
      fillStatus.orderDetails?.orderPrice ??
      signal.price,
  );

  logs.push({
    level: "info",
    message: `Entry filled ${signal.side} ${options.tradingSymbol} @ ${entryPrice} (order ${orderNumber}).`,
    signalKey,
  });

  return {
    signalKey,
    strategy,
    tradingSymbol: options.tradingSymbol,
    stockName: options.stockName || options.tradingSymbol,
    exchange: options.exchange,
    side: signal.side,
    quantity: Number.isFinite(filledQty) ? filledQty : getSamcoEffectiveQuantity(),
    entryPrice: Number.isFinite(entryPrice) ? entryPrice : signal.price,
    limitPrice: signal.price,
    entryTimeIst: signal.timeIst,
    orderNumber,
    status: "open",
    source: options.source,
  };
}

async function squareOffLedgerEntry(
  entry: LedgerEntry,
  exitReason: LedgerEntry["exitReason"],
  options: Required<TradeExecutorOptions>,
  logs: TradeExecutorLog[],
): Promise<LedgerEntry> {
  const closing: LedgerEntry = { ...entry, status: "closing", exitReason };

  if (options.dryRun || !options.liveTradingEnabled) {
    logs.push({
      level: "info",
      message: `Dry-run square-off ${entry.tradingSymbol} qty=${entry.quantity} (${exitReason ?? "exit"}).`,
      signalKey: entry.signalKey,
    });
    return {
      ...closing,
      status: "closed",
      exitSide: oppositeTransactionType(entry.side),
      exitLimitPrice: entry.exitLimitPrice ?? entry.entryPrice,
      exitPrice: entry.exitPrice ?? entry.entryPrice,
      exitTimeIst: entry.exitTimeIst ?? formatIstTime(new Date()),
      closedAt: new Date().toISOString(),
    };
  }

  const response = await squareOffSamcoPositions([
    {
      exchange: entry.exchange,
      symbolName: entry.tradingSymbol,
      productType: config.samco.productType,
      netQuantity: String(entry.quantity),
      transactionType: oppositeTransactionType(entry.side),
    },
  ]);

  const first = response.positionSquareOffResponseList?.[0];
  if (first?.status === "Failure") {
    throw new Error(first.statusMessage ?? "Samco square-off failed.");
  }

  const positions = await getSamcoPositions("DAY");
  const stillOpen = positions.positionDetails?.some((position) => {
    const symbol = position.tradingSymbol?.replace(/-EQ$/i, "") ?? "";
    const qty = Number(position.netQuantity ?? "0");
    return (
      symbol === entry.tradingSymbol &&
      position.productCode === config.samco.productType &&
      qty !== 0
    );
  });

  if (stillOpen) {
    logs.push({
      level: "warn",
      message: `Square-off submitted but position may still be open for ${entry.tradingSymbol}.`,
      signalKey: entry.signalKey,
    });
  }

  logs.push({
    level: "info",
    message: `Square-off completed for ${entry.tradingSymbol} (${exitReason ?? "exit"}).`,
    signalKey: entry.signalKey,
  });

  return {
    ...closing,
    status: "closed",
    exitSide: oppositeTransactionType(entry.side),
    exitLimitPrice: entry.exitLimitPrice ?? entry.entryPrice,
    exitPrice: entry.exitPrice ?? entry.entryPrice,
    exitTimeIst: entry.exitTimeIst ?? formatIstTime(new Date()),
    closedAt: new Date().toISOString(),
  };
}

export function isEodSquareOffDue(now = new Date()): boolean {
  const { minutesOfDay } = getIstTimeParts(now);
  const start = parseHmToMinutes(config.samco.eodSquareOffStart);
  const end = parseHmToMinutes(config.samco.eodSquareOffEnd);
  return minutesOfDay > start && minutesOfDay <= end;
}

export async function forceEodSquareOff(
  options?: TradeExecutorOptions,
): Promise<ProcessDecisionResult> {
  const resolved = { ...defaultOptions(), ...options };
  const logs: TradeExecutorLog[] = [];
  let ledger = loadPositionLedger();
  let eodSquareOffs = 0;

  for (const entry of getOpenLedgerEntries(ledger)) {
    try {
      const closed = await squareOffLedgerEntry(entry, "eod", resolved, logs);
      ledger = upsertLedgerEntry(ledger, closed);
      eodSquareOffs += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push({
        level: "error",
        message: `EOD square-off failed: ${message}`,
        signalKey: entry.signalKey,
      });
      ledger = upsertLedgerEntry(ledger, {
        ...entry,
        status: "failed",
        lastError: message,
      });
    }
  }

  savePositionLedger(ledger);
  return {
    entriesPlaced: 0,
    exitsPlaced: eodSquareOffs,
    eodSquareOffs,
    entriesSkipped: 0,
    logs,
  };
}

/**
 * Voluntarily square off one open/closing ledger position by signal key.
 * Uses markPrice when available; otherwise falls back to entry/limit price.
 */
export async function squareOffLedgerBySignalKey(
  signalKey: string,
  options?: TradeExecutorOptions,
): Promise<ProcessDecisionResult> {
  const resolved = { ...defaultOptions(), ...options };
  const logs: TradeExecutorLog[] = [];

  return withSamcoMaterializeLock(async () => {
    let ledger = loadPositionLedger();
    const entry = findLedgerEntry(ledger, signalKey);
    if (!entry) {
      throw new Error(`No ledger entry found for signalKey ${signalKey}.`);
    }
    if (entry.status !== "open" && entry.status !== "closing") {
      throw new Error(
        `Ledger entry ${signalKey} is ${entry.status}; only open/closing positions can be exited.`,
      );
    }

    const markOrEntry =
      typeof entry.markPrice === "number" && Number.isFinite(entry.markPrice)
        ? entry.markPrice
        : typeof entry.entryPrice === "number" && Number.isFinite(entry.entryPrice)
          ? entry.entryPrice
          : typeof entry.limitPrice === "number" && Number.isFinite(entry.limitPrice)
            ? entry.limitPrice
            : null;

    const nowIst = formatIstTime(new Date());
    try {
      const closed = await squareOffLedgerEntry(
        {
          ...entry,
          exitPrice: markOrEntry,
          exitLimitPrice: markOrEntry,
          exitTimeIst: nowIst,
        },
        "manual",
        {
          ...resolved,
          tradingSymbol: entry.tradingSymbol,
          exchange: entry.exchange,
          stockName: entry.stockName || entry.tradingSymbol,
          source: entry.source === "dayscan" ? "dayscan" : "poll",
        },
        logs,
      );
      ledger = persistLedgerEntry(ledger, closed);
      logs.push({
        level: "info",
        message: `Manual exit ${entry.tradingSymbol} @ ${markOrEntry ?? "n/a"}.`,
        signalKey: entry.signalKey,
      });
      savePositionLedger(ledger);
      return {
        entriesPlaced: 0,
        exitsPlaced: 1,
        eodSquareOffs: 0,
        entriesSkipped: 0,
        logs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push({
        level: "error",
        message: `Manual exit failed: ${message}`,
        signalKey: entry.signalKey,
      });
      ledger = persistLedgerEntry(ledger, {
        ...entry,
        status: "failed",
        lastError: message,
      });
      savePositionLedger(ledger);
      throw error;
    }
  });
}

export async function processDecisionResult(
  strategy: SamcoStrategy,
  result: Pick<DeepakDecisionResult, "signals">,
  latestCandleTimeIst: string,
  options?: TradeExecutorOptions,
): Promise<ProcessDecisionResult> {
  return withSamcoMaterializeLock(async () => {
    const resolved = { ...defaultOptions(), ...options };
    const logs: TradeExecutorLog[] = [];
    let ledger = loadPositionLedger();
    let entriesPlaced = 0;
    let exitsPlaced = 0;
    let entriesSkipped = 0;

    for (const signal of result.signals) {
      const signalKey = buildSignalKey({
        strategy,
        tradingSymbol: resolved.tradingSymbol,
        entryTimeIst: signal.timeIst,
        scenarioNumber: signal.scenarioNumber,
      });
      const existing = findLedgerEntry(ledger, signalKey);
      const timingOk =
        signal.timeIst === latestCandleTimeIst && signal.exit == null;

      if (existing && timingOk) {
        entriesSkipped += 1;
      } else if (!existing && timingOk) {
        const claim = claimPendingEntry(ledger, {
          signalKey,
          strategy,
          tradingSymbol: resolved.tradingSymbol,
          stockName: resolved.stockName || resolved.tradingSymbol,
          exchange: resolved.exchange,
          side: signal.side,
          quantity: getSamcoEffectiveQuantity(),
          entryPrice: signal.price,
          limitPrice: signal.price,
          entryTimeIst: signal.timeIst,
          source: resolved.source,
        });
        ledger = claim.ledger;
        if (!claim.claimed) {
          entriesSkipped += 1;
        } else {
          try {
            const entry = await placeEntryOrder(
              signal,
              strategy,
              resolved,
              logs,
            );
            if (entry) {
              ledger = persistLedgerEntry(ledger, entry);
              if (entry.status !== "failed") {
                entriesPlaced += 1;
              }
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            logs.push({
              level: "error",
              message: `Entry failed: ${message}`,
              signalKey,
            });
            ledger = persistLedgerEntry(ledger, {
              signalKey,
              strategy,
              tradingSymbol: resolved.tradingSymbol,
              stockName: resolved.stockName || resolved.tradingSymbol,
              exchange: resolved.exchange,
              side: signal.side,
              quantity: getSamcoEffectiveQuantity(),
              entryPrice: signal.price,
              limitPrice: signal.price,
              entryTimeIst: signal.timeIst,
              orderNumber: null,
              status: "failed",
              lastError: message,
              rejectedReason: message,
              source: resolved.source,
            });
          }
        }
      }

      const openEntry = findLedgerEntry(ledger, signalKey);
      if (
        openEntry &&
        (openEntry.status === "open" || openEntry.status === "closing") &&
        shouldExitSignal(signal) &&
        signal.exit?.timeIst === latestCandleTimeIst
      ) {
        try {
          const closed = await squareOffLedgerEntry(
            openEntry,
            signal.exit?.exitReason ?? "target",
            resolved,
            logs,
          );
          ledger = persistLedgerEntry(ledger, closed);
          exitsPlaced += 1;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logs.push({
            level: "error",
            message: `Exit failed: ${message}`,
            signalKey,
          });
          ledger = persistLedgerEntry(ledger, {
            ...openEntry,
            status: "failed",
            lastError: message,
          });
        }
      }
    }

    savePositionLedger(ledger);
    return {
      entriesPlaced,
      exitsPlaced,
      eodSquareOffs: 0,
      entriesSkipped,
      logs,
    };
  });
}

export async function processDayScanSignalSnapshot(
  snapshot: {
    strategy: SamcoStrategy;
    trades: Array<{
      tradingSymbol: string;
      stockName: string;
      side: "BUY" | "SELL";
      scenarioNumber: number;
      entryTimeIst: string;
      entryPrice: number;
      exitTimeIst: string | null;
      exitPrice: number | null;
      targetHit: boolean;
      exitReason?: string | null;
      stopLossHit?: boolean;
      markPrice?: number | null;
    }>;
  },
  latestCandleTimeIst: string | null,
  options?: { mode?: "current_candle" | "full" | "catch_up" },
): Promise<ProcessDecisionResult> {
  return withSamcoMaterializeLock(async () => {
    const mode = options?.mode ?? "current_candle";
    const logs: TradeExecutorLog[] = [];
    let entriesPlaced = 0;
    let exitsPlaced = 0;
    let entriesSkipped = 0;
    // Reload inside the lock so overlapping Day Scan rescans see claims.
    let ledger = loadPositionLedger();

    if (
      (mode === "current_candle" || mode === "catch_up") &&
      !latestCandleTimeIst
    ) {
      return {
        entriesPlaced: 0,
        exitsPlaced: 0,
        eodSquareOffs: 0,
        entriesSkipped: 0,
        logs,
      };
    }

    const latestMinutes =
      latestCandleTimeIst != null
        ? parseHmToMinutes(latestCandleTimeIst)
        : null;

    for (const trade of snapshot.trades) {
      const signalKey = buildSignalKey({
        strategy: snapshot.strategy,
        tradingSymbol: trade.tradingSymbol,
        entryTimeIst: trade.entryTimeIst,
        scenarioNumber: trade.scenarioNumber,
      });
      const resolved = {
        ...defaultOptions(),
        tradingSymbol: trade.tradingSymbol,
        stockName: trade.stockName,
        source: "dayscan" as const,
      };
      const existing = findLedgerEntry(ledger, signalKey);
      const entryMinutes = parseHmToMinutes(trade.entryTimeIst);

      const timingOk =
        mode === "full"
          ? true
          : mode === "catch_up"
            ? latestMinutes != null && entryMinutes <= latestMinutes
            : // Live single-candle: only open (no exit yet) entries at the current candle.
              trade.exitTimeIst == null &&
              trade.entryTimeIst === latestCandleTimeIst;

      if (existing && timingOk) {
        entriesSkipped += 1;
        if (
          (existing.status === "open" ||
            existing.status === "closing" ||
            existing.status === "pending") &&
          typeof trade.markPrice === "number" &&
          Number.isFinite(trade.markPrice)
        ) {
          ledger = persistLedgerEntry(ledger, {
            ...existing,
            markPrice: trade.markPrice,
          });
        }
      } else if (!existing && timingOk) {
        const claim = claimPendingEntry(ledger, {
          signalKey,
          strategy: snapshot.strategy,
          tradingSymbol: trade.tradingSymbol,
          stockName: trade.stockName,
          exchange: resolved.exchange,
          side: trade.side,
          quantity: getSamcoEffectiveQuantity(),
          entryPrice: trade.entryPrice,
          limitPrice: trade.entryPrice,
          entryTimeIst: trade.entryTimeIst,
          source: "dayscan",
          markPrice:
            typeof trade.markPrice === "number" && Number.isFinite(trade.markPrice)
              ? trade.markPrice
              : null,
        });
        ledger = claim.ledger;
        if (!claim.claimed) {
          entriesSkipped += 1;
        } else {
          const signal: DeepakTradeSignal = {
            side: trade.side,
            scenarioKey: `${snapshot.strategy}-${trade.tradingSymbol}`,
            scenarioNumber: trade.scenarioNumber,
            timeIst: trade.entryTimeIst,
            price: trade.entryPrice,
            bbMatchType: "close",
            profitTarget: 0,
            exit: null,
          };
          try {
            const entry = await placeEntryOrder(
              signal,
              snapshot.strategy,
              resolved,
              logs,
            );
            if (entry) {
              ledger = persistLedgerEntry(ledger, {
                ...entry,
                markPrice:
                  typeof trade.markPrice === "number" &&
                  Number.isFinite(trade.markPrice)
                    ? trade.markPrice
                    : entry.markPrice ?? null,
              });
              if (entry.status !== "failed") {
                entriesPlaced += 1;
              }
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            logs.push({
              level: "error",
              message: `Day Scan entry failed: ${message}`,
              signalKey,
            });
            ledger = persistLedgerEntry(ledger, {
              signalKey,
              strategy: snapshot.strategy,
              tradingSymbol: trade.tradingSymbol,
              stockName: trade.stockName,
              exchange: resolved.exchange,
              side: trade.side,
              quantity: getSamcoEffectiveQuantity(),
              entryPrice: trade.entryPrice,
              limitPrice: trade.entryPrice,
              entryTimeIst: trade.entryTimeIst,
              orderNumber: null,
              status: "failed",
              lastError: message,
              rejectedReason: message,
              source: "dayscan",
            });
          }
        }
      } else if (
        existing &&
        (existing.status === "open" ||
          existing.status === "closing" ||
          existing.status === "pending") &&
        typeof trade.markPrice === "number" &&
        Number.isFinite(trade.markPrice)
      ) {
        // Refresh mark even when entry timing gate skipped (e.g. already applied).
        ledger = persistLedgerEntry(ledger, {
          ...existing,
          markPrice: trade.markPrice,
        });
      }

      const openEntry = findLedgerEntry(ledger, signalKey);
      const exitMinutes =
        trade.exitTimeIst != null
          ? parseHmToMinutes(trade.exitTimeIst)
          : null;
      const shouldPlaceExit =
        openEntry &&
        (openEntry.status === "open" || openEntry.status === "closing") &&
        trade.exitTimeIst != null &&
        (mode === "full"
          ? true
          : mode === "catch_up"
            ? latestMinutes != null &&
              exitMinutes != null &&
              exitMinutes <= latestMinutes
            : trade.exitTimeIst === latestCandleTimeIst);

      if (shouldPlaceExit && openEntry) {
        try {
          const closed = await squareOffLedgerEntry(
            {
              ...openEntry,
              exitTimeIst: trade.exitTimeIst,
              exitPrice: trade.exitPrice,
              exitLimitPrice: trade.exitPrice,
            },
            trade.exitReason === "deepak2_stop"
              ? "deepak2_stop"
              : trade.exitReason === "breakeven"
                ? "breakeven"
                : trade.exitReason === "flip"
                  ? "flip"
                  : trade.exitReason === "eod"
                    ? "eod"
                    : trade.exitReason === "stop_loss"
                      ? "stop_loss"
                      : "target",
            resolved,
            logs,
          );
          ledger = persistLedgerEntry(ledger, closed);
          exitsPlaced += 1;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logs.push({
            level: "error",
            message: `Day Scan exit failed: ${message}`,
            signalKey,
          });
          ledger = persistLedgerEntry(ledger, {
            ...openEntry,
            status: "failed",
            lastError: message,
            rejectedReason: message,
          });
        }
      }
    }

    savePositionLedger(ledger);
    return {
      entriesPlaced,
      exitsPlaced,
      eodSquareOffs: 0,
      entriesSkipped,
      logs,
    };
  });
}

/**
 * For open ledger rows with a mark price, exit when adverse move ≥ configured
 * stop-loss %. Does not open a reverse BUY/SELL — stays flat until the next signal.
 */
export async function applyConfiguredStopLoss(
  options?: TradeExecutorOptions,
): Promise<ProcessDecisionResult> {
  const resolved = { ...defaultOptions(), ...options };
  const stopLossPct = normalizeStopLossPct(getSamcoStopLossPct());
  const logs: TradeExecutorLog[] = [];
  let exitsPlaced = 0;

  if (stopLossPct == null) {
    return {
      entriesPlaced: 0,
      exitsPlaced: 0,
      eodSquareOffs: 0,
      entriesSkipped: 0,
      logs,
    };
  }

  return withSamcoMaterializeLock(async () => {
    let ledger = loadPositionLedger();
    const openEntries = getOpenLedgerEntries(ledger);

    for (const entry of openEntries) {
      const entryPrice =
        typeof entry.entryPrice === "number" && Number.isFinite(entry.entryPrice)
          ? entry.entryPrice
          : typeof entry.limitPrice === "number" && Number.isFinite(entry.limitPrice)
            ? entry.limitPrice
            : null;
      const markPrice =
        typeof entry.markPrice === "number" && Number.isFinite(entry.markPrice)
          ? entry.markPrice
          : null;

      if (entryPrice == null || markPrice == null) {
        continue;
      }

      if (!isStopLossHit(entry.side, entryPrice, markPrice, stopLossPct)) {
        continue;
      }

      const nowIst = formatIstTime(new Date());
      try {
        const closed = await squareOffLedgerEntry(
          {
            ...entry,
            exitPrice: markPrice,
            exitLimitPrice: markPrice,
            exitTimeIst: nowIst,
          },
          "stop_loss",
          {
            ...resolved,
            tradingSymbol: entry.tradingSymbol,
            exchange: entry.exchange,
            stockName: entry.stockName || entry.tradingSymbol,
            source: entry.source === "dayscan" ? "dayscan" : "poll",
          },
          logs,
        );
        ledger = persistLedgerEntry(ledger, closed);
        exitsPlaced += 1;
        logs.push({
          level: "info",
          message: `Stop-loss ${stopLossPct}% hit on ${entry.tradingSymbol} (entry ${entryPrice} → mark ${markPrice}); squared off (no reverse).`,
          signalKey: entry.signalKey,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logs.push({
          level: "error",
          message: `Stop-loss square-off failed: ${message}`,
          signalKey: entry.signalKey,
        });
        ledger = persistLedgerEntry(ledger, {
          ...entry,
          status: "failed",
          lastError: message,
        });
      }
    }

    savePositionLedger(ledger);
    return {
      entriesPlaced: 0,
      exitsPlaced,
      eodSquareOffs: 0,
      entriesSkipped: 0,
      logs,
    };
  });
}

/** @deprecated Use applyConfiguredStopLoss — reverse entries are no longer placed. */
export const applyConfiguredStopLossAndReverse = applyConfiguredStopLoss;

export async function reconcilePendingEntries(
  options?: TradeExecutorOptions,
): Promise<TradeExecutorLog[]> {
  const resolved = { ...defaultOptions(), ...options };
  if (resolved.dryRun || !resolved.liveTradingEnabled) {
    return [];
  }

  const logs: TradeExecutorLog[] = [];
  let ledger = loadPositionLedger();

  for (const entry of ledger.entries.filter((row) => row.status === "pending")) {
    if (!entry.orderNumber) {
      continue;
    }

    const status = await getSamcoOrderStatus(entry.orderNumber);
    if (isSamcoOrderFilled(status.orderStatus)) {
      const entryPrice = Number(
        status.orderDetails?.avgExecutionPrice ?? entry.entryPrice ?? 0,
      );
      ledger = upsertLedgerEntry(ledger, {
        ...entry,
        status: "open",
        entryPrice: Number.isFinite(entryPrice) ? entryPrice : entry.entryPrice,
      });
      logs.push({
        level: "info",
        message: `Reconciled pending entry ${entry.orderNumber} as open.`,
        signalKey: entry.signalKey,
      });
    }
  }

  savePositionLedger(ledger);
  return logs;
}

export function formatLatestCandleTimeIst(date: Date | undefined): string {
  if (!date) {
    return "";
  }
  return formatIstTime(date);
}
