import {
  DEEPPRO1_PROFIT_PCT_OPTIONS,
  normalizeProfitPct,
} from "../utils/profitPct";

interface Deeppro1ProfitPctSelectProps {
  value: number;
  onChange: (profitPct: number) => void;
  disabled?: boolean;
  id?: string;
  /** Compact label for dense control rows. */
  label?: string;
}

/**
 * Shared Deeppro1 profit-target % select (Samco-persisted setting).
 * Used by Day Scan, Day Scan Simulator, Day Order Simulator, and Samco Trading.
 */
export function Deeppro1ProfitPctSelect({
  value,
  onChange,
  disabled = false,
  id = "deeppro1-profit-pct",
  label = "Profit % (Deeppro1)",
}: Deeppro1ProfitPctSelectProps) {
  const normalized = normalizeProfitPct(value);
  const options = DEEPPRO1_PROFIT_PCT_OPTIONS.includes(
    normalized as (typeof DEEPPRO1_PROFIT_PCT_OPTIONS)[number],
  )
    ? DEEPPRO1_PROFIT_PCT_OPTIONS
    : ([...DEEPPRO1_PROFIT_PCT_OPTIONS, normalized] as number[]);

  return (
    <label className="flex flex-col gap-1 text-xs text-kite-muted" htmlFor={id}>
      {label}
      <select
        id={id}
        value={String(normalized)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-[110px] rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option} value={String(option)}>
            {Number.isInteger(option) ? `${option}%` : `${option}%`}
          </option>
        ))}
      </select>
    </label>
  );
}
