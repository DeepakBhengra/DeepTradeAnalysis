import type {
  DeepakDayScanPayload,
  DeepakWatchPartyDayScanPayload,
} from "../types/backtest";
import {
  formatExitType,
  formatMetric,
  formatScenarioLabel,
} from "../utils/backtestFormat";
import { downloadDayScanCsv } from "../utils/dayScanCsv";
import { formatUnknownError } from "../utils/formatError";

type DayScanResultsPayload = DeepakDayScanPayload | DeepakWatchPartyDayScanPayload;

interface SectorBacktestResultsTableProps {
  payload: DayScanResultsPayload;
  showConfidenceFactors?: boolean;
  showStopSummary?: boolean;
  csvFilePrefix?: string;
}

export function SectorBacktestResultsTable({
  payload,
  showConfidenceFactors = false,
  showStopSummary = false,
  csvFilePrefix,
}: SectorBacktestResultsTableProps) {
  const { summary, trades, errors, date, runAt } = payload;

  const handleDownloadCsv = () => {
    if (!csvFilePrefix) {
      return;
    }
    downloadDayScanCsv({
      trades,
      date,
      filePrefix: csvFilePrefix,
    });
  };

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-xs font-medium uppercase tracking-wide text-kite-muted">
          Day Scan Results · {date}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {csvFilePrefix && (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-[10px] font-medium text-kite-text"
            >
              Download CSV
            </button>
          )}
          <p className="m-0 text-[10px] text-kite-muted">
            Run at {new Date(runAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </p>
        </div>
      </div>

      <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <p className="m-0 text-kite-muted">
          Stocks scanned: <span className="text-kite-text">{summary.stocksScanned}</span>
        </p>
        <p className="m-0 text-kite-muted">
          With signals: <span className="text-kite-text">{summary.stocksWithSignals}</span>
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
        {showStopSummary && summary.stopsHit != null && (
          <p className="m-0 text-kite-muted">
            Stop losses: <span className="text-kite-text">{summary.stopsHit}</span>
          </p>
        )}
        <p className="m-0 text-kite-muted sm:col-span-2">
          Avg profit (exits):{" "}
          <span className="text-kite-text">{formatMetric(summary.avgProfit)}</span>
        </p>
        {summary.errorCount > 0 && (
          <p className="m-0 text-kite-muted sm:col-span-2">
            Fetch errors: <span className="text-kite-red">{summary.errorCount}</span>
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="mb-3 list-none space-y-1 p-0 text-xs text-kite-red">
          {errors.map((entry) => (
            <li key={`${entry.sector}-${entry.tradingSymbol}`}>
              {entry.tradingSymbol} ({entry.sector}): {formatUnknownError(entry.error)}
            </li>
          ))}
        </ul>
      )}

      {trades.length === 0 ? (
        <p className="m-0 text-xs text-kite-muted">
          No BUY/SELL signals on {date} across the sector watchlist.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-kite-border text-left text-kite-muted">
                <th className="px-2 py-1.5 font-medium">Stock</th>
                <th className="px-2 py-1.5 font-medium">Sector</th>
                <th className="px-2 py-1.5 font-medium">Date</th>
                <th className="px-2 py-1.5 font-medium">Side</th>
                <th className="px-2 py-1.5 font-medium">Sc#</th>
                <th className="px-2 py-1.5 font-medium">Scenario</th>
                <th className="px-2 py-1.5 font-medium">Entry IST</th>
                <th className="px-2 py-1.5 font-medium">Entry</th>
                <th className="px-2 py-1.5 font-medium">Exit IST</th>
                <th className="px-2 py-1.5 font-medium">Exit</th>
                <th className="px-2 py-1.5 font-medium">Exit Type</th>
                <th className="px-2 py-1.5 font-medium">Target</th>
                <th className="px-2 py-1.5 font-medium">Profit</th>
                <th className="px-2 py-1.5 font-medium">Match</th>
                {showConfidenceFactors && (
                  <th className="px-2 py-1.5 font-medium">Gates</th>
                )}
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => (
                <tr
                  key={`${trade.tradingSymbol}-${trade.entryTimeIst}-${trade.scenarioNumber}-${index}`}
                  className="border-b border-kite-border/50"
                >
                  <td className="px-2 py-1.5 font-medium">{trade.tradingSymbol}</td>
                  <td className="px-2 py-1.5">{trade.sector}</td>
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
                  <td className="px-2 py-1.5">{formatExitType(trade)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatMetric(trade.profitTarget)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatMetric(trade.profit)}</td>
                    <td className="px-2 py-1.5">{trade.bbMatchType}</td>
                    {showConfidenceFactors && (
                      <td className="px-2 py-1.5">
                        {trade.confidenceFactors?.join(", ") ?? "—"}
                      </td>
                    )}
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
