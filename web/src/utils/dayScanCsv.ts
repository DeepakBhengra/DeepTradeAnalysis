import type { DeepakDayScanTrade } from "../types/backtest";
import { formatExitType, formatScenarioLabel } from "./backtestFormat";

const CSV_HEADERS = [
  "Stock",
  "Sector",
  "Date",
  "Side",
  "Sc#",
  "Scenario",
  "Entry IST",
  "Entry",
  "Exit IST",
  "Exit",
  "Exit Type",
  "Target",
  "Profit",
  "Match",
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatNumber(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? value.toFixed(2) : "";
}

function formatExitTypeForCsv(trade: DeepakDayScanTrade): string {
  const label = formatExitType(trade);
  return label === "—" ? "" : label;
}

function tradeToRow(trade: DeepakDayScanTrade): string[] {
  return [
    trade.tradingSymbol,
    trade.sector,
    trade.date,
    trade.side,
    String(trade.scenarioNumber),
    formatScenarioLabel(trade.scenarioKey),
    trade.entryTimeIst,
    formatNumber(trade.entryPrice),
    trade.exitTimeIst ?? "",
    formatNumber(trade.exitPrice),
    formatExitTypeForCsv(trade),
    formatNumber(trade.profitTarget),
    formatNumber(trade.profit),
    trade.bbMatchType,
  ];
}

export function buildDayScanTradesCsv(trades: DeepakDayScanTrade[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const trade of trades) {
    lines.push(tradeToRow(trade).map(escapeCsvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function buildDayScanCsvFilename(filePrefix: string, date: string): string {
  return `${filePrefix}-${date}.csv`;
}

export function downloadDayScanCsv(options: {
  trades: DeepakDayScanTrade[];
  date: string;
  filePrefix: string;
}): void {
  const csv = buildDayScanTradesCsv(options.trades);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildDayScanCsvFilename(options.filePrefix, options.date);
  anchor.click();
  URL.revokeObjectURL(url);
}
