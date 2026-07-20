import type { DepthSnapshot } from "../types/dashboard";

interface OrderBookCardProps {
  depth: DepthSnapshot | null;
  mode: "live" | "historical";
}

function formatIndianQty(value: number): string {
  return value.toLocaleString("en-IN");
}

function DepthRow({
  price,
  orders,
  quantity,
  maxQty,
  side,
}: {
  price: number;
  orders: number;
  quantity: number;
  maxQty: number;
  side: "bid" | "ask";
}) {
  const widthPct = maxQty > 0 ? (quantity / maxQty) * 100 : 0;
  const barColor = side === "bid" ? "bg-kite-green/15" : "bg-kite-red/15";

  return (
    <div className="relative grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-0.5 text-xs tabular-nums">
      <div
        className={`absolute inset-y-0 ${side === "bid" ? "left-0" : "right-0"} ${barColor}`}
        style={{ width: `${widthPct}%` }}
      />
      <span className="relative z-10 font-medium text-kite-text">{price.toFixed(2)}</span>
      <span className="relative z-10 text-kite-muted">{orders}</span>
      <span className="relative z-10 text-right text-kite-text">
        {formatIndianQty(quantity)}
      </span>
    </div>
  );
}

export function OrderBookCard({ depth, mode }: OrderBookCardProps) {
  if (mode === "historical" || !depth) {
    return (
      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 mb-2 text-xs font-medium uppercase tracking-wide text-kite-muted">
          Order Book
        </h2>
        <p className="m-0 text-xs text-kite-muted">
          Order book depth is available in live mode only.
        </p>
      </section>
    );
  }

  const maxBidQty = Math.max(...depth.bids.map((level) => level.quantity), 1);
  const maxAskQty = Math.max(...depth.asks.map((level) => level.quantity), 1);

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-xs font-medium uppercase tracking-wide text-kite-muted">
          Order Book
        </h2>
        <div className="flex flex-wrap gap-3 text-[10px] tabular-nums text-kite-muted">
          <span>
            LTP{" "}
            <span className="font-medium text-kite-text">
              {depth.lastPrice.toFixed(2)}
            </span>
          </span>
          <span>
            Spread{" "}
            <span className="font-medium text-kite-text">
              {depth.spread.toFixed(2)}
            </span>
          </span>
          <span>
            Imbalance{" "}
            <span className="font-medium text-kite-text">
              {depth.imbalanceRatio.toFixed(2)}
            </span>
          </span>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-px text-[10px] uppercase tracking-wide text-kite-muted">
        <div className="rounded-sm bg-kite-surface px-2 py-1">
          Total Bid: {formatIndianQty(depth.buyQuantity)}
        </div>
        <div className="rounded-sm bg-kite-surface px-2 py-1 text-right">
          Total Offer: {formatIndianQty(depth.sellQuantity)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px md:grid-cols-2">
        <div>
          <p className="m-0 mb-1 px-2 text-[10px] font-medium uppercase tracking-wide text-kite-green">
            Bids
          </p>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-kite-muted">
            <span>Price</span>
            <span>Orders</span>
            <span className="text-right">Qty</span>
          </div>
          {depth.bids.map((level) => (
            <DepthRow
              key={`bid-${level.price}`}
              price={level.price}
              orders={level.orders}
              quantity={level.quantity}
              maxQty={maxBidQty}
              side="bid"
            />
          ))}
        </div>

        <div>
          <p className="m-0 mb-1 px-2 text-[10px] font-medium uppercase tracking-wide text-kite-red">
            Offers
          </p>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-kite-muted">
            <span>Price</span>
            <span>Orders</span>
            <span className="text-right">Qty</span>
          </div>
          {depth.asks.map((level) => (
            <DepthRow
              key={`ask-${level.price}`}
              price={level.price}
              orders={level.orders}
              quantity={level.quantity}
              maxQty={maxAskQty}
              side="ask"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
