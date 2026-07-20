import type { DayScanSimulationSignal } from "../types/backtest";
import {
  formatDayScanStrategy,
  formatMetric,
  formatScenarioLabel,
} from "../utils/backtestFormat";

interface DayScanEntrySignalsTableProps {
  entries: DayScanSimulationSignal[];
  simulatedTimeIst: string | null;
}

export function DayScanEntrySignalsTable({
  entries,
  simulatedTimeIst,
}: DayScanEntrySignalsTableProps) {
  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <h2 className="m-0 mb-3 text-xs font-medium uppercase tracking-wide text-kite-muted">
        Entry Signals (BUY / SELL)
      </h2>

      {entries.length === 0 ? (
        <p className="m-0 text-xs text-kite-muted">
          No entry signals yet. Press Start to begin replay from 09:15 IST.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-kite-border text-left text-kite-muted">
                <th className="px-2 py-1.5 font-medium">Stock</th>
                <th className="px-2 py-1.5 font-medium">Strategy</th>
                <th className="px-2 py-1.5 font-medium">Sector</th>
                <th className="px-2 py-1.5 font-medium">Side</th>
                <th className="px-2 py-1.5 font-medium">Sc#</th>
                <th className="px-2 py-1.5 font-medium">Scenario</th>
                <th className="px-2 py-1.5 font-medium">Entry IST</th>
                <th className="px-2 py-1.5 font-medium">Entry Price</th>
                <th className="px-2 py-1.5 font-medium">Target</th>
                <th className="px-2 py-1.5 font-medium">Match</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const isNew =
                  simulatedTimeIst != null && entry.entryTimeIst === simulatedTimeIst;

                return (
                  <tr
                    key={`${entry.strategy}-${entry.tradingSymbol}-${entry.entryTimeIst}-${entry.scenarioNumber}-${index}`}
                    className={`border-b border-kite-border/50 ${
                      isNew ? "bg-kite-orange/10" : ""
                    }`}
                  >
                    <td className="px-2 py-1.5 font-medium">{entry.tradingSymbol}</td>
                    <td className="px-2 py-1.5">{formatDayScanStrategy(entry.strategy)}</td>
                    <td className="px-2 py-1.5">{entry.sector}</td>
                    <td
                      className={`px-2 py-1.5 font-medium ${
                        entry.side === "BUY" ? "text-kite-green" : "text-kite-red"
                      }`}
                    >
                      {entry.side}
                    </td>
                    <td className="px-2 py-1.5">{entry.scenarioNumber}</td>
                    <td className="px-2 py-1.5">{formatScenarioLabel(entry.scenarioKey)}</td>
                    <td className="px-2 py-1.5">{entry.entryTimeIst}</td>
                    <td className="px-2 py-1.5 tabular-nums">{entry.entryPrice.toFixed(2)}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {formatMetric(entry.profitTarget)}
                    </td>
                    <td className="px-2 py-1.5">{entry.bbMatchType}</td>
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
