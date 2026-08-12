import type { DayOrderFill, DayOrderPortfolio, DayOrderPnLSummary } from "../types/dayOrder";
import { DAY_ORDER_INITIAL_CASH } from "../types/dayOrder";
import type { DayScanSimulationMark } from "../types/backtest";
import { formatDayScanStrategy } from "../utils/backtestFormat";
import { downloadDayOrderHistoryCsv } from "../utils/dayOrderHistoryCsv";
import {
  dayOrderFillDisplayPnL,
  marksMapFromSimulation,
} from "../utils/dayOrderEngine";
import { formatCurrency, formatPnL } from "../utils/paperTrading";

function sideClass(side: DayOrderFill["side"]): string {
  return side === "BUY" ? "text-kite-green" : "text-kite-red";
}

interface DayOrderPortfolioPanelProps {
  portfolio: DayOrderPortfolio;
  pnl: DayOrderPnLSummary;
  /** IST analysis date (YYYY-MM-DD) used for the CSV filename. */
  date: string;
  /** Current-candle mids from Day Scan Simulator (open unrealized P&L). */
  marks?: DayScanSimulationMark[];
  /** Voluntary exit of an open position at the current mark. */
  onExitPosition?: (signalKey: string) => void;
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

export function DayOrderPortfolioPanel({
  portfolio,
  pnl,
  date,
  marks = [],
  onExitPosition,
}: DayOrderPortfolioPanelProps) {
  const { openPositions, fills, skippedEntryKeys } = portfolio;
  const entryFills = fills.filter((fill) => fill.kind === "entry");
  const exitFills = fills.filter((fill) => fill.kind === "exit");
  const historyFills = [...fills].reverse();
  const marksMap = marksMapFromSimulation(marks);
  const openSignalKeys = new Set(openPositions.map((position) => position.signalKey));

  const handleDownloadCsv = () => {
    if (fills.length === 0) {
      return;
    }
    downloadDayOrderHistoryCsv({ fills, date });
  };

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
          <MetricRow label="Entries filled" value={String(entryFills.length)} />
          <MetricRow label="Exits filled" value={String(exitFills.length)} />
          <MetricRow label="Entries skipped" value={String(skippedEntryKeys.length)} />
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
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-kite-border text-left text-kite-muted">
                  <th className="pb-2 pr-2 font-medium">Stock</th>
                  <th className="pb-2 pr-2 font-medium">Strategy</th>
                  <th className="pb-2 pr-2 font-medium">Side</th>
                  <th className="pb-2 pr-2 font-medium">Qty</th>
                  <th className="pb-2 pr-2 font-medium">Entry</th>
                  <th className="pb-2 pr-2 font-medium">Mark</th>
                  <th className="pb-2 pr-2 font-medium">Entry IST</th>
                  <th className="pb-2 pr-2 font-medium">Unrealized P&amp;L</th>
                  <th className="pb-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((position) => {
                  const mark = marksMap.get(position.tradingSymbol);
                  const unrealized =
                    typeof mark === "number"
                      ? dayOrderFillDisplayPnL(
                          {
                            id: position.signalKey,
                            kind: "entry",
                            signalKey: position.signalKey,
                            tradingSymbol: position.tradingSymbol,
                            symbol: position.symbol,
                            strategy: position.strategy,
                            side: position.side,
                            quantity: position.quantity,
                            price: position.entryPrice,
                            timeIst: position.entryTimeIst,
                            sessionIndex: 0,
                            realizedPnL: null,
                          },
                          openSignalKeys,
                          marksMap,
                        )
                      : null;
                  const canExit = typeof onExitPosition === "function";
                  const exitUsesMark =
                    typeof mark === "number" && Number.isFinite(mark);
                  return (
                    <tr key={position.signalKey} className="border-b border-kite-border">
                      <td className="py-2 pr-2 font-medium">{position.tradingSymbol}</td>
                      <td className="py-2 pr-2">{formatDayScanStrategy(position.strategy)}</td>
                      <td className="py-2 pr-2">{position.side}</td>
                      <td className="py-2 pr-2 tabular-nums">{position.quantity}</td>
                      <td className="py-2 pr-2 tabular-nums">{position.entryPrice.toFixed(2)}</td>
                      <td className="py-2 pr-2 tabular-nums">
                        {typeof mark === "number" ? mark.toFixed(2) : "—"}
                      </td>
                      <td className="py-2 pr-2">{position.entryTimeIst}</td>
                      <td
                        className={`py-2 pr-2 tabular-nums ${
                          unrealized == null ? "text-kite-muted" : pnlClass(unrealized)
                        }`}
                      >
                        {unrealized == null ? "—" : formatPnL(unrealized)}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={!canExit}
                          onClick={() => onExitPosition?.(position.signalKey)}
                          className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-[10px] font-medium text-kite-text disabled:cursor-not-allowed disabled:opacity-50"
                          title={
                            exitUsesMark
                              ? "Exit at current mark mid"
                              : "Exit at entry (mark unavailable)"
                          }
                        >
                          Exit
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
            Order history
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {fills.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-[10px] font-medium text-kite-text"
                >
                  Download CSV
                </button>
                <p className="m-0 text-[10px] text-kite-muted">
                  {fills.length} fill{fills.length === 1 ? "" : "s"} · newest first · scroll for
                  morning 09:15 entries/exits
                </p>
              </>
            )}
          </div>
        </div>
        {fills.length === 0 ? (
          <p className="mt-3 mb-0 text-xs text-kite-muted">No filled orders yet.</p>
        ) : (
          <div className="mt-3 max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs">
              <thead className="sticky top-0 bg-kite-surface">
                <tr className="border-b border-kite-border text-left text-kite-muted">
                  <th className="pb-2 pr-2 font-medium">Type</th>
                  <th className="pb-2 pr-2 font-medium">Side</th>
                  <th className="pb-2 pr-2 font-medium">Qty</th>
                  <th className="pb-2 pr-2 font-medium">Stock</th>
                  <th className="pb-2 pr-2 font-medium">Price</th>
                  <th className="pb-2 pr-2 font-medium">Strategy</th>
                  <th className="pb-2 pr-2 font-medium">Time (IST)</th>
                  <th className="pb-2 font-medium">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {historyFills.map((fill) => {
                  const displayPnL = dayOrderFillDisplayPnL(
                    fill,
                    openSignalKeys,
                    marksMap,
                  );
                  return (
                  <tr key={fill.id} className="border-b border-kite-border">
                    <td className="py-2 pr-2 capitalize text-kite-text">
                      {fill.kind}
                    </td>
                    <td className={`py-2 pr-2 font-medium ${sideClass(fill.side)}`}>
                      {fill.side}
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-kite-text">
                      {fill.quantity}
                    </td>
                    <td className="py-2 pr-2 font-medium text-kite-text">
                      {fill.tradingSymbol}
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-kite-text">
                      {fill.price.toFixed(2)}
                    </td>
                    <td className="py-2 pr-2 text-kite-text">
                      {formatDayScanStrategy(fill.strategy)}
                    </td>
                    <td className="py-2 pr-2 tabular-nums text-kite-text">
                      {fill.timeIst}
                    </td>
                    <td
                      className={`py-2 tabular-nums ${
                        displayPnL == null ? "text-kite-muted" : pnlClass(displayPnL)
                      }`}
                    >
                      {displayPnL == null ? "—" : formatPnL(displayPnL)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
