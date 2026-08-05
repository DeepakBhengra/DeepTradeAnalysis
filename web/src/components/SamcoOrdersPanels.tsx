import type { SamcoOrderView } from "../api/samco";

interface SamcoOrdersPanelsProps {
  open: SamcoOrderView[];
  executed: SamcoOrderView[];
  rejected: SamcoOrderView[];
  signalSource?: {
    date: string | null;
    variant: string | null;
    tradeCount: number;
    runAt: string | null;
  } | null;
}

function formatPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

function OrdersTable({
  title,
  emptyLabel,
  rows,
}: {
  title: string;
  emptyLabel: string;
  rows: SamcoOrderView[];
}) {
  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
        {title}{" "}
        <span className="font-normal normal-case text-kite-text">({rows.length})</span>
      </h3>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-xs">
          <thead>
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
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-3 text-kite-muted">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-kite-border/60">
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
                </tr>
              ))
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
  signalSource,
}: SamcoOrdersPanelsProps) {
  return (
    <div className="flex flex-col gap-3">
      {signalSource && (
        <p className="m-0 text-[10px] text-kite-muted">
          Day Scan signal feed:{" "}
          {signalSource.date
            ? `${signalSource.variant ?? "—"} · ${signalSource.date} · ${signalSource.tradeCount} trade(s)`
            : "none yet — run Day Scan (supported variant) to push BUY/SELL/exit signals here"}
        </p>
      )}
      <OrdersTable
        title="Open orders"
        emptyLabel="No open orders."
        rows={open}
      />
      <OrdersTable
        title="Executed orders"
        emptyLabel="No executed orders yet."
        rows={executed}
      />
      <OrdersTable
        title="Rejected orders"
        emptyLabel="No rejected orders."
        rows={rejected}
      />
    </div>
  );
}
