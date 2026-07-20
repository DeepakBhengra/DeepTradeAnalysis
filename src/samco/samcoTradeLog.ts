import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getIstTimeParts } from "../utils/marketTime.js";
import type { TradeExecutorLog } from "./tradeExecutor.js";

const LOG_PATH = resolve(process.cwd(), "data/samco-trade-log.json");

export type SamcoTradeLogAction = "entry" | "exit" | "eod" | "reconcile";

export interface SamcoTradeLogRecord {
  id: string;
  timestamp: string;
  dateKey: string;
  level: "info" | "warn" | "error";
  message: string;
  signalKey?: string;
  dryRun: boolean;
  action?: SamcoTradeLogAction;
}

interface SamcoTradeLogFile {
  version: 1;
  records: SamcoTradeLogRecord[];
}

let recordCounter = 0;

function logFilePath(): string {
  return LOG_PATH;
}

function createEmptyLogFile(): SamcoTradeLogFile {
  return { version: 1, records: [] };
}

function loadLogFile(): SamcoTradeLogFile {
  const filePath = logFilePath();
  if (!existsSync(filePath)) {
    return createEmptyLogFile();
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as SamcoTradeLogFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
      return createEmptyLogFile();
    }
    return parsed;
  } catch {
    return createEmptyLogFile();
  }
}

function saveLogFile(file: SamcoTradeLogFile): void {
  const filePath = logFilePath();
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(file, null, 2), "utf8");
}

function createRecordId(): string {
  recordCounter += 1;
  return `samco-log-${Date.now()}-${recordCounter}`;
}

function inferAction(message: string): SamcoTradeLogAction | undefined {
  const lower = message.toLowerCase();
  if (lower.includes("dry-run entry") || lower.includes("entry filled")) {
    return "entry";
  }
  if (lower.includes("square-off") || lower.includes("square off")) {
    return "exit";
  }
  if (lower.includes("eod")) {
    return "eod";
  }
  if (lower.includes("reconciled")) {
    return "reconcile";
  }
  return undefined;
}

export function appendSamcoTradeLogs(
  logs: TradeExecutorLog[],
  meta: { dryRun: boolean; now?: Date },
): SamcoTradeLogRecord[] {
  if (logs.length === 0) {
    return [];
  }

  const now = meta.now ?? new Date();
  const dateKey = getIstTimeParts(now).dateKey;
  const file = loadLogFile();
  const appended: SamcoTradeLogRecord[] = logs.map((log) => ({
    id: createRecordId(),
    timestamp: now.toISOString(),
    dateKey,
    level: log.level,
    message: log.message,
    signalKey: log.signalKey,
    dryRun: meta.dryRun,
    action: inferAction(log.message),
  }));

  file.records.push(...appended);
  saveLogFile(file);
  return appended;
}

export function getSamcoTradeLogs(dateKey?: string): SamcoTradeLogRecord[] {
  const targetDate = dateKey ?? getIstTimeParts(new Date()).dateKey;
  return loadLogFile().records.filter((record) => record.dateKey === targetDate);
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportSamcoTradeLogsCsv(dateKey?: string): string {
  const records = getSamcoTradeLogs(dateKey);
  const header = "timestamp,dateKey,level,message,signalKey,dryRun,action";
  const rows = records.map((record) =>
    [
      record.timestamp,
      record.dateKey,
      record.level,
      record.message,
      record.signalKey ?? "",
      String(record.dryRun),
      record.action ?? "",
    ]
      .map((value) => escapeCsv(value))
      .join(","),
  );
  return [header, ...rows].join("\n");
}

export function exportSamcoTradeLogsJson(dateKey?: string): string {
  return JSON.stringify(getSamcoTradeLogs(dateKey), null, 2);
}

export function resetSamcoTradeLogs(): void {
  saveLogFile(createEmptyLogFile());
}
