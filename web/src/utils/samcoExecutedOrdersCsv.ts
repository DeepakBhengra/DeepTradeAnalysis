import type { SamcoOrderView } from "../api/samco";

const CSV_HEADERS = [
  "Stock",
  "Trading symbol",
  "Timing",
  "Buy/Sell",
  "Kind",
  "Limit price",
  "Qty",
  "Strategy",
  "Status",
  "Detail",
  "Order number",
  "Signal key",
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatPriceCell(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(2);
}

function orderToRow(order: SamcoOrderView): string[] {
  return [
    order.stockName,
    order.tradingSymbol,
    order.timing,
    order.side,
    order.kind,
    formatPriceCell(order.limitPrice),
    String(order.quantity),
    order.strategy,
    order.status,
    order.reason ?? "",
    order.orderNumber ?? "",
    order.signalKey,
  ];
}

/** CSV matching the Executed orders table columns (plus signal/order ids). */
export function buildSamcoExecutedOrdersCsv(orders: SamcoOrderView[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const order of orders) {
    lines.push(orderToRow(order).map(escapeCsvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadSamcoExecutedOrdersCsv(
  orders: SamcoOrderView[],
  filename = "samco-executed-orders.csv",
): void {
  const csv = buildSamcoExecutedOrdersCsv(orders);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
