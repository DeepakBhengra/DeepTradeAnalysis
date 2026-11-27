import type {
  OrderBookSnapshot,
  OrderBookTouchEvent,
  OrderBookTouchSide,
} from "../types/orderBook";
import { todayIstDateKey } from "./istTime";
import { highestQuantityBid, highestQuantityOffer } from "./orderBookGraph";
import { formatOrderBookRecordedAtIst } from "./orderBookRecording";

export const ORDER_BOOK_TOUCH_REPORT_MAX_EVENTS = 1_000;

export interface OrderBookTouchReportState {
  events: OrderBookTouchEvent[];
  lastTouchKey: string | null;
}

export const EMPTY_ORDER_BOOK_TOUCH_REPORT: OrderBookTouchReportState = {
  events: [],
  lastTouchKey: null,
};

function pricePaise(value: number): number {
  return Math.round(Number(value) * 100);
}

export function pricesTouch(left: number, right: number): boolean {
  return Number.isFinite(left) && Number.isFinite(right) && pricePaise(left) === pricePaise(right);
}

export function stockTouchesHighestQty(snapshot: OrderBookSnapshot): {
  bid: boolean;
  offer: boolean;
} {
  const highestBid = highestQuantityBid(snapshot);
  const highestOffer = highestQuantityOffer(snapshot);
  return {
    bid: highestBid != null && pricesTouch(snapshot.lastPrice, highestBid.price),
    offer: highestOffer != null && pricesTouch(snapshot.lastPrice, highestOffer.price),
  };
}

function touchSide(bid: boolean, offer: boolean): OrderBookTouchSide | null {
  if (bid && offer) {
    return "both";
  }
  if (bid) {
    return "highest_bid";
  }
  if (offer) {
    return "highest_offer";
  }
  return null;
}

export function touchEventKey(event: OrderBookTouchEvent): string {
  return [
    event.touched,
    event.stockPrice,
    event.highestBidPrice,
    event.highestOfferPrice,
  ].join("|");
}

export function buildOrderBookTouchEvent(
  snapshot: OrderBookSnapshot,
  recordedAt: Date = new Date(),
): OrderBookTouchEvent | null {
  const { bid, offer } = stockTouchesHighestQty(snapshot);
  const touched = touchSide(bid, offer);
  if (!touched) {
    return null;
  }

  const highestBid = highestQuantityBid(snapshot);
  const highestOffer = highestQuantityOffer(snapshot);
  return {
    recordedAtIso: recordedAt.toISOString(),
    recordedAtIst: formatOrderBookRecordedAtIst(recordedAt),
    symbol: snapshot.symbol,
    stockPrice: snapshot.lastPrice,
    touched,
    highestBidPrice: highestBid?.price ?? null,
    highestBidQty: highestBid?.quantity ?? null,
    highestBidLevel: highestBid?.level ?? null,
    highestOfferPrice: highestOffer?.price ?? null,
    highestOfferQty: highestOffer?.quantity ?? null,
    highestOfferLevel: highestOffer?.level ?? null,
    totalBidQty: snapshot.buyQuantity,
    totalOfferQty: snapshot.sellQuantity,
    totalBidOrders: snapshot.bidOrders,
    totalOfferOrders: snapshot.offerOrders,
  };
}

/** Append a new instance when last price first meets the fat bid/offer; skip while it stays there. */
export function reduceOrderBookTouchReport(
  state: OrderBookTouchReportState,
  snapshot: OrderBookSnapshot,
  recordedAt: Date = new Date(),
): OrderBookTouchReportState {
  const event = buildOrderBookTouchEvent(snapshot, recordedAt);
  if (!event) {
    if (state.lastTouchKey === null) {
      return state;
    }
    return { ...state, lastTouchKey: null };
  }

  const key = touchEventKey(event);
  if (state.lastTouchKey === key) {
    return state;
  }

  const events = [...state.events, event];
  return {
    events:
      events.length > ORDER_BOOK_TOUCH_REPORT_MAX_EVENTS
        ? events.slice(-ORDER_BOOK_TOUCH_REPORT_MAX_EVENTS)
        : events,
    lastTouchKey: key,
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

function touchedLabel(touched: OrderBookTouchSide): string {
  if (touched === "both") {
    return "Highest BID and OFFER";
  }
  if (touched === "highest_bid") {
    return "Highest BID";
  }
  return "Highest OFFER";
}

function reportHeaders(): string[] {
  return [
    "Time IST",
    "Touched",
    "Stock price",
    "Highest BID price",
    "Highest BID qty",
    "Highest BID level",
    "Highest OFFER price",
    "Highest OFFER qty",
    "Highest OFFER level",
    "Total BID qty",
    "Total OFFER qty",
    "Total BID orders",
    "Total OFFER orders",
    "Symbol",
  ];
}

function eventCells(event: OrderBookTouchEvent): string[] {
  return [
    xmlStringCell(event.recordedAtIst),
    xmlStringCell(touchedLabel(event.touched)),
    xmlNumberCell(event.stockPrice),
    xmlNumberCell(event.highestBidPrice),
    xmlNumberCell(event.highestBidQty),
    xmlNumberCell(event.highestBidLevel),
    xmlNumberCell(event.highestOfferPrice),
    xmlNumberCell(event.highestOfferQty),
    xmlNumberCell(event.highestOfferLevel),
    xmlNumberCell(event.totalBidQty),
    xmlNumberCell(event.totalOfferQty),
    xmlNumberCell(event.totalBidOrders),
    xmlNumberCell(event.totalOfferOrders),
    xmlStringCell(event.symbol),
  ];
}

export function buildOrderBookTouchReportWorkbookXml(
  events: OrderBookTouchEvent[],
): string {
  const rows = [
    xmlRow(reportHeaders().map(xmlStringCell)),
    ...events.map((event) => xmlRow(eventCells(event))),
  ];
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Touches">
  <Table>
${rows.map((row) => `   ${row}`).join("\n")}
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

export function buildOrderBookTouchReportFilename(
  events: OrderBookTouchEvent[],
  now: Date = new Date(),
): string {
  const symbol = sanitizeFilenamePart(
    events[0]?.symbol.replace(":", "-") ?? "order-book",
  );
  return `order-book-touches_${symbol}_${todayIstDateKey(now)}.xls`;
}

export function downloadOrderBookTouchReportXls(
  events: OrderBookTouchEvent[],
): void {
  if (events.length === 0) {
    return;
  }
  const xml = buildOrderBookTouchReportWorkbookXml(events);
  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildOrderBookTouchReportFilename(events);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function formatTouchSideLabel(touched: OrderBookTouchSide): string {
  return touchedLabel(touched);
}
