import type { DayOrderPortfolio, DayOrderPnLSummary } from "../types/dayOrder";
import { DAY_ORDER_INITIAL_CASH } from "../types/dayOrder";
import { describeDayOrderFill } from "../utils/dayOrderEngine";
import { formatCurrency, formatPnL } from "../utils/paperTrading";

interface DayOrderPortfolioPanelProps {
  portfolio: DayOrderPortfolio;
  pnl: DayOrderPnLSummary;
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

function formatStrategy(strategy: DayOrderPortfolio["openPositions"][number]["strategy"]): string {
  return strategy === "deepak" ? "Deepak" : "Deepak-2";
}

export function DayOrderPortfolioPanel({ portfolio, pnl }: DayOrderPortfolioPanelProps) {
  const { openPositions, fills } = portfolio;

  return (
    <div className="flex flex-col gap-3">
      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Funds
        </h2>
        <div className="mt-3 space-y-2">
          <MetricRow label="Initial capital" value={formatCurrency(DAY_ORDER_INITIAL_CASH)} />
          <MetricRow label="Available cash" value={formatCurrency(pnl.cash)} />
          <MetricRow label="Deployed capital" value={formatCurrency(pnl.deployedCapital)} />
          <MetricRow label="Total equity" value={formatCurrency(pnl.equity)} />
        </div>
      </section>

      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Open positions
        </h2>
        {openPositions.length === 0 ? (
          <p className="mt-3 mb-0 text-xs text-kite-muted">No open positions.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-kite-border text-left text-kite-muted">
                  <th className="pb-2 pr-2 font-medium">Stock</th>
                  <th className="pb-2 pr-2 font-medium">Strategy</th>
                  <th className="pb-2 pr-2 font-medium">Side</th>
                  <th className="pb-2 pr-2 font-medium">Qty</th>
                  <th className="pb-2 pr-2 font-medium">Entry</th>
                  <th className="pb-2 font-medium">Entry IST</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((position) => (
                  <tr key={position.signalKey} className="border-b border-kite-border">
                    <td className="py-2 pr-2 font-medium">{position.tradingSymbol}</td>
                    <td className="py-2 pr-2">{formatStrategy(position.strategy)}</td>
                    <td className="py-2 pr-2">{position.side}</td>
                    <td className="py-2 pr-2 tabular-nums">{position.quantity}</td>
                    <td className="py-2 pr-2 tabular-nums">{position.entryPrice.toFixed(2)}</td>
                    <td className="py-2">{position.entryTimeIst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            {[...fills].reverse().slice(0, 20).map((fill) => (
              <li key={fill.id} className="py-2 text-xs text-kite-text">
                {describeDayOrderFill(fill)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-kite-border bg-kite-surface p-3">
        <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Pending orders
        </h2>
        <p className="mt-3 mb-0 text-xs text-kite-muted">
          No pending orders. Entries and exits fill immediately at scan-advised prices.
        </p>
      </section>
    </div>
  );
}
