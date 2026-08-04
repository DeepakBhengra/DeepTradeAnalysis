import { AnalysisDatePicker } from "../components/AnalysisDatePicker";
import { DayScanEntrySignalsTable } from "../components/DayScanEntrySignalsTable";
import { DayScanExitSignalsTable } from "../components/DayScanExitSignalsTable";
import { SimulationControls } from "../components/SimulationControls";
import { useDayScanSimulationContext } from "../context/DayScanSimulationContext";
import { SECTOR_WATCHLIST_SIZE } from "../data/sectorWatchlist";
import {
  DAY_SCAN_SIMULATION_VARIANT_OPTIONS,
  type DayScanSimulationVariant,
} from "../utils/dayScanSimulationVariant";

interface DayScanSimulatorWidgetProps {
  isActive: boolean;
}

function descriptionForVariant(variant: DayScanSimulationVariant): string {
  const universe = `${SECTOR_WATCHLIST_SIZE} sector stocks`;
  if (variant === "all") {
    return `Replay Deepak, Deepak-2, and Watch Party signals across ${universe} from 09:15–15:00 IST (10s per 15m candle). First Start loads market data (~1–2 min); later candles advance quickly from cache.`;
  }
  if (
    variant === "rulePnb" ||
    variant === "ruleSunpharma" ||
    variant === "ruleLtm" ||
    variant === "ruleIcicigi" ||
    variant === "ruleTechm" ||
    variant === "ruleTvsmotor" ||
    variant === "rulePolicybzr"
  ) {
    return `Replay ${DAY_SCAN_SIMULATION_VARIANT_OPTIONS.find((option) => option.value === variant)?.label ?? variant} signals for its locked symbol from 09:15–15:00 IST (10s per 15m candle). First Start loads market data; later candles advance from cache.`;
  }
  if (variant === "deeppro1") {
    return `Replay Deeppro1 SMI black↔red cross signals until 13:30 IST (+ 0.45% square-off) across ${universe} from 09:15–15:00 IST (10s per 15m candle). First Start loads market data (~1–2 min); later candles advance quickly from cache.`;
  }
  const label =
    DAY_SCAN_SIMULATION_VARIANT_OPTIONS.find((option) => option.value === variant)
      ?.label ?? variant;
  return `Replay ${label} signals across ${universe} from 09:15–15:00 IST (10s per 15m candle). First Start loads market data (~1–2 min); later candles advance quickly from cache.`;
}

export function DayScanSimulatorWidget({ isActive }: DayScanSimulatorWidgetProps) {
  const {
    analysisDate,
    setAnalysisDate,
    ruleVariant,
    setRuleVariant,
    data,
    loading,
    error,
    status,
    sessionIndex,
    sessionCandleCount,
    simulatedTimeIst,
    start,
    pause,
    stop,
  } = useDayScanSimulationContext();

  const isInitialLoad = loading && status === "loading";
  const isTickUpdate =
    loading && (status === "playing" || status === "paused" || status === "complete");
  const busy = status === "playing" || status === "loading" || loading;

  return (
    <div hidden={!isActive}>
      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
        <section className="border border-kite-border bg-kite-surface p-3">
          <div className="flex flex-wrap items-end gap-3">
            <AnalysisDatePicker
              analysisDate={analysisDate}
              onChange={(date) => {
                if (date) {
                  setAnalysisDate(date);
                }
              }}
              showTodayButton={false}
            />
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor="dayscan-sim-rule-variant"
            >
              Rule variant
              <select
                id="dayscan-sim-rule-variant"
                value={ruleVariant}
                disabled={busy}
                onChange={(event) =>
                  setRuleVariant(event.target.value as DayScanSimulationVariant)
                }
                className="min-w-[220px] rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {DAY_SCAN_SIMULATION_VARIANT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <SimulationControls
              status={status}
              sessionIndex={sessionIndex}
              sessionCandleCount={sessionCandleCount}
              simulatedTimeIst={simulatedTimeIst}
              loading={loading}
              onStart={start}
              onPause={pause}
              onStop={stop}
            />
          </div>
          <p className="m-0 mt-2 text-xs text-kite-muted">
            {descriptionForVariant(ruleVariant)}
          </p>
        </section>

        {isInitialLoad && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            Loading watchlist candles for {analysisDate}… ({SECTOR_WATCHLIST_SIZE} symbols)
          </section>
        )}

        {isTickUpdate && !isInitialLoad && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            Advancing to next candle…
          </section>
        )}

        {error && (
          <section className="border border-kite-red/30 bg-kite-surface p-3 text-xs text-kite-red">
            {error}
          </section>
        )}

        {data && (
          <section className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <p className="m-0 text-kite-muted">
              Entries: <span className="text-kite-text">{data.summary.entryCount}</span>
            </p>
            <p className="m-0 text-kite-muted">
              Exits: <span className="text-kite-text">{data.summary.exitCount}</span>
            </p>
            <p className="m-0 text-kite-muted">
              Open: <span className="text-kite-text">{data.summary.openPositions}</span>
            </p>
            <p className="m-0 text-kite-muted">
              Target exits: <span className="text-kite-text">{data.summary.targetsHit}</span>
            </p>
            <p className="m-0 text-kite-muted">
              Stop losses: <span className="text-kite-text">{data.summary.stopsHit}</span>
            </p>
            <p className="m-0 text-kite-muted">
              BUY / SELL:{" "}
              <span className="text-kite-text">
                {data.summary.buyCount} / {data.summary.sellCount}
              </span>
            </p>
          </section>
        )}

        <DayScanEntrySignalsTable
          entries={data?.entries ?? []}
          simulatedTimeIst={simulatedTimeIst}
        />
        <DayScanExitSignalsTable
          exits={data?.exits ?? []}
          simulatedTimeIst={simulatedTimeIst}
        />
      </main>
    </div>
  );
}
