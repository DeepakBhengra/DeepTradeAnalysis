import { useMemo } from "react";
import { AnalysisDatePicker } from "../components/AnalysisDatePicker";
import { DayScanEntrySignalsTable } from "../components/DayScanEntrySignalsTable";
import { DayScanExitSignalsTable } from "../components/DayScanExitSignalsTable";
import { SimulationControls } from "../components/SimulationControls";
import { useDayScanSimulationContext } from "../context/DayScanSimulationContext";
import { SECTOR_WATCHLIST_SIZE } from "../data/sectorWatchlist";
import { useDayScanLiveRefresh } from "../hooks/useDayScanLiveRefresh";
import {
  DAY_SCAN_SIMULATION_VARIANT_OPTIONS,
  type DayScanSimulationVariant,
} from "../utils/dayScanSimulationVariant";
import { DAY_SCAN_LIVE_REFRESH_UNTIL_IST } from "../utils/istTime";

/** Auto-refresh interval for Day Scan Simulator when date is IST today. */
export const DAY_SCAN_SIMULATOR_LIVE_REFRESH_MS = 15 * 60 * 1000;

interface DayScanSimulatorWidgetProps {
  isActive: boolean;
}

function descriptionForVariant(variant: DayScanSimulationVariant): string {
  const liveNote = ` If the selected date is today, after Start the simulator auto-refreshes to the latest candle every 15 minutes until ${DAY_SCAN_LIVE_REFRESH_UNTIL_IST} IST.`;
  const universe = `${SECTOR_WATCHLIST_SIZE} sector stocks`;
  if (variant === "all") {
    return `Replay Deepak, Deepak-2, and Watch Party signals across ${universe} from 09:15–15:00 IST (10s per 15m candle). First Start loads market data (~1–2 min); later candles advance quickly from cache.${liveNote}`;
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
    return `Replay ${DAY_SCAN_SIMULATION_VARIANT_OPTIONS.find((option) => option.value === variant)?.label ?? variant} signals for its locked symbol from 09:15–15:00 IST (10s per 15m candle). First Start loads market data; later candles advance from cache.${liveNote}`;
  }
  if (variant === "deeppro1") {
    return `Replay Deeppro1 SMI black↔red crosses until 11:45 IST (exits: 0.45% target / 0.3%→breakeven / opposite flip / 15:00 force) across ${universe} from 09:15–15:00 IST (10s per 15m candle). First Start loads market data (~1–2 min); later candles advance quickly from cache.${liveNote}`;
  }
  const label =
    DAY_SCAN_SIMULATION_VARIANT_OPTIONS.find((option) => option.value === variant)
      ?.label ?? variant;
  return `Replay ${label} signals across ${universe} from 09:15–15:00 IST (10s per 15m candle). First Start loads market data (~1–2 min); later candles advance quickly from cache.${liveNote}`;
}

export function DayScanSimulatorWidget({ isActive }: DayScanSimulatorWidgetProps) {
  const {
    analysisDate,
    setAnalysisDate,
    ruleVariant,
    setRuleVariant,
    entryPriceMinInput,
    entryPriceMaxInput,
    setEntryPriceMinInput,
    setEntryPriceMaxInput,
    entryPriceMin,
    entryPriceMax,
    filteredOutEntryCount,
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
    reloadLatest,
  } = useDayScanSimulationContext();

  const hasStarted = useMemo(
    () =>
      status === "playing" ||
      status === "paused" ||
      status === "complete" ||
      status === "loading" ||
      data != null,
    [status, data],
  );

  useDayScanLiveRefresh({
    date: analysisDate,
    hasStarted,
    loading,
    isActive,
    run: () => {
      reloadLatest();
    },
    intervalMs: DAY_SCAN_SIMULATOR_LIVE_REFRESH_MS,
  });

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
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor="dayscan-sim-entry-price-min"
            >
              Entry min ₹
              <input
                id="dayscan-sim-entry-price-min"
                type="number"
                min={0}
                step="0.01"
                value={entryPriceMinInput}
                disabled={busy}
                onChange={(event) => setEntryPriceMinInput(event.target.value)}
                className="w-28 rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor="dayscan-sim-entry-price-max"
            >
              Entry max ₹
              <input
                id="dayscan-sim-entry-price-max"
                type="number"
                min={0}
                step="0.01"
                value={entryPriceMaxInput}
                disabled={busy}
                onChange={(event) => setEntryPriceMaxInput(event.target.value)}
                className="w-28 rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
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
          <p className="m-0 mt-1 text-[11px] text-kite-muted">
            Only entries with price in ₹{entryPriceMin}–₹{entryPriceMax} are shown and
            passed to Day Order Simulator
            {filteredOutEntryCount > 0
              ? ` · ${filteredOutEntryCount} entry signal(s) outside range hidden`
              : ""}
            .
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
