import type { DeepakBacktestPayload } from "../types/backtest";
import { formatMetric, formatScenarioLabel } from "../utils/backtestFormat";

interface BacktestResultsTableProps {
  payload: DeepakBacktestPayload;
}

export function BacktestResultsTable({ payload }: BacktestResultsTableProps) {
  const { summary, trades, symbol, tradingSymbol, fromDate, toDate, runAt } = payload;

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-xs font-medium uppercase tracking-wide text-kite-muted">
          Backtest Results · {symbol}
          {tradingSymbol !== symbol ? ` (${tradingSymbol})` : ""}
        </h2>
        <p className="m-0 text-[10px] text-kite-muted">
          Run at {new Date(runAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
        </p>
      </div>

      <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <p className="m-0 text-kite-muted">
          Range: <span className="text-kite-text">{fromDate} → {toDate}</span>
        </p>
        <p className="m-0 text-kite-muted">
          Days scanned: <span className="text-kite-text">{summary.tradingDaysScanned}</span>
        </p>
        <p className="m-0 text-kite-muted">
          Signals:{" "}
          <span className="text-kite-text">
            {summary.totalSignals} ({summary.buyCount} BUY, {summary.sellCount} SELL)
          </span>
        </p>
        <p className="m-0 text-kite-muted">
          Targets:{" "}
          <span className="text-kite-text">
            {summary.targetsHit} hit · {summary.targetsMissed} missed
          </span>
        </p>
        <p className="m-0 text-kite-muted sm:col-span-2">
          Avg profit (exits):{" "}
          <span className="text-kite-text">{formatMetric(summary.avgProfit)}</span>
        </p>
      </div>

      {trades.length === 0 ? (
        <p className="m-0 text-xs text-kite-muted">
          No BUY/SELL signals in the selected date range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-kite-border text-left text-kite-muted">
                <th className="px-2 py-1.5 font-medium">Date</th>
                <th className="px-2 py-1.5 font-medium">Side</th>
                <th className="px-2 py-1.5 font-medium">Sc#</th>
                <th className="px-2 py-1.5 font-medium">Scenario</th>
                <th className="px-2 py-1.5 font-medium">Entry IST</th>
                <th className="px-2 py-1.5 font-medium">Entry</th>
                <th className="px-2 py-1.5 font-medium">Exit IST</th>
                <th className="px-2 py-1.5 font-medium">Exit</th>
                <th className="px-2 py-1.5 font-medium">Hit</th>
                <th className="px-2 py-1.5 font-medium">Target</th>
                <th className="px-2 py-1.5 font-medium">Profit</th>
                <th className="px-2 py-1.5 font-medium">Match</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => (
                <tr
                  key={`${trade.date}-${trade.entryTimeIst}-${trade.scenarioNumber}-${index}`}
                  className="border-b border-kite-border/50"
                >
                  <td className="px-2 py-1.5">{trade.date}</td>
                  <td
                    className={`px-2 py-1.5 font-medium ${
                      trade.side === "BUY" ? "text-kite-green" : "text-kite-red"
                    }`}
                  >
                    {trade.side}
                  </td>
                  <td className="px-2 py-1.5">{trade.scenarioNumber}</td>
                  <td className="px-2 py-1.5">{formatScenarioLabel(trade.scenarioKey)}</td>
                  <td className="px-2 py-1.5">{trade.entryTimeIst}</td>
                  <td className="px-2 py-1.5 tabular-nums">{trade.entryPrice.toFixed(2)}</td>
                  <td className="px-2 py-1.5">{trade.exitTimeIst ?? "—"}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {trade.exitPrice != null ? trade.exitPrice.toFixed(2) : "—"}
                  </td>
                  <td className="px-2 py-1.5">{trade.targetHit ? "Y" : "N"}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatMetric(trade.profitTarget)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatMetric(trade.profit)}</td>
                  <td className="px-2 py-1.5">{trade.bbMatchType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
