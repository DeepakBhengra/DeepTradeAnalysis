import type { SamcoOrderView } from "../api/samco";
import { downloadSamcoExecutedOrdersCsv } from "../utils/samcoExecutedOrdersCsv";
import { todayIstDateKey } from "../utils/istTime";

interface SamcoOrdersPanelsProps {
  open: SamcoOrderView[];
  executed: SamcoOrderView[];
  rejected: SamcoOrderView[];
  updatedAt?: string | null;
  signalSource?: {
    date: string | null;
    variant: string | null;
    tradeCount: number;
    runAt: string | null;
    isToday?: boolean;
  } | null;
  onExitPosition?: (signalKey: string) => void;
  exitingSignalKey?: string | null;
}

function formatPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

function formatUpdatedAt(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function OrdersTable({
  title,
  emptyLabel,
  rows,
  scrollable,
  onDownloadCsv,
  onExitPosition,
  exitingSignalKey,
}: {
  title: string;
  emptyLabel: string;
  rows: SamcoOrderView[];
  scrollable?: boolean;
  onDownloadCsv?: () => void;
  onExitPosition?: (signalKey: string) => void;
  exitingSignalKey?: string | null;
}) {
  const showExit = typeof onExitPosition === "function";
  const colSpan = showExit ? 10 : 9;

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          {title}{" "}
          <span className="font-normal normal-case text-kite-text">({rows.length})</span>
        </h3>
        {onDownloadCsv && rows.length > 0 && (
          <button
            type="button"
            onClick={onDownloadCsv}
            className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-[10px] font-medium text-kite-text hover:bg-kite-surface"
          >
            Download CSV
          </button>
        )}
      </div>

      <div
        className={`mt-3 overflow-x-auto ${scrollable ? "max-h-96 overflow-y-auto" : ""}`}
      >
        <table className="w-full min-w-[780px] border-collapse text-left text-xs">
          <thead className={scrollable ? "sticky top-0 bg-kite-surface" : undefined}>
            <tr className="border-b border-kite-border text-kite-muted">
              <th className="py-2 pr-3 font-medium">Stock</th>
              <th className="py-2 pr-3 font-medium">Timing</th>
              <th className="py-2 pr-3 font-medium">Buy/Sell</th>
              <th className="py-2 pr-3 font-medium">Kind</th>
              <th className="py-2 pr-3 font-medium">Limit price</th>
              <th className="py-2 pr-3 font-medium">Qty</th>
              <th className="py-2 pr-3 font-medium">Strategy</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Detail</th>
              {showExit && <th className="py-2 font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-3 text-kite-muted">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const canExit =
                  showExit &&
                  row.kind === "entry" &&
                  (row.status === "open" || row.status === "closing");
                const isExiting = exitingSignalKey === row.signalKey;
                return (
                  <tr
                    key={`${row.id}:${row.orderNumber ?? "none"}:${index}`}
                    className="border-b border-kite-border/60"
                  >
                    <td className="py-2 pr-3 text-kite-text">
                      <div className="font-medium">{row.stockName}</div>
                      <div className="text-[10px] text-kite-muted">{row.tradingSymbol}</div>
                    </td>
                    <td className="py-2 pr-3 text-kite-text">{row.timing}</td>
                    <td
                      className={`py-2 pr-3 font-medium ${
                        row.side === "BUY" ? "text-kite-green" : "text-kite-red"
                      }`}
                    >
                      {row.side}
                    </td>
                    <td className="py-2 pr-3 text-kite-text">{row.kind}</td>
                    <td className="py-2 pr-3 tabular-nums text-kite-text">
                      {formatPrice(row.limitPrice)}
                    </td>
                    <td className="py-2 pr-3 text-kite-text">{row.quantity}</td>
                    <td className="py-2 pr-3 text-kite-text">{row.strategy}</td>
                    <td className="py-2 pr-3 text-kite-text">{row.status}</td>
                    <td className="py-2 pr-3 text-kite-muted">
                      {row.reason ?? row.orderNumber ?? "—"}
                    </td>
                    {showExit && (
                      <td className="py-2">
                        {canExit ? (
                          <button
                            type="button"
                            disabled={isExiting || Boolean(exitingSignalKey)}
                            onClick={() => onExitPosition?.(row.signalKey)}
                            className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-[10px] font-medium text-kite-text disabled:cursor-not-allowed disabled:opacity-50"
                            title="Exit position at mark (or entry if mark unavailable)"
                          >
                            {isExiting ? "Exiting…" : "Exit"}
                          </button>
                        ) : (
                          <span className="text-kite-muted">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SamcoOrdersPanels({
  open,
  executed,
  rejected,
  updatedAt,
  signalSource,
  onExitPosition,
  exitingSignalKey = null,
}: SamcoOrdersPanelsProps) {
  const updatedLabel = formatUpdatedAt(updatedAt);
  const feedDate = signalSource?.date ?? todayIstDateKey();

  const handleDownloadExecutedCsv = () => {
    downloadSamcoExecutedOrdersCsv(
      executed,
      `samco-executed-orders-${feedDate}.csv`,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {signalSource && (
        <p className="m-0 text-[10px] text-kite-muted">
          Day Scan signal feed:{" "}
          {signalSource.date
            ? `${signalSource.variant ?? "—"} · ${signalSource.date}${
                signalSource.isToday === false ? " (historical)" : ""
              } · ${signalSource.tradeCount} trade(s)`
            : "none yet — run Day Scan (supported variant) to push BUY/SELL/exit signals here"}
          {updatedLabel ? ` · ledger ${updatedLabel}` : ""}
        </p>
      )}
      <OrdersTable
        title="Open orders"
        emptyLabel="No open orders."
        rows={open}
        onExitPosition={onExitPosition}
        exitingSignalKey={exitingSignalKey}
      />
      <OrdersTable
        title="Executed orders"
        emptyLabel="No executed orders yet."
        rows={executed}
        scrollable
        onDownloadCsv={handleDownloadExecutedCsv}
      />
      <OrdersTable
        title="Rejected orders"
        emptyLabel="No rejected orders."
        rows={rejected}
      />
    </div>
  );
}
