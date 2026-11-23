import { useLiveOrderBook } from "../hooks/useLiveOrderBook";
import { useOrderBookRecorder } from "../hooks/useOrderBookRecorder";
import {
  ORDER_BOOK_RECORD_INTERVALS,
  type OrderBookRecordInterval,
  type OrderBookSideRow,
  type OrderBookSnapshot,
} from "../types/orderBook";

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
    <div className="overflow-x-auto">
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

const controlClassName =
  "cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2.5 py-1 text-xs text-kite-text hover:bg-kite-surface disabled:cursor-not-allowed disabled:opacity-50";

export function OrderBookCard({ symbol, enabled = true }: OrderBookCardProps) {
  const { data, loading, error } = useLiveOrderBook(symbol, enabled);
  const recorder = useOrderBookRecorder(symbol);

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
            <span>5-level Kite depth · 5s refresh</span>
          </div>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-kite-muted">
          Record interval
          <select
            className={controlClassName}
            value={recorder.interval}
            disabled={recorder.recording}
            onChange={(event) =>
              recorder.setRecordInterval(event.target.value as OrderBookRecordInterval)
            }
          >
            {ORDER_BOOK_RECORD_INTERVALS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={controlClassName}
          disabled={!symbol || recorder.recording}
          onClick={recorder.start}
        >
          Start recording
        </button>
        <button
          type="button"
          className={controlClassName}
          disabled={!recorder.recording}
          onClick={recorder.stop}
        >
          Stop recording
        </button>
        <button
          type="button"
          className={controlClassName}
          disabled={recorder.samples.length === 0}
          onClick={recorder.download}
        >
          Download XLS
        </button>
        <span className="text-[10px] text-kite-muted">
          {recorder.recording ? "Recording" : "Stopped"}
          {` · ${recorder.samples.length} snapshot${recorder.samples.length === 1 ? "" : "s"}`}
        </span>
      </div>
      {recorder.error ? (
        <p className="mb-2 text-xs text-kite-red">{recorder.error}</p>
      ) : null}

      {!symbol ? (
        <p className="m-0 text-xs text-kite-muted">Load a symbol to fetch live bid / offer.</p>
      ) : loading && !data ? (
        <p className="m-0 text-xs text-kite-muted">Fetching live bid / offer from Kite…</p>
      ) : error && !data ? (
        <p className="m-0 text-xs text-kite-red">{error}</p>
      ) : data && data.rows.length === 0 ? (
        <p className="m-0 text-xs text-kite-muted">
          Kite returned no 5-level depth for {data.symbol}.
        </p>
      ) : data ? (
        <>
          {error ? (
            <p className="mb-2 text-xs text-kite-red">{error}</p>
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
