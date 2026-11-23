import { useLiveOrderBook } from "../hooks/useLiveOrderBook";
import type { OrderBookSideRow, OrderBookSnapshot } from "../types/orderBook";

interface OrderBookCardProps {
  symbol: string | null;
  enabled?: boolean;
}

function formatIndianQty(value: number): string {
  return value.toLocaleString("en-IN");
}

function SideCells({
  row,
  qtyClass,
}: {
  row: OrderBookSideRow | null;
  qtyClass: string;
}) {
  if (!row) {
    return (
      <>
        <td className="px-2 py-0.5 text-kite-muted">—</td>
        <td className="px-2 py-0.5 text-right text-kite-muted">—</td>
        <td className="px-2 py-0.5 text-right text-kite-muted">—</td>
      </>
    );
  }

  return (
    <>
      <td className="px-2 py-0.5 font-medium text-kite-text">{row.price.toFixed(2)}</td>
      <td className="px-2 py-0.5 text-right text-kite-muted">{row.orders}</td>
      <td className={`px-2 py-0.5 text-right font-medium ${qtyClass}`}>
        {formatIndianQty(row.quantity)}
      </td>
    </>
  );
}

export function OrderBookTable({ snapshot }: { snapshot: OrderBookSnapshot }) {
  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full min-w-[28rem] border-collapse text-xs tabular-nums">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-kite-muted">
            <th className="px-2 py-1 text-left font-medium text-kite-green">Bid</th>
            <th className="px-2 py-1 text-right font-medium">Orders</th>
            <th className="px-2 py-1 text-right font-medium">Qty</th>
            <th className="px-2 py-1 text-left font-medium text-kite-red">Offer</th>
            <th className="px-2 py-1 text-right font-medium">Orders</th>
            <th className="px-2 py-1 text-right font-medium">Qty</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.rows.map((row, index) => (
            <tr key={`depth-${index}`} className="border-t border-kite-border/60">
              <SideCells row={row.bid} qtyClass="text-kite-green" />
              <SideCells row={row.offer} qtyClass="text-kite-red" />
            </tr>
          ))}
          <tr className="border-t border-kite-border text-xs font-medium">
            <td className="px-2 py-1 text-kite-muted">Total</td>
            <td className="px-2 py-1 text-right text-kite-muted">
              {formatIndianQty(snapshot.bidOrders)}
            </td>
            <td className="px-2 py-1 text-right text-kite-green">
              {formatIndianQty(snapshot.buyQuantity)}
            </td>
            <td className="px-2 py-1 text-kite-muted">Total</td>
            <td className="px-2 py-1 text-right text-kite-muted">
              {formatIndianQty(snapshot.offerOrders)}
            </td>
            <td className="px-2 py-1 text-right text-kite-red">
              {formatIndianQty(snapshot.sellQuantity)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function OrderBookCard({ symbol, enabled = true }: OrderBookCardProps) {
  const { data, loading, error } = useLiveOrderBook(symbol, enabled);

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-xs font-medium uppercase tracking-wide text-kite-muted">
          Live order book
        </h2>
        {data ? (
          <div className="flex flex-wrap gap-3 text-[10px] tabular-nums text-kite-muted">
            <span>{data.symbol}</span>
            <span>
              LTP{" "}
              <span className="font-medium text-kite-text">
                {data.lastPrice.toFixed(2)}
              </span>
            </span>
            <span>
              {data.liveLevelCount}/{data.requestedLevels} live levels · 5s refresh
            </span>
          </div>
        ) : null}
      </div>

      {!symbol ? (
        <p className="m-0 text-xs text-kite-muted">Load a symbol to fetch live bid / offer.</p>
      ) : loading && !data ? (
        <p className="m-0 text-xs text-kite-muted">Fetching live bid / offer from Kite…</p>
      ) : error && !data ? (
        <p className="m-0 text-xs text-kite-red">{error}</p>
      ) : data && data.liveLevelCount === 0 ? (
        <p className="m-0 text-xs text-kite-muted">
          Kite returned no market depth for {data.symbol}.
        </p>
      ) : data ? (
        <>
          {error ? (
            <p className="mb-2 text-xs text-kite-red">{error}</p>
          ) : null}
          {data.liveLevelCount < data.requestedLevels ? (
            <p className="mb-2 text-[10px] text-kite-muted">
              Showing {data.liveLevelCount} of {data.requestedLevels} levels. Kite Connect
              getQuote supplies 5-level depth; 20-level (Level 3) is only on Kite web/app.
            </p>
          ) : null}
          <OrderBookTable snapshot={data} />
        </>
      ) : (
        <p className="m-0 text-xs text-kite-muted">
          Live bid / offer is available when Kite is connected.
        </p>
      )}
    </section>
  );
}
