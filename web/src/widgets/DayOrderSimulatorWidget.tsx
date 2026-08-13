import { useState } from "react";

import { AnalysisDatePicker } from "../components/AnalysisDatePicker";
import { DayOrderPortfolioPanel } from "../components/DayOrderPortfolioPanel";
import { useDayScanSimulationContext } from "../context/DayScanSimulationContext";
import { useDayOrderSimulation } from "../hooks/useDayOrderSimulation";
import {
  DEFAULT_DAY_ORDER_RUN_SETTINGS,
  MAX_ENTRY_PRICE,
  MIN_ENTRY_PRICE,
  ORDER_QUANTITY,
} from "../types/dayOrder";
import {
  DAY_SCAN_SIMULATION_VARIANT_OPTIONS,
  type DayScanSimulationVariant,
} from "../utils/dayScanSimulationVariant";
import {
  formatDayOrderRunSettings,
  parseDayOrderRunSettingsInput,
} from "../utils/dayOrderRunSettings";

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

function formatInr(value: number): string {
  return value.toLocaleString("en-IN");
}

export function DayOrderSimulatorWidget({ isActive }: DayOrderSimulatorWidgetProps) {
  const {
    analysisDate: scanDate,
    status: scanStatus,
    simulatedTimeIst,
    sessionIndex,
    sessionCandleCount,
    ruleVariant,
    setRuleVariant,
    ruleVariantLabel,
  } = useDayScanSimulationContext();

  const {
    orderDate,
    setOrderDate,
    status,
    portfolio,
    pnl,
    marks,
    canStart,
    startBlockedReason,
    dateMismatch,
    catchingUp,
    runSettings,
    setRunSettings,
    settingsError,
    start,
    stop,
    closePosition,
  } = useDayOrderSimulation();

  const [quantityText, setQuantityText] = useState(
    () => formatDayOrderRunSettings(DEFAULT_DAY_ORDER_RUN_SETTINGS).quantityText,
  );
  const [minEntryPriceText, setMinEntryPriceText] = useState(
    () => formatDayOrderRunSettings(DEFAULT_DAY_ORDER_RUN_SETTINGS).minEntryPriceText,
  );
  const [maxEntryPriceText, setMaxEntryPriceText] = useState(
    () => formatDayOrderRunSettings(DEFAULT_DAY_ORDER_RUN_SETTINGS).maxEntryPriceText,
  );
  const [stopLossPctText, setStopLossPctText] = useState(
    () => formatDayOrderRunSettings(DEFAULT_DAY_ORDER_RUN_SETTINGS).stopLossPctText,
  );

  const isRunning = status === "running" || catchingUp;
  const scanBusy = scanStatus === "playing" || scanStatus === "loading";
  const inputsDisabled = isRunning;

  const applyDraftSettings = (next: {
    quantityText: string;
    minEntryPriceText: string;
    maxEntryPriceText: string;
    stopLossPctText: string;
  }) => {
    setRunSettings(parseDayOrderRunSettingsInput(next));
  };

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
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor="dayorder-sim-rule-variant"
            >
              Rule variant
              <select
                id="dayorder-sim-rule-variant"
                value={ruleVariant}
                disabled={isRunning || scanBusy}
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

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor="dayorder-sim-min-price"
            >
              Min entry price (₹)
              <input
                id="dayorder-sim-min-price"
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                disabled={inputsDisabled}
                value={minEntryPriceText}
                onChange={(event) => {
                  const value = event.target.value;
                  setMinEntryPriceText(value);
                  applyDraftSettings({
                    quantityText,
                    minEntryPriceText: value,
                    maxEntryPriceText,
                    stopLossPctText,
                  });
                }}
                className="w-28 rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor="dayorder-sim-max-price"
            >
              Max entry price (₹)
              <input
                id="dayorder-sim-max-price"
                type="number"
                min={0}
                step={1}
                inputMode="decimal"
                disabled={inputsDisabled}
                value={maxEntryPriceText}
                onChange={(event) => {
                  const value = event.target.value;
                  setMaxEntryPriceText(value);
                  applyDraftSettings({
                    quantityText,
                    minEntryPriceText,
                    maxEntryPriceText: value,
                    stopLossPctText,
                  });
                }}
                className="w-28 rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor="dayorder-sim-quantity"
            >
              Quantity (date run)
              <input
                id="dayorder-sim-quantity"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                disabled={inputsDisabled}
                value={quantityText}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuantityText(value);
                  applyDraftSettings({
                    quantityText: value,
                    minEntryPriceText,
                    maxEntryPriceText,
                    stopLossPctText,
                  });
                }}
                className="w-28 rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor="dayorder-sim-stop-loss"
            >
              Stop-loss % (blank/0 = off)
              <input
                id="dayorder-sim-stop-loss"
                type="number"
                min={0}
                step={0.1}
                inputMode="decimal"
                disabled={inputsDisabled}
                value={stopLossPctText}
                placeholder="off"
                onChange={(event) => {
                  const value = event.target.value;
                  setStopLossPctText(value);
                  applyDraftSettings({
                    quantityText,
                    minEntryPriceText,
                    maxEntryPriceText,
                    stopLossPctText: value,
                  });
                }}
                className="w-36 rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-1 text-xs text-kite-muted sm:grid-cols-2 lg:grid-cols-4">
            <p className="m-0">
              Order status:{" "}
              <span className="text-kite-text">
                {catchingUp
                  ? "Catching up…"
                  : status === "running"
                    ? "Running"
                    : status === "complete"
                      ? "Complete"
                      : "Idle"}
              </span>
            </p>
            <p className="m-0">
              Rule: <span className="text-kite-text">{ruleVariantLabel}</span>
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
            <p className="m-0">
              Qty / price range:{" "}
              <span className="text-kite-text">
                {Number.isFinite(runSettings.quantity) ? runSettings.quantity : "—"} qty · ₹
                {Number.isFinite(runSettings.minEntryPrice)
                  ? formatInr(runSettings.minEntryPrice)
                  : "—"}
                –₹
                {Number.isFinite(runSettings.maxEntryPrice)
                  ? formatInr(runSettings.maxEntryPrice)
                  : "—"}
              </span>
            </p>
          </div>

          {dateMismatch && (
            <p className="m-0 mt-2 text-xs text-kite-red">
              Order date ({orderDate}) does not match Day Scan Simulator date ({scanDate}).
            </p>
          )}

          {!isRunning && settingsError && (
            <p className="m-0 mt-2 text-xs text-kite-red">{settingsError}</p>
          )}

          {!isRunning && startBlockedReason && !dateMismatch && !settingsError && (
            <p className="m-0 mt-2 text-xs text-kite-muted">{startBlockedReason}</p>
          )}

          {catchingUp && (
            <p className="m-0 mt-2 text-xs text-kite-muted">
              Replaying Day Scan candles from 09:15 through the current time so morning entries and
              square-offs are included…
            </p>
          )}

          <p className="m-0 mt-2 text-xs text-kite-muted">
            Auto paper-trades Day Scan entry/exit signals for the selected rule variant with
            ₹1,00,00,000 capital. Set quantity, entry price range, and optional stop-loss % for this
            date run before Start (locked while running). When stop-loss % is set, open positions
            that lose that much vs entry exit at the candle mid (no reverse entry). Blank or 0 =
            no stop-loss. Defaults: {ORDER_QUANTITY} qty, ₹{formatInr(MIN_ENTRY_PRICE)}–₹
            {formatInr(MAX_ENTRY_PRICE)}. Starts automatically when Day Scan Simulator starts and
            catches up from 09:15. Order history is a column table of every fill (scroll for
            morning 09:15 square-offs).
          </p>
        </section>

        <DayOrderPortfolioPanel
          portfolio={portfolio}
          pnl={pnl}
          date={orderDate}
          marks={marks}
          onExitPosition={closePosition}
        />
      </main>
    </div>
  );
}
