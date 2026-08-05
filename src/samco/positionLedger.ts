import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "../config.js";
import type { DeepakExitReason } from "../types.js";
import type { SamcoStrategy } from "./signalKeys.js";

export type LedgerPositionStatus =
  | "pending"
  | "open"
  | "closing"
  | "closed"
  | "failed";

export interface LedgerEntry {
  signalKey: string;
  strategy: SamcoStrategy;
  tradingSymbol: string;
  /** Human-readable stock name when available from Day Scan. */
  stockName?: string;
  exchange: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number | null;
  /** Limit / signal price used for the entry order. */
  limitPrice: number | null;
  entryTimeIst: string;
  orderNumber: string | null;
  status: LedgerPositionStatus;
  exitReason?: DeepakExitReason | "eod" | "price_filter";
  exitTimeIst?: string | null;
  exitPrice?: number | null;
  exitLimitPrice?: number | null;
  exitSide?: "BUY" | "SELL";
  exitOrderNumber?: string | null;
  closedAt?: string;
  lastError?: string;
  rejectedReason?: string;
  source?: "dayscan" | "poll";
}

export interface PositionLedger {
  version: 1;
  updatedAt: string;
  entries: LedgerEntry[];
}

function ledgerFilePath(): string {
  return resolve(process.cwd(), config.samco.ledgerPath);
}

function createEmptyLedger(): PositionLedger {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

function normalizeEntry(entry: LedgerEntry): LedgerEntry {
  return {
    ...entry,
    limitPrice:
      entry.limitPrice ??
      (typeof entry.entryPrice === "number" ? entry.entryPrice : null),
  };
}

export function loadPositionLedger(): PositionLedger {
  const filePath = ledgerFilePath();
  if (!existsSync(filePath)) {
    return createEmptyLedger();
  }

  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as PositionLedger;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return createEmptyLedger();
    }
    return {
      ...parsed,
      entries: parsed.entries.map((entry) => normalizeEntry(entry)),
    };
  } catch {
    return createEmptyLedger();
  }
}

export function savePositionLedger(ledger: PositionLedger): void {
  const filePath = ledgerFilePath();
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  writeFileSync(
    filePath,
    JSON.stringify(
      {
        ...ledger,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function findLedgerEntry(
  ledger: PositionLedger,
  signalKey: string,
): LedgerEntry | undefined {
  return ledger.entries.find((entry) => entry.signalKey === signalKey);
}

export function getOpenLedgerEntries(ledger: PositionLedger): LedgerEntry[] {
  return ledger.entries.filter(
    (entry) => entry.status === "open" || entry.status === "closing",
  );
}

export function upsertLedgerEntry(
  ledger: PositionLedger,
  entry: LedgerEntry,
): PositionLedger {
  const normalized = normalizeEntry(entry);
  const index = ledger.entries.findIndex(
    (existing) => existing.signalKey === normalized.signalKey,
  );

  const entries =
    index >= 0
      ? ledger.entries.map((existing, i) => (i === index ? normalized : existing))
      : [...ledger.entries, normalized];

  return {
    ...ledger,
    entries,
    updatedAt: new Date().toISOString(),
  };
}

export function resetPositionLedger(): PositionLedger {
  const ledger = createEmptyLedger();
  savePositionLedger(ledger);
  return ledger;
}
