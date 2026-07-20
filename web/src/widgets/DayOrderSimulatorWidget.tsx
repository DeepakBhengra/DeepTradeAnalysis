import { AnalysisDatePicker } from "../components/AnalysisDatePicker";
import { DayOrderPortfolioPanel } from "../components/DayOrderPortfolioPanel";
import { useDayScanSimulationContext } from "../context/DayScanSimulationContext";
import { useDayOrderSimulation } from "../hooks/useDayOrderSimulation";

interface DayOrderSimulatorWidgetProps {
  isActive: boolean;
}

function formatScanStatus(status: string): string {
  switch (status) {
    case "playing":
      return "Playing";
    case "paused":
      return "Paused";
    case "complete":
      return "Complete";
    case "loading":
      return "Loading";
    default:
      return "Idle";
  }
}

export function DayOrderSimulatorWidget({ isActive }: DayOrderSimulatorWidgetProps) {
  const {
    analysisDate: scanDate,
    status: scanStatus,
    simulatedTimeIst,
    sessionIndex,
    sessionCandleCount,
  } = useDayScanSimulationContext();

  const {
    orderDate,
    setOrderDate,
    status,
    portfolio,
    pnl,
    canStart,
    startBlockedReason,
    dateMismatch,
    start,
    stop,
  } = useDayOrderSimulation();

  const isRunning = status === "running";

  return (
    <div hidden={!isActive}>
      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
        <section className="border border-kite-border bg-kite-surface p-3">
          <div className="flex flex-wrap items-end gap-3">
            <AnalysisDatePicker
              analysisDate={orderDate}
              onChange={(date) => {
                if (date) {
                  setOrderDate(date);
                }
              }}
              showTodayButton={false}
            />
            <button
              type="button"
              onClick={start}
              disabled={!canStart || isRunning}
              className="cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start
            </button>
            <button
              type="button"
              onClick={stop}
              disabled={!isRunning}
              className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs font-medium text-kite-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              Stop
            </button>
          </div>

          <div className="mt-3 grid gap-1 text-xs text-kite-muted sm:grid-cols-2 lg:grid-cols-4">
            <p className="m-0">
              Order status:{" "}
              <span className="text-kite-text">
                {status === "running"
                  ? "Running"
                  : status === "complete"
                    ? "Complete"
                    : "Idle"}
              </span>
            </p>
            <p className="m-0">
              Scan date: <span className="text-kite-text">{scanDate}</span>
            </p>
            <p className="m-0">
              Scan status: <span className="text-kite-text">{formatScanStatus(scanStatus)}</span>
            </p>
            <p className="m-0">
              Simulated time:{" "}
              <span className="text-kite-text">
                {simulatedTimeIst ?? "—"} IST
                {sessionCandleCount > 0
                  ? ` · candle ${sessionIndex + 1}/${sessionCandleCount}`
                  : ""}
              </span>
            </p>
          </div>

          {dateMismatch && (
            <p className="m-0 mt-2 text-xs text-kite-red">
              Order date ({orderDate}) does not match Day Scan Simulator date ({scanDate}).
            </p>
          )}

          {!isRunning && startBlockedReason && !dateMismatch && (
            <p className="m-0 mt-2 text-xs text-kite-muted">{startBlockedReason}</p>
          )}

          <p className="m-0 mt-2 text-xs text-kite-muted">
            Auto paper-trades Day Scan entry/exit signals with ₹3,00,000 capital, 100 qty per
            stock, max entry price ₹1,900. Start Day Scan Simulator first with the same date.
          </p>
        </section>

        <DayOrderPortfolioPanel portfolio={portfolio} pnl={pnl} />
      </main>
    </div>
  );
}
