import type {
  OrderBookRecordInterval,
  OrderBookRecordingSample,
  OrderBookSideRow,
  OrderBookSnapshot,
} from "../types/orderBook";
import { IST_TIMEZONE, todayIstDateKey } from "./istTime";
import { maxQuantityBid, maxQuantityOffer } from "./orderBookGraph";

export const ORDER_BOOK_RECORD_DEPTH_LEVELS = 5;

/** How long a recording run lasts before it auto-stops. */
export const ORDER_BOOK_RECORD_DURATION_MS: Record<OrderBookRecordInterval, number> =
  {
    "1m": 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
  };

/** Poll while recording so each observed bid/offer/total/LTP change becomes a row. */
export const ORDER_BOOK_RECORD_POLL_MS = 1_000;

export const ORDER_BOOK_RECORD_INTERVAL_MS = ORDER_BOOK_RECORD_DURATION_MS;

function sideFingerprint(row: OrderBookSideRow): string {
  return `${row.price}:${row.orders}:${row.quantity}`;
}

/** Stable key for “did the visible book or stock price change?” */
export function orderBookChangeFingerprint(snapshot: OrderBookSnapshot): string {
  return [
    snapshot.lastPrice,
    snapshot.bidOrders,
    snapshot.buyQuantity,
    snapshot.offerOrders,
    snapshot.sellQuantity,
    snapshot.bids.map(sideFingerprint).join("|"),
    snapshot.offers.map(sideFingerprint).join("|"),
  ].join(";");
}

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
    "Stock price",
    "Symbol",
    "Time range",
  ];
  for (let level = 1; level <= ORDER_BOOK_RECORD_DEPTH_LEVELS; level++) {
    headers.push(`BID ${level}`, `BID ${level} Orders`, `BID ${level} Qty`);
  }
  for (let level = 1; level <= ORDER_BOOK_RECORD_DEPTH_LEVELS; level++) {
    headers.push(
      `OFFER ${level}`,
      `OFFER ${level} Orders`,
      `OFFER ${level} Qty`,
    );
  }
  headers.push(
    "Total Bid Orders",
    "Total Bid Qty",
    "Total Offer Orders",
    "Total Offer Qty",
    "Max BID",
    "Max BID Qty",
    "Max OFFER",
    "Max OFFER Qty",
  );
  return headers;
}

function sampleCells(sample: OrderBookRecordingSample): string[] {
  const { snapshot } = sample;
  const cells = [
    xmlStringCell(sample.recordedAtIst),
    xmlNumberCell(snapshot.lastPrice),
    xmlStringCell(snapshot.symbol),
    xmlStringCell(sample.interval),
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
  const maxBid = maxQuantityBid(snapshot);
  const maxOffer = maxQuantityOffer(snapshot);
  cells.push(
    xmlNumberCell(snapshot.bidOrders),
    xmlNumberCell(snapshot.buyQuantity),
    xmlNumberCell(snapshot.offerOrders),
    xmlNumberCell(snapshot.sellQuantity),
    xmlNumberCell(maxBid?.price ?? null),
    xmlNumberCell(maxBid?.quantity ?? null),
    xmlNumberCell(maxOffer?.price ?? null),
    xmlNumberCell(maxOffer?.quantity ?? null),
  );
  return cells;
}

function kiteViewDepthRows(snapshot: OrderBookSnapshot): string[] {
  const rows: string[] = [];
  for (let index = 0; index < ORDER_BOOK_RECORD_DEPTH_LEVELS; index++) {
    const bid = levelOrNull(snapshot.bids, index);
    const offer = levelOrNull(snapshot.offers, index);
    rows.push(
      xmlRow([
        xmlNumberCell(bid?.price ?? null),
        xmlNumberCell(bid?.orders ?? null),
        xmlNumberCell(bid?.quantity ?? null),
        xmlNumberCell(offer?.price ?? null),
        xmlNumberCell(offer?.orders ?? null),
        xmlNumberCell(offer?.quantity ?? null),
      ]),
    );
  }
  rows.push(
    xmlRow([
      xmlStringCell("Total"),
      xmlNumberCell(snapshot.bidOrders),
      xmlNumberCell(snapshot.buyQuantity),
      xmlStringCell("Total"),
      xmlNumberCell(snapshot.offerOrders),
      xmlNumberCell(snapshot.sellQuantity),
    ]),
  );
  return rows;
}

function graphHeaders(): string[] {
  return [
    "Recorded at IST",
    "Stock price",
    "Max BID",
    "Max BID Qty",
    "Max OFFER",
    "Max OFFER Qty",
  ];
}

function graphSampleCells(sample: OrderBookRecordingSample): string[] {
  const { snapshot } = sample;
  const maxBid = maxQuantityBid(snapshot);
  const maxOffer = maxQuantityOffer(snapshot);
  return [
    xmlStringCell(sample.recordedAtIst),
    xmlNumberCell(snapshot.lastPrice),
    xmlNumberCell(maxBid?.price ?? null),
    xmlNumberCell(maxBid?.quantity ?? null),
    xmlNumberCell(maxOffer?.price ?? null),
    xmlNumberCell(maxOffer?.quantity ?? null),
  ];
}

function kiteViewSampleRows(sample: OrderBookRecordingSample): string[] {
  const { snapshot } = sample;
  return [
    xmlRow([
      xmlStringCell("Recorded at IST"),
      xmlStringCell(sample.recordedAtIst),
      xmlStringCell("Stock price"),
      xmlNumberCell(snapshot.lastPrice),
      xmlStringCell("Symbol"),
      xmlStringCell(snapshot.symbol),
    ]),
    xmlRow(
      ["BID", "ORDERS", "QTY", "OFFER", "ORDERS", "QTY"].map(xmlStringCell),
    ),
    ...kiteViewDepthRows(snapshot),
    xmlRow([xmlStringCell("")]),
  ];
}

function worksheet(name: string, rows: string[]): string {
  return ` <Worksheet ss:Name="${escapeXml(name)}">
  <Table>
${rows.map((row) => `   ${row}`).join("\n")}
  </Table>
 </Worksheet>`;
}

/** Excel SpreadsheetML workbook (.xls) of recorded 5-level bid/offer snapshots. */
export function buildOrderBookRecordingWorkbookXml(
  samples: OrderBookRecordingSample[],
): string {
  const changeRows = [
    xmlRow(recordingHeaders().map(xmlStringCell)),
    ...samples.map((sample) => xmlRow(sampleCells(sample))),
  ];
  const kiteViewRows = samples.flatMap(kiteViewSampleRows);
  const graphRows = [
    xmlRow(graphHeaders().map(xmlStringCell)),
    ...samples.map((sample) => xmlRow(graphSampleCells(sample))),
  ];
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${worksheet("Changes", changeRows)}
${worksheet("Kite view", kiteViewRows)}
${worksheet("Graph", graphRows)}
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
