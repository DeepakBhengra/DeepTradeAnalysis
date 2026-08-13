import type { DayOrderFill, DayOrderRunSettings } from "../types/dayOrder";
import { formatDayScanStrategy, formatExitType } from "./backtestFormat";

const ORDER_HEADERS = [
  "Type",
  "Side",
  "Qty",
  "Stock",
  "Price",
  "Strategy",
  "Exit Type",
  "Time (IST)",
  "P&L",
] as const;

export interface DayOrderExportSettings {
  date: string;
  ruleVariant: string;
  ruleVariantLabel: string;
  quantity: number;
  minEntryPrice: number;
  maxEntryPrice: number;
  stopLossPct: number | null;
}

export function buildDayOrderExportSettings(
  date: string,
  ruleVariant: string,
  ruleVariantLabel: string,
  runSettings: DayOrderRunSettings,
): DayOrderExportSettings {
  return {
    date,
    ruleVariant,
    ruleVariantLabel,
    quantity: runSettings.quantity,
    minEntryPrice: runSettings.minEntryPrice,
    maxEntryPrice: runSettings.maxEntryPrice,
    stopLossPct: runSettings.stopLossPct,
  };
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPnLCell(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(2);
}

function formatStopLossPct(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return "off";
  }
  return String(value);
}

function formatExitTypeCell(fill: DayOrderFill): string {
  if (fill.kind !== "exit") {
    return "";
  }
  const label = formatExitType({
    exitReason: fill.exitReason ?? null,
    targetHit: fill.targetHit,
    stopLossHit: fill.stopLossHit,
    exitTimeIst: fill.timeIst,
  });
  return label === "—" ? "" : label;
}

function fillToRow(fill: DayOrderFill): string[] {
  return [
    fill.kind,
    fill.side,
    String(fill.quantity),
    fill.tradingSymbol,
    fill.price.toFixed(2),
    formatDayScanStrategy(fill.strategy),
    formatExitTypeCell(fill),
    fill.timeIst,
    formatPnLCell(fill.realizedPnL),
  ];
}

function settingsRows(settings: DayOrderExportSettings): Array<[string, string]> {
  return [
    ["Date", settings.date],
    ["Rule variant", settings.ruleVariantLabel || settings.ruleVariant],
    ["Rule variant key", settings.ruleVariant],
    ["Quantity", String(settings.quantity)],
    ["Min entry price", String(settings.minEntryPrice)],
    ["Max entry price", String(settings.maxEntryPrice)],
    ["Stop-loss %", formatStopLossPct(settings.stopLossPct)],
  ];
}

/** Chronological CSV (oldest fill first) matching Order history columns. */
export function buildDayOrderHistoryCsv(fills: DayOrderFill[]): string {
  const lines = [ORDER_HEADERS.join(",")];
  for (const fill of fills) {
    lines.push(fillToRow(fill).map(escapeCsvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Settings as a two-column CSV sheet. */
export function buildDayOrderSettingsCsv(settings: DayOrderExportSettings): string {
  const lines = ["Setting,Value"];
  for (const [label, value] of settingsRows(settings)) {
    lines.push([label, value].map(escapeCsvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function xmlStringCell(value: string): string {
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function xmlNumberCell(value: number): string {
  return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
}

function xmlRow(cells: string[]): string {
  return `<Row>${cells.join("")}</Row>`;
}

/**
 * Excel SpreadsheetML workbook with two sheets: Settings and Order History.
 * Opens in Excel / Sheets as a multi-sheet workbook (.xls).
 */
export function buildDayOrderHistoryWorkbookXml(
  fills: DayOrderFill[],
  settings: DayOrderExportSettings,
): string {
  const settingsTableRows = [
    xmlRow([xmlStringCell("Setting"), xmlStringCell("Value")]),
    ...settingsRows(settings).map(([label, value]) =>
      xmlRow([xmlStringCell(label), xmlStringCell(value)]),
    ),
  ];

  const orderHeaderRow = xmlRow(ORDER_HEADERS.map((header) => xmlStringCell(header)));
  const orderDataRows = fills.map((fill) => {
    const [
      kind,
      side,
      qty,
      stock,
      price,
      strategy,
      exitType,
      timeIst,
      pnl,
    ] = fillToRow(fill);
    return xmlRow([
      xmlStringCell(kind),
      xmlStringCell(side),
      xmlNumberCell(Number(qty)),
      xmlStringCell(stock),
      xmlNumberCell(Number(price)),
      xmlStringCell(strategy),
      xmlStringCell(exitType),
      xmlStringCell(timeIst),
      pnl === "" ? xmlStringCell("") : xmlNumberCell(Number(pnl)),
    ]);
  });

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Settings">
  <Table>
${settingsTableRows.map((row) => `   ${row}`).join("\n")}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Order History">
  <Table>
   ${orderHeaderRow}
${orderDataRows.map((row) => `   ${row}`).join("\n")}
  </Table>
 </Worksheet>
</Workbook>
`;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    || "na";
}

/** Filename includes date, rule, qty, price range, and SL%. */
export function buildDayOrderHistoryExportFilename(
  settings: DayOrderExportSettings,
): string {
  const rule = sanitizeFilenamePart(settings.ruleVariantLabel || settings.ruleVariant);
  const qty = `qty${settings.quantity}`;
  const range = `range${settings.minEntryPrice}-${settings.maxEntryPrice}`;
  const sl =
    settings.stopLossPct == null || settings.stopLossPct <= 0
      ? "sl-off"
      : `sl${sanitizeFilenamePart(String(settings.stopLossPct))}`;
  return `day-order_${sanitizeFilenamePart(settings.date)}_${rule}_${qty}_${range}_${sl}.xls`;
}

/** @deprecated Prefer buildDayOrderHistoryExportFilename with full settings. */
export function buildDayOrderHistoryCsvFilename(date: string): string {
  return `day-order-history-${date}.csv`;
}

export function downloadDayOrderHistoryWorkbook(options: {
  fills: DayOrderFill[];
  settings: DayOrderExportSettings;
}): void {
  const xml = buildDayOrderHistoryWorkbookXml(options.fills, options.settings);
  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildDayOrderHistoryExportFilename(options.settings);
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Kept for callers/tests that only need the order rows as CSV. */
export function downloadDayOrderHistoryCsv(options: {
  fills: DayOrderFill[];
  date: string;
  settings?: DayOrderExportSettings;
}): void {
  if (options.settings) {
    downloadDayOrderHistoryWorkbook({
      fills: options.fills,
      settings: options.settings,
    });
    return;
  }
  const csv = buildDayOrderHistoryCsv(options.fills);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildDayOrderHistoryCsvFilename(options.date);
  anchor.click();
  URL.revokeObjectURL(url);
}
