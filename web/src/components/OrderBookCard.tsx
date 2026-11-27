import { useLiveOrderBook } from "../hooks/useLiveOrderBook";
import { useOrderBookLiveTrail } from "../hooks/useOrderBookLiveTrail";
import { useOrderBookRecorder } from "../hooks/useOrderBookRecorder";
import { useOrderBookTouchReport } from "../hooks/useOrderBookTouchReport";
import {
  ORDER_BOOK_RECORD_INTERVALS,
  type OrderBookRecordInterval,
  type OrderBookSideRow,
  type OrderBookSnapshot,
  type OrderBookTouchEvent,
} from "../types/orderBook";
import { highestQuantityBid, highestQuantityOffer } from "../utils/orderBookGraph";
import { formatTouchSideLabel } from "../utils/orderBookTouchReport";
import { OrderBookRecordingChart } from "./OrderBookRecordingChart";

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
  emphasize = false,
}: {
  row: OrderBookSideRow | null;
  qtyClass: string;
  emphasize?: boolean;
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

  const weight = emphasize ? "text-sm font-bold" : "font-medium";

  return (
    <>
      <td className={`px-2 py-0.5 ${weight} text-kite-text`}>{row.price.toFixed(2)}</td>
      <td className="px-2 py-0.5 text-right text-kite-muted">{row.orders}</td>
      <td
        className={`px-2 py-0.5 text-right ${weight} ${qtyClass}`}
        data-highest-qty={emphasize ? "true" : undefined}
      >
        {formatIndianQty(row.quantity)}
      </td>
    </>
  );
}

export function OrderBookTable({ snapshot }: { snapshot: OrderBookSnapshot }) {
  const highestBid = highestQuantityBid(snapshot);
  const highestOffer = highestQuantityOffer(snapshot);

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
              <SideCells
                row={row.bid}
                qtyClass="text-kite-green"
                emphasize={highestBid?.level === index + 1}
              />
              <SideCells
                row={row.offer}
                qtyClass="text-kite-red"
                emphasize={highestOffer?.level === index + 1}
              />
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

function formatPrice(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(2);
}

export function OrderBookTouchReportTable({
  events,
}: {
  events: OrderBookTouchEvent[];
}) {
  const rows = [...events].reverse();
  return (
    <div className="mt-3 border-t border-kite-border/60 pt-3">
      <h3 className="m-0 mb-1 text-[10px] font-medium uppercase tracking-wide text-kite-muted">
        Stock price touches · highest BID / OFFER
      </h3>
      <p className="m-0 mb-2 text-[10px] text-kite-muted">
        Logged when last price meets the fattest of the 5 bids or 5 offers. Totals
        are the full book at that instant.
      </p>
      {events.length === 0 ? (
        <p className="m-0 text-xs text-kite-muted">
          No touches yet — last price has not met the highest-qty bid or offer.
        </p>
      ) : (
        <div className="max-h-48 overflow-auto">
          <table className="w-full min-w-[40rem] border-collapse text-xs tabular-nums">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-kite-muted">
                <th className="px-2 py-1 text-left font-medium">Time IST</th>
                <th className="px-2 py-1 text-left font-medium">Touched</th>
                <th className="px-2 py-1 text-right font-medium">Stock</th>
                <th className="px-2 py-1 text-right font-medium text-kite-green">
                  Highest BID
                </th>
                <th className="px-2 py-1 text-right font-medium text-kite-red">
                  Highest OFFER
                </th>
                <th className="px-2 py-1 text-right font-medium text-kite-green">
                  Total BID
                </th>
                <th className="px-2 py-1 text-right font-medium text-kite-red">
                  Total OFFER
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr
                  key={event.recordedAtIso}
                  className="border-t border-kite-border/60"
                >
                  <td className="px-2 py-0.5 text-kite-text">{event.recordedAtIst}</td>
                  <td
                    className={`px-2 py-0.5 font-medium ${
                      event.touched === "highest_offer"
                        ? "text-kite-red"
                        : "text-kite-green"
                    }`}
                  >
                    {formatTouchSideLabel(event.touched)}
                  </td>
                  <td className="px-2 py-0.5 text-right font-medium text-kite-text">
                    {formatPrice(event.stockPrice)}
                  </td>
                  <td className="px-2 py-0.5 text-right text-kite-green">
                    {formatPrice(event.highestBidPrice)} ×{" "}
                    {event.highestBidQty == null
                      ? "—"
                      : formatIndianQty(event.highestBidQty)}
                  </td>
                  <td className="px-2 py-0.5 text-right text-kite-red">
                    {formatPrice(event.highestOfferPrice)} ×{" "}
                    {event.highestOfferQty == null
                      ? "—"
                      : formatIndianQty(event.highestOfferQty)}
                  </td>
                  <td className="px-2 py-0.5 text-right text-kite-green">
                    {formatIndianQty(event.totalBidQty)}
                  </td>
                  <td className="px-2 py-0.5 text-right text-kite-red">
                    {formatIndianQty(event.totalOfferQty)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const controlClassName =
  "cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2.5 py-1 text-xs text-kite-text hover:bg-kite-surface disabled:cursor-not-allowed disabled:opacity-50";

export function OrderBookCard({ symbol, enabled = true }: OrderBookCardProps) {
  const { data, loading, error } = useLiveOrderBook(symbol, enabled);
  const recorder = useOrderBookRecorder(symbol, data);
  const liveSamples = useOrderBookLiveTrail(data, recorder.interval, symbol);
  const touchReport = useOrderBookTouchReport(data, symbol);

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
            <span>5-level Kite depth · 1s live graph</span>
          </div>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-kite-muted">
          Live window
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
        <button
          type="button"
          className={controlClassName}
          disabled={touchReport.events.length === 0}
          onClick={touchReport.download}
        >
          Download touch report
        </button>
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] ${
            recorder.recording ? "font-medium text-kite-red" : "text-kite-muted"
          }`}
          role="status"
          aria-label={
            recorder.recording ? "Recording in progress" : "Recording stopped"
          }
        >
          {recorder.recording ? (
            <span className="relative inline-flex h-2.5 w-2.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-kite-red opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-kite-red" />
            </span>
          ) : null}
          {recorder.recording ? "Recording" : "Stopped"}
          {` · ${liveSamples.length} live tick${liveSamples.length === 1 ? "" : "s"}`}
          {recorder.samples.length > 0
            ? ` · ${recorder.samples.length} recorded`
            : ""}
          {` · ${touchReport.events.length} touch${
            touchReport.events.length === 1 ? "" : "es"
          }`}
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

      {liveSamples.length > 0 ? (
        <OrderBookRecordingChart samples={liveSamples} live />
      ) : data ? (
        <p className="mt-3 mb-0 border-t border-kite-border/60 pt-3 text-[10px] uppercase tracking-wide text-kite-muted">
          Live graph starting…
        </p>
      ) : null}

      {data || touchReport.events.length > 0 ? (
        <OrderBookTouchReportTable events={touchReport.events} />
      ) : null}
    </section>
  );
}
