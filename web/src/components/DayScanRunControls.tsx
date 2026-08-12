import type { ReactNode } from "react";

import type { DayScanRuleVariant } from "../hooks/useVariantDayScan";
import { DAY_SCAN_RULE_VARIANT_OPTIONS } from "../hooks/useVariantDayScan";

interface DayScanRunControlsProps {
  date: string;
  onDateChange: (date: string) => void;
  loading: boolean;
  onRun: () => void;
  onStop: () => void;
  description: ReactNode;
  ruleVariant?: DayScanRuleVariant;
  onRuleVariantChange?: (variant: DayScanRuleVariant) => void;
  entryPriceMin?: string;
  entryPriceMax?: string;
  onEntryPriceMinChange?: (value: string) => void;
  onEntryPriceMaxChange?: (value: string) => void;
  /** Prefix for input ids when multiple day-scan control blocks are mounted. */
  idPrefix?: string;
}

export function DayScanRunControls({
  date,
  onDateChange,
  loading,
  onRun,
  onStop,
  description,
  ruleVariant,
  onRuleVariantChange,
  entryPriceMin,
  entryPriceMax,
  onEntryPriceMinChange,
  onEntryPriceMaxChange,
  idPrefix = "dayscan",
}: DayScanRunControlsProps) {
  const dateId = `${idPrefix}-session-date`;
  const variantId = `${idPrefix}-rule-variant`;
  const minPriceId = `${idPrefix}-entry-price-min`;
  const maxPriceId = `${idPrefix}-entry-price-max`;
  const showPriceRange =
    entryPriceMin != null &&
    entryPriceMax != null &&
    onEntryPriceMinChange != null &&
    onEntryPriceMaxChange != null;

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-kite-muted" htmlFor={dateId}>
          Session date
          <input
            id={dateId}
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            disabled={loading}
            className="rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-sm text-kite-text disabled:opacity-50"
          />
        </label>
        {ruleVariant != null && onRuleVariantChange != null && (
          <label className="flex flex-col gap-1 text-xs text-kite-muted" htmlFor={variantId}>
            Rule variant
            <select
              id={variantId}
              value={ruleVariant}
              onChange={(event) =>
                onRuleVariantChange(event.target.value as DayScanRuleVariant)
              }
              disabled={loading}
              className="rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-sm text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {DAY_SCAN_RULE_VARIANT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {showPriceRange && (
          <>
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor={minPriceId}
            >
              Entry min ₹
              <input
                id={minPriceId}
                type="number"
                min={0}
                step="0.01"
                value={entryPriceMin}
                onChange={(event) => onEntryPriceMinChange(event.target.value)}
                disabled={loading}
                className="w-28 rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-sm text-kite-text disabled:opacity-50"
              />
            </label>
            <label
              className="flex flex-col gap-1 text-xs text-kite-muted"
              htmlFor={maxPriceId}
            >
              Entry max ₹
              <input
                id={maxPriceId}
                type="number"
                min={0}
                step="0.01"
                value={entryPriceMax}
                onChange={(event) => onEntryPriceMaxChange(event.target.value)}
                disabled={loading}
                className="w-28 rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-sm text-kite-text disabled:opacity-50"
              />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={onRun}
          disabled={loading || date.length === 0}
          className="cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Scanning…" : "Run Scan"}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!loading}
          className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs font-medium text-kite-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop
        </button>
      </div>
      <p className="m-0 mt-2 text-xs text-kite-muted">{description}</p>
      {showPriceRange && (
        <p className="m-0 mt-1 text-[11px] text-kite-muted">
          Results and Samco push only include trades with entry price in ₹{entryPriceMin}–
          ₹{entryPriceMax}.
        </p>
      )}
    </section>
  );
}
