import type {
  OrderBookRecordInterval,
  OrderBookRecordingSample,
  OrderBookSideRow,
  OrderBookSnapshot,
} from "../types/orderBook";
import { IST_TIMEZONE, todayIstDateKey } from "./istTime";

export const ORDER_BOOK_RECORD_DEPTH_LEVELS = 5;

export const ORDER_BOOK_RECORD_INTERVAL_MS: Record<OrderBookRecordInterval, number> =
  {
    "1m": 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
  };

export function formatOrderBookRecordedAtIst(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function buildOrderBookRecordingSample(
  snapshot: OrderBookSnapshot,
  interval: OrderBookRecordInterval,
  recordedAt: Date = new Date(),
): OrderBookRecordingSample {
  return {
    recordedAtIso: recordedAt.toISOString(),
    recordedAtIst: formatOrderBookRecordedAtIst(recordedAt),
    interval,
    snapshot,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlStringCell(value: string): string {
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function xmlNumberCell(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return `<Cell><Data ss:Type="String"></Data></Cell>`;
  }
  return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
}

function xmlRow(cells: string[]): string {
  return `<Row>${cells.join("")}</Row>`;
}

function levelOrNull(
  rows: OrderBookSideRow[],
  index: number,
): OrderBookSideRow | null {
  return rows[index] ?? null;
}

function recordingHeaders(): string[] {
  const headers = [
    "Recorded at IST",
    "Interval",
    "Symbol",
    "LTP",
  ];
  for (let level = 1; level <= ORDER_BOOK_RECORD_DEPTH_LEVELS; level++) {
    headers.push(`Bid${level} Price`, `Bid${level} Orders`, `Bid${level} Qty`);
  }
  for (let level = 1; level <= ORDER_BOOK_RECORD_DEPTH_LEVELS; level++) {
    headers.push(
      `Offer${level} Price`,
      `Offer${level} Orders`,
      `Offer${level} Qty`,
    );
  }
  headers.push(
    "Total Bid Orders",
    "Total Bid Qty",
    "Total Offer Orders",
    "Total Offer Qty",
  );
  return headers;
}

function sampleCells(sample: OrderBookRecordingSample): string[] {
  const { snapshot } = sample;
  const cells = [
    xmlStringCell(sample.recordedAtIst),
    xmlStringCell(sample.interval),
    xmlStringCell(snapshot.symbol),
    xmlNumberCell(snapshot.lastPrice),
  ];
  for (let index = 0; index < ORDER_BOOK_RECORD_DEPTH_LEVELS; index++) {
    const bid = levelOrNull(snapshot.bids, index);
    cells.push(
      xmlNumberCell(bid?.price ?? null),
      xmlNumberCell(bid?.orders ?? null),
      xmlNumberCell(bid?.quantity ?? null),
    );
  }
  for (let index = 0; index < ORDER_BOOK_RECORD_DEPTH_LEVELS; index++) {
    const offer = levelOrNull(snapshot.offers, index);
    cells.push(
      xmlNumberCell(offer?.price ?? null),
      xmlNumberCell(offer?.orders ?? null),
      xmlNumberCell(offer?.quantity ?? null),
    );
  }
  cells.push(
    xmlNumberCell(snapshot.bidOrders),
    xmlNumberCell(snapshot.buyQuantity),
    xmlNumberCell(snapshot.offerOrders),
    xmlNumberCell(snapshot.sellQuantity),
  );
  return cells;
}

/** Excel SpreadsheetML workbook (.xls) of recorded 5-level bid/offer snapshots. */
export function buildOrderBookRecordingWorkbookXml(
  samples: OrderBookRecordingSample[],
): string {
  const headerRow = xmlRow(recordingHeaders().map(xmlStringCell));
  const dataRows = samples.map((sample) => xmlRow(sampleCells(sample)));
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Order book">
  <Table>
   ${headerRow}
${dataRows.map((row) => `   ${row}`).join("\n")}
  </Table>
 </Worksheet>
</Workbook>
`;
}

function sanitizeFilenamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^\.+|\.+$/g, "") || "na"
  );
}

export function buildOrderBookRecordingFilename(
  samples: OrderBookRecordingSample[],
  now: Date = new Date(),
): string {
  const symbol = sanitizeFilenamePart(
    samples[0]?.snapshot.symbol.replace(":", "-") ?? "order-book",
  );
  const interval = samples[0]?.interval ?? "1m";
  return `order-book_${symbol}_${interval}_${todayIstDateKey(now)}.xls`;
}

export function downloadOrderBookRecordingXls(
  samples: OrderBookRecordingSample[],
): void {
  if (samples.length === 0) {
    return;
  }
  const xml = buildOrderBookRecordingWorkbookXml(samples);
  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildOrderBookRecordingFilename(samples);
  anchor.click();
  URL.revokeObjectURL(url);
}
