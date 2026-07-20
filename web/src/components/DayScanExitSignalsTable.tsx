import type { DayScanSimulationExit } from "../types/backtest";

import {

  formatDayScanStrategy,

  formatExitType,

  formatMetric,

  formatScenarioLabel,

} from "../utils/backtestFormat";



interface DayScanExitSignalsTableProps {

  exits: DayScanSimulationExit[];

  simulatedTimeIst: string | null;

}



export function DayScanExitSignalsTable({

  exits,

  simulatedTimeIst,

}: DayScanExitSignalsTableProps) {

  return (

    <section className="border border-kite-border bg-kite-surface p-3">

      <h2 className="m-0 mb-3 text-xs font-medium uppercase tracking-wide text-kite-muted">

        Exit Signals

      </h2>



      {exits.length === 0 ? (

        <p className="m-0 text-xs text-kite-muted">

          No exits yet. Exits appear when profit targets are hit or watch-party stop losses

          trigger during replay.

        </p>

      ) : (

        <div className="overflow-x-auto">

          <table className="w-full min-w-[1150px] border-collapse text-xs">

            <thead>

              <tr className="border-b border-kite-border text-left text-kite-muted">

                <th className="px-2 py-1.5 font-medium">Stock</th>

                <th className="px-2 py-1.5 font-medium">Strategy</th>

                <th className="px-2 py-1.5 font-medium">Sector</th>

                <th className="px-2 py-1.5 font-medium">Side</th>

                <th className="px-2 py-1.5 font-medium">Scenario</th>

                <th className="px-2 py-1.5 font-medium">Entry IST</th>

                <th className="px-2 py-1.5 font-medium">Entry Price</th>

                <th className="px-2 py-1.5 font-medium">Exit IST</th>

                <th className="px-2 py-1.5 font-medium">Exit Price</th>

                <th className="px-2 py-1.5 font-medium">Exit Type</th>

                <th className="px-2 py-1.5 font-medium">Profit</th>

              </tr>

            </thead>

            <tbody>

              {exits.map((exit, index) => {

                const isNew =

                  simulatedTimeIst != null && exit.exitTimeIst === simulatedTimeIst;



                return (

                  <tr

                    key={`${exit.strategy}-${exit.tradingSymbol}-${exit.exitTimeIst}-${exit.entryTimeIst}-${index}`}

                    className={`border-b border-kite-border/50 ${

                      isNew ? "bg-kite-orange/10" : ""

                    }`}

                  >

                    <td className="px-2 py-1.5 font-medium">{exit.tradingSymbol}</td>

                    <td className="px-2 py-1.5">{formatDayScanStrategy(exit.strategy)}</td>

                    <td className="px-2 py-1.5">{exit.sector}</td>

                    <td

                      className={`px-2 py-1.5 font-medium ${

                        exit.side === "BUY" ? "text-kite-green" : "text-kite-red"

                      }`}

                    >

                      {exit.side}

                    </td>

                    <td className="px-2 py-1.5">{formatScenarioLabel(exit.scenarioKey)}</td>

                    <td className="px-2 py-1.5">{exit.entryTimeIst}</td>

                    <td className="px-2 py-1.5 tabular-nums">{exit.entryPrice.toFixed(2)}</td>

                    <td className="px-2 py-1.5">{exit.exitTimeIst}</td>

                    <td className="px-2 py-1.5 tabular-nums">{exit.exitPrice.toFixed(2)}</td>

                    <td className="px-2 py-1.5">{formatExitType(exit)}</td>

                    <td className="px-2 py-1.5 tabular-nums">{formatMetric(exit.profit)}</td>

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


