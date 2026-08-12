import type { SamcoLedgerEntry } from "../api/samco";
import { formatCurrency, formatPnL } from "../utils/paperTrading";
import { buildSamcoPnLSummary } from "../utils/samcoPnL";

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
          Realized from closed trades · qty applied · no live mark for open
        </p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricRow
          label="Total realized P&L"
          value={formatPnL(summary.totalRealizedPnL)}
          valueClassName={pnlClass(summary.totalRealizedPnL)}
        />
        <MetricRow
          label="Closed trades"
          value={String(summary.closedTradeCount)}
        />
        <MetricRow
          label="Total qty closed"
          value={String(summary.totalQuantity)}
        />
        <MetricRow
          label="Open positions"
          value={String(summary.openPositionCount)}
        />
        <MetricRow label="Winners" value={String(summary.winners)} />
        <MetricRow label="Losers" value={String(summary.losers)} />
      </div>

      <div className="mt-3 max-h-72 overflow-auto">
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
            {summary.closedTrades.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-3 text-kite-muted">
                  No closed trades yet. P&amp;L appears after entry + exit are
                  recorded in the ledger.
                </td>
              </tr>
            ) : (
              summary.closedTrades.map((trade) => (
                <tr
                  key={trade.signalKey}
                  className="border-b border-kite-border/60"
                >
                  <td className="py-2 pr-3 text-kite-text">
                    <div className="font-medium">{trade.tradingSymbol}</div>
                    <div className="text-[10px] text-kite-muted">
                      {trade.stockName}
                    </div>
                  </td>
                  <td
                    className={`py-2 pr-3 font-medium ${
                      trade.side === "BUY" ? "text-kite-green" : "text-kite-red"
                    }`}
                  >
                    {trade.side}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-kite-text">
                    {trade.quantity}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-kite-text">
                    {formatCurrency(trade.entryPrice)}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-kite-text">
                    {formatCurrency(trade.exitPrice)}
                  </td>
                  <td className="py-2 pr-3 text-kite-text">{trade.entryTimeIst}</td>
                  <td className="py-2 pr-3 text-kite-text">
                    {trade.exitTimeIst ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-kite-muted">
                    {trade.exitReason ?? "—"}
                  </td>
                  <td
                    className={`py-2 pr-3 font-medium tabular-nums ${pnlClass(trade.realizedPnL)}`}
                  >
                    {formatPnL(trade.realizedPnL)}
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
