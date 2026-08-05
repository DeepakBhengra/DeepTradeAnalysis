import type { DayOrderFill } from "../types/dayOrder";
import { formatDayScanStrategy } from "./backtestFormat";

const CSV_HEADERS = [
  "Type",
  "Side",
  "Qty",
  "Stock",
  "Price",
  "Strategy",
  "Time (IST)",
  "P&L",
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatPnLCell(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(2);
}

function fillToRow(fill: DayOrderFill): string[] {
  return [
    fill.kind,
    fill.side,
    String(fill.quantity),
    fill.tradingSymbol,
    fill.price.toFixed(2),
    formatDayScanStrategy(fill.strategy),
    fill.timeIst,
    formatPnLCell(fill.realizedPnL),
  ];
}

/** Chronological CSV (oldest fill first) matching Order history columns. */
export function buildDayOrderHistoryCsv(fills: DayOrderFill[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const fill of fills) {
    lines.push(fillToRow(fill).map(escapeCsvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function buildDayOrderHistoryCsvFilename(date: string): string {
  return `day-order-history-${date}.csv`;
}

export function downloadDayOrderHistoryCsv(options: {
  fills: DayOrderFill[];
  date: string;
}): void {
  const csv = buildDayOrderHistoryCsv(options.fills);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildDayOrderHistoryCsvFilename(options.date);
  anchor.click();
  URL.revokeObjectURL(url);
}
