import type { SamcoLedgerEntry } from "../api/samco";
import { formatCurrency, formatPnL } from "../utils/paperTrading";
import {
  buildSamcoPnLSummary,
  type SamcoTradePnLRow,
} from "../utils/samcoPnL";

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

function TradeRows({
  trades,
  emptyLabel,
  showExitColumns,
}: {
  trades: SamcoTradePnLRow[];
  emptyLabel: string;
  showExitColumns: boolean;
}) {
  if (trades.length === 0) {
    return (
      <tr>
        <td colSpan={9} className="py-3 text-kite-muted">
          {emptyLabel}
        </td>
      </tr>
    );
  }

  return (
    <>
      {trades.map((trade) => (
        <tr key={`${trade.status}-${trade.signalKey}`} className="border-b border-kite-border/60">
          <td className="py-2 pr-3 text-kite-text">
            <div className="font-medium">{trade.tradingSymbol}</div>
            <div className="text-[10px] text-kite-muted">{trade.stockName}</div>
          </td>
          <td
            className={`py-2 pr-3 font-medium ${
              trade.side === "BUY" ? "text-kite-green" : "text-kite-red"
            }`}
          >
            {trade.side}
          </td>
          <td className="py-2 pr-3 tabular-nums text-kite-text">{trade.quantity}</td>
          <td className="py-2 pr-3 tabular-nums text-kite-text">
            {formatCurrency(trade.entryPrice)}
          </td>
          <td className="py-2 pr-3 tabular-nums text-kite-text">
            {formatCurrency(trade.markOrExitPrice)}
            {!showExitColumns && (
              <div className="text-[10px] text-kite-muted">mark</div>
            )}
          </td>
          <td className="py-2 pr-3 text-kite-text">{trade.entryTimeIst}</td>
          <td className="py-2 pr-3 text-kite-text">
            {showExitColumns ? trade.exitTimeIst ?? "—" : "—"}
          </td>
          <td className="py-2 pr-3 text-kite-muted">
            {showExitColumns
              ? trade.exitReason ?? "—"
              : trade.status === "open"
                ? "open"
                : "—"}
          </td>
          <td
            className={`py-2 pr-3 font-medium tabular-nums ${pnlClass(trade.pnl)}`}
          >
            {formatPnL(trade.pnl)}
            {!showExitColumns && (
              <div className="text-[10px] font-normal text-kite-muted">unrealized</div>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

interface SamcoPnLPanelProps {
  entries: SamcoLedgerEntry[];
}

export function SamcoPnLPanel({ entries }: SamcoPnLPanelProps) {
  const summary = buildSamcoPnLSummary(entries);

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Profit &amp; Loss
        </h3>
        <p className="m-0 text-[11px] text-kite-muted">
          Realized on exits · unrealized on open vs Day Scan mark mid
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricRow
          label="Total P&L"
          value={formatPnL(summary.totalPnL)}
          valueClassName={pnlClass(summary.totalPnL)}
        />
        <MetricRow
          label="Realized P&L"
          value={formatPnL(summary.totalRealizedPnL)}
          valueClassName={pnlClass(summary.totalRealizedPnL)}
        />
        <MetricRow
          label="Unrealized P&L"
          value={formatPnL(summary.totalUnrealizedPnL)}
          valueClassName={pnlClass(summary.totalUnrealizedPnL)}
        />
        <MetricRow
          label="Open / closed"
          value={`${summary.openPositionCount} / ${summary.closedTradeCount}`}
        />
        <MetricRow
          label="Qty open"
          value={String(summary.totalQuantityOpen)}
        />
        <MetricRow
          label="Qty closed"
          value={String(summary.totalQuantityClosed)}
        />
        <MetricRow label="Winners" value={String(summary.winners)} />
        <MetricRow label="Losers" value={String(summary.losers)} />
      </div>

      {summary.openTrades.length > 0 && (
        <div className="mt-4">
          <h4 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-kite-muted">
            Open positions
          </h4>
          <div className="mt-2 max-h-56 overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-kite-surface">
                <tr className="border-b border-kite-border text-kite-muted">
                  <th className="py-2 pr-3 font-medium">Symbol</th>
                  <th className="py-2 pr-3 font-medium">Side</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Entry</th>
                  <th className="py-2 pr-3 font-medium">Mark</th>
                  <th className="py-2 pr-3 font-medium">Entry time</th>
                  <th className="py-2 pr-3 font-medium">Exit time</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                <TradeRows
                  trades={summary.openTrades}
                  emptyLabel="No open positions with a mark price."
                  showExitColumns={false}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4">
        <h4 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-kite-muted">
          Closed trades
        </h4>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-kite-surface">
              <tr className="border-b border-kite-border text-kite-muted">
                <th className="py-2 pr-3 font-medium">Symbol</th>
                <th className="py-2 pr-3 font-medium">Side</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                <th className="py-2 pr-3 font-medium">Entry</th>
                <th className="py-2 pr-3 font-medium">Exit</th>
                <th className="py-2 pr-3 font-medium">Entry time</th>
                <th className="py-2 pr-3 font-medium">Exit time</th>
                <th className="py-2 pr-3 font-medium">Reason</th>
                <th className="py-2 pr-3 font-medium">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              <TradeRows
                trades={summary.closedTrades}
                emptyLabel="No closed trades yet. Realized P&L appears after entry + exit are recorded."
                showExitColumns
              />
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
