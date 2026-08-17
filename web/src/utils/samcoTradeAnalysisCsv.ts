import { formatDayScanStrategy, formatExitType } from "./backtestFormat";
import type { SamcoTradeAnalysisRow } from "./samcoTradeAnalysis";

const CSV_HEADERS = [
  "Stock",
  "Trading symbol",
  "Qty",
  "Strategy",
  "Status",
  "Entry timing",
  "Entry signal",
  "Entry trade type",
  "Entry price",
  "Exit timing",
  "Exit signal",
  "Exit trade type",
  "Exit price",
  "Exit type",
  "Gross P&L",
  "Taxes / charges",
  "Brokerage",
  "STT",
  "Exchange",
  "SEBI",
  "Stamp",
  "GST",
  "Net P&L",
  "Signal key",
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatNumberCell(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(2);
}

function formatExitTypeCell(row: SamcoTradeAnalysisRow): string {
  if (row.status !== "closed" || !row.exitReason) {
    return "";
  }
  const label = formatExitType({
    exitReason: row.exitReason as Parameters<typeof formatExitType>[0]["exitReason"],
    exitTimeIst: row.exit.timing,
  });
  return label === "—" ? "" : label;
}

function formatStrategy(strategy: string): string {
  try {
    return formatDayScanStrategy(
      strategy as Parameters<typeof formatDayScanStrategy>[0],
    );
  } catch {
    return strategy;
  }
}

function rowToCsvCells(row: SamcoTradeAnalysisRow): string[] {
  const breakdown = row.chargesBreakdown;
  return [
    row.stockName,
    row.tradingSymbol,
    String(row.quantity),
    formatStrategy(row.strategy),
    row.status,
    row.entry.timing ?? "",
    row.entry.signalType,
    row.entry.tradeType ?? "",
    formatNumberCell(row.entry.price),
    row.exit.timing ?? "",
    row.exit.signalType,
    row.exit.tradeType ?? "",
    formatNumberCell(row.exit.price),
    formatExitTypeCell(row),
    formatNumberCell(row.grossPnL),
    formatNumberCell(row.charges),
    formatNumberCell(breakdown?.brokerage),
    formatNumberCell(breakdown?.stt),
    formatNumberCell(breakdown?.exchangeTxnCharges),
    formatNumberCell(breakdown?.sebiCharges),
    formatNumberCell(breakdown?.stampDuty),
    formatNumberCell(breakdown?.gst),
    formatNumberCell(row.netPnL),
    row.signalKey,
  ];
}

/** CSV matching Trade Analysis table columns (plus charge breakdown). */
export function buildSamcoTradeAnalysisCsv(
  rows: SamcoTradeAnalysisRow[],
): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(rowToCsvCells(row).map(escapeCsvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function buildSamcoTradeAnalysisCsvFilename(dateKey?: string): string {
  const datePart = dateKey?.trim() || "latest";
  return `samco-trade-analysis-${datePart}.csv`;
}

export function downloadSamcoTradeAnalysisCsv(
  rows: SamcoTradeAnalysisRow[],
  filename?: string,
): void {
  const csv = buildSamcoTradeAnalysisCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? buildSamcoTradeAnalysisCsvFilename();
  anchor.click();
  URL.revokeObjectURL(url);
}
