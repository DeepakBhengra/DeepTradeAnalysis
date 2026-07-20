import type { PortfolioState, PnLSummary } from "../types/paperTrading";
import { INITIAL_CASH } from "../types/paperTrading";
import {
  describeFill,
  formatCurrency,
  formatPnL,
  getPositionSide,
} from "../utils/paperTrading";

interface PositionPnLPanelProps {
  portfolio: PortfolioState;
  pnl: PnLSummary;
  currentPrice: number | null;
  onResetPortfolio: () => void;
  onCancelOrder: (orderId: string) => void;
}

function pnlClass(value: number): string {
  if (value > 0) {
    return "text-kite-green";
  }
  if (value < 0) {
    return "text-kite-red";
  }
  return "text-kite-text";
}

function MetricRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-kite-muted">{label}</span>
      <span className={`font-medium tabular-nums ${valueClassName ?? "text-kite-text"}`}>
        {value}
      </span>
    </div>
  );
}

export function PositionPnLPanel({
  portfolio,
  pnl,
  currentPrice,
  onResetPortfolio,
  onCancelOrder,
}: PositionPnLPanelProps) {
  const { position, pendingOrders, fills } = portfolio;
  const side = getPositionSide(position.quantity);
  const marketValue =
    currentPrice != null ? position.quantity * currentPrice : null;

  return (
    <div className="flex flex-col gap-3">
      <section className="border border-kite-border bg-kite-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
            Funds
          </h2>
          <button
            type="button"
            onClick={onResetPortfolio}
            className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-[10px] text-kite-text hover:bg-kite-surface"
          >
            Reset portfolio
          </button>
        </div>
        <div className="mt-3 space-y-2">
          <MetricRow label="Initial capital" value={formatCurrency(INITIAL_CASH)} />
          <MetricRow label="Available cash" value={formatCurrency(pnl.cash)} />
          <MetricRow label="Total equity" value={formatCurrency(pnl.equity)} />
        </div>
      </section>

      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Position
        </h2>
        <div className="mt-3 space-y-2">
          <MetricRow label="Side" value={side} />
          <MetricRow
            label="Net qty"
            value={position.quantity === 0 ? "0" : String(position.quantity)}
          />
          <MetricRow
            label="Avg price"
            value={position.quantity === 0 ? "—" : position.avgPrice.toFixed(2)}
          />
          <MetricRow
            label="Market value"
            value={
              marketValue != null ? formatCurrency(marketValue) : "—"
            }
          />
        </div>
      </section>

      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Profit &amp; Loss
        </h2>
        <div className="mt-3 space-y-2">
          <MetricRow
            label="Unrealized P&L"
            value={formatPnL(pnl.unrealizedPnL)}
            valueClassName={pnlClass(pnl.unrealizedPnL)}
          />
          <MetricRow
            label="Realized P&L"
            value={formatPnL(pnl.realizedPnL)}
            valueClassName={pnlClass(pnl.realizedPnL)}
          />
          <MetricRow
            label="Total P&L"
            value={formatPnL(pnl.totalPnL)}
            valueClassName={pnlClass(pnl.totalPnL)}
          />
          <MetricRow
            label="Return"
            value={`${pnl.returnPct >= 0 ? "+" : ""}${pnl.returnPct.toFixed(2)}%`}
            valueClassName={pnlClass(pnl.totalPnL)}
          />
        </div>
      </section>

      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Order history
        </h2>
        {fills.length === 0 ? (
          <p className="mt-3 mb-0 text-xs text-kite-muted">No filled orders yet.</p>
        ) : (
          <ul className="m-0 mt-3 list-none divide-y divide-kite-border p-0">
            {[...fills].reverse().slice(0, 10).map((fill) => (
              <li key={fill.id} className="py-2 text-xs text-kite-text">
                {describeFill(fill)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Pending orders
        </h2>
        {pendingOrders.length === 0 ? (
          <p className="mt-3 mb-0 text-xs text-kite-muted">No pending orders.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-kite-border text-left text-kite-muted">
                  <th className="pb-2 pr-2 font-medium">Side</th>
                  <th className="pb-2 pr-2 font-medium">Type</th>
                  <th className="pb-2 pr-2 font-medium">Qty</th>
                  <th className="pb-2 pr-2 font-medium">Price</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((order) => (
                  <tr key={order.id} className="border-b border-kite-border">
                    <td className="py-2 pr-2">{order.side}</td>
                    <td className="py-2 pr-2">{order.orderType}</td>
                    <td className="py-2 pr-2 tabular-nums">{order.quantity}</td>
                    <td className="py-2 pr-2 tabular-nums">{order.price.toFixed(2)}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => onCancelOrder(order.id)}
                        className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-1.5 py-0.5 text-[10px] text-kite-text hover:bg-kite-surface"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
