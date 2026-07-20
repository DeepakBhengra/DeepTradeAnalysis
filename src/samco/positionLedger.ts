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
  exchange: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number | null;
  entryTimeIst: string;
  orderNumber: string | null;
  status: LedgerPositionStatus;
  exitReason?: DeepakExitReason | "eod";
  closedAt?: string;
  lastError?: string;
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
    return parsed;
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
  const index = ledger.entries.findIndex(
    (existing) => existing.signalKey === entry.signalKey,
  );

  const entries =
    index >= 0
      ? ledger.entries.map((existing, i) => (i === index ? entry : existing))
      : [...ledger.entries, entry];

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
