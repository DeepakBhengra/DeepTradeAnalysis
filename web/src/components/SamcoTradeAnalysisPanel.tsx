import type { SamcoLedgerEntry } from "../api/samco";
import { formatDayScanStrategy, formatExitType } from "../utils/backtestFormat";
import { formatCurrency, formatPnL } from "../utils/paperTrading";
import { buildSamcoTradeAnalysis } from "../utils/samcoTradeAnalysis";
import {
  buildSamcoTradeAnalysisCsvFilename,
  downloadSamcoTradeAnalysisCsv,
} from "../utils/samcoTradeAnalysisCsv";

function pnlClass(value: number): string {
  if (value > 0) {
    return "text-kite-green";
  }
  if (value < 0) {
    return "text-kite-red";
  }
  return "text-kite-text";
}

function sideClass(side: "BUY" | "SELL" | null): string {
  if (side === "BUY") {
    return "text-kite-green";
  }
  if (side === "SELL") {
    return "text-kite-red";
  }
  return "text-kite-muted";
}

function formatStrategy(strategy: string): string {
  return formatDayScanStrategy(
    strategy as Parameters<typeof formatDayScanStrategy>[0],
  );
}

function formatExitReason(
  exitReason: string | undefined,
  exitTimeIst: string | null,
): string {
  if (!exitReason) {
    return "—";
  }
  return formatExitType({
    exitReason: exitReason as Parameters<typeof formatExitType>[0]["exitReason"],
    exitTimeIst,
  });
}

interface SamcoTradeAnalysisPanelProps {
  entries: SamcoLedgerEntry[];
  /** Optional IST date key for the CSV filename. */
  dateKey?: string;
}

export function SamcoTradeAnalysisPanel({
  entries,
  dateKey,
}: SamcoTradeAnalysisPanelProps) {
  const rows = buildSamcoTradeAnalysis(entries);
  const closedCount = rows.filter((row) => row.status === "closed").length;
  const openCount = rows.filter((row) => row.status === "open").length;

  const handleDownloadCsv = () => {
    if (rows.length === 0) {
      return;
    }
    downloadSamcoTradeAnalysisCsv(
      rows,
      buildSamcoTradeAnalysisCsvFilename(dateKey),
    );
  };

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
            Trade Analysis
          </h3>
          <p className="mt-1 mb-0 text-[11px] text-kite-muted">
            Entry vs square-off · net P&amp;L after brokerage-charges · {openCount}{" "}
            open · {closedCount} closed
          </p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-[10px] font-medium text-kite-text hover:bg-kite-surface"
          >
            Download CSV
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 mb-0 text-xs text-kite-muted">
          No trade signals to analyse yet. Closed round-trips show taxes on exit.
        </p>
      ) : (
        <div className="mt-3 max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-kite-surface">
              <tr className="border-b border-kite-border text-kite-muted">
                <th className="py-2 pr-3 font-medium">Stock</th>
                <th className="py-2 pr-3 font-medium">Qty</th>
                <th className="py-2 pr-3 font-medium">Strategy</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Entry timing</th>
                <th className="py-2 pr-3 font-medium">Entry signal</th>
                <th className="py-2 pr-3 font-medium">Entry type</th>
                <th className="py-2 pr-3 font-medium">Entry price</th>
                <th className="py-2 pr-3 font-medium">Exit timing</th>
                <th className="py-2 pr-3 font-medium">Exit signal</th>
                <th className="py-2 pr-3 font-medium">Exit type</th>
                <th className="py-2 pr-3 font-medium">Exit price</th>
                <th className="py-2 pr-3 font-medium">Exit reason</th>
                <th className="py-2 pr-3 font-medium">Gross P&amp;L</th>
                <th className="py-2 pr-3 font-medium">Taxes</th>
                <th className="py-2 font-medium">Net P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pending = row.status === "open";
                return (
                  <tr
                    key={row.signalKey}
                    className="border-b border-kite-border/60"
                  >
                    <td className="py-2 pr-3 text-kite-text">
                      <div className="font-medium">{row.tradingSymbol}</div>
                      <div className="text-[10px] text-kite-muted">
                        {row.stockName}
                      </div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-kite-text">
                      {row.quantity}
                    </td>
                    <td className="py-2 pr-3 text-kite-text">
                      {formatStrategy(row.strategy)}
                    </td>
                    <td className="py-2 pr-3 text-kite-text">
                      {row.status === "closed" ? "Squared off" : "Open"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-kite-text">
                      {row.entry.timing ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-kite-text">
                      {row.entry.signalType}
                    </td>
                    <td
                      className={`py-2 pr-3 font-medium ${sideClass(row.entry.tradeType)}`}
                    >
                      {row.entry.tradeType ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-kite-text">
                      {row.entry.price == null
                        ? "—"
                        : formatCurrency(row.entry.price)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-kite-text">
                      {row.exit.timing ?? (pending ? "Pending" : "—")}
                    </td>
                    <td className="py-2 pr-3 text-kite-text">
                      {row.exit.signalType}
                    </td>
                    <td
                      className={`py-2 pr-3 font-medium ${sideClass(row.exit.tradeType)}`}
                    >
                      {row.exit.tradeType ?? "—"}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-kite-text">
                      {row.exit.price == null
                        ? "—"
                        : formatCurrency(row.exit.price)}
                    </td>
                    <td className="py-2 pr-3 text-kite-muted">
                      {pending
                        ? "—"
                        : formatExitReason(row.exitReason, row.exit.timing)}
                    </td>
                    <td
                      className={`py-2 pr-3 tabular-nums font-medium ${
                        row.grossPnL == null
                          ? "text-kite-muted"
                          : pnlClass(row.grossPnL)
                      }`}
                    >
                      {row.grossPnL == null ? "—" : formatPnL(row.grossPnL)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-kite-text">
                      {row.charges == null ? "—" : formatCurrency(row.charges)}
                    </td>
                    <td
                      className={`py-2 tabular-nums font-medium ${
                        row.netPnL == null
                          ? "text-kite-muted"
                          : pnlClass(row.netPnL)
                      }`}
                    >
                      {row.netPnL == null ? "—" : formatPnL(row.netPnL)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
