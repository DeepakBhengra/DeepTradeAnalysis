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
}: DayScanRunControlsProps) {
  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-kite-muted">
          Session date
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            disabled={loading}
            className="rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-sm text-kite-text disabled:opacity-50"
          />
        </label>
        {ruleVariant != null && onRuleVariantChange != null && (
          <label className="flex flex-col gap-1 text-xs text-kite-muted" htmlFor="dayscan-rule-variant">
            Rule variant
            <select
              id="dayscan-rule-variant"
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
    </section>
  );
}
