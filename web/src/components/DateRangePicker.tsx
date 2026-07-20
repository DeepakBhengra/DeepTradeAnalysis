interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  onRun: () => void;
  loading: boolean;
  runDisabled?: boolean;
  /** Button label. Default: "Run Backtest" */
  runLabel?: string;
  /** Loading button label. Default: "Running..." */
  loadingLabel?: string;
  /** Section description under the heading. */
  description?: string;
  /** Prefix for input ids when multiple pickers are mounted. */
  idPrefix?: string;
}

export function DateRangePicker({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  onRun,
  loading,
  runDisabled = false,
  runLabel = "Run Backtest",
  loadingLabel = "Running...",
  description = "Backtest Deepak BUY/SELL signals across trading days in this range (max 90 calendar days).",
  idPrefix = "backtest",
}: DateRangePickerProps) {
  const invalidRange = fromDate > toDate;
  const fromId = `${idPrefix}-from-date`;
  const toId = `${idPrefix}-to-date`;

  return (
    <section className="border-b border-kite-border bg-kite-surface px-3 py-2">
      <h2 className="m-0 mb-1.5 text-xs font-medium uppercase tracking-wide text-kite-muted">
        Date Range
      </h2>
      <p className="m-0 mb-2 text-xs text-kite-muted">{description}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            className="mb-0.5 block text-[10px] uppercase tracking-wide text-kite-muted"
            htmlFor={fromId}
          >
            From
          </label>
          <input
            id={fromId}
            type="date"
            className="rounded-sm border border-kite-border bg-kite-bg px-1.5 py-1 text-xs text-kite-text focus:border-kite-orange focus:outline-none focus:ring-1 focus:ring-kite-orange"
            value={fromDate}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </div>
        <div>
          <label
            className="mb-0.5 block text-[10px] uppercase tracking-wide text-kite-muted"
            htmlFor={toId}
          >
            To
          </label>
          <input
            id={toId}
            type="date"
            className="rounded-sm border border-kite-border bg-kite-bg px-1.5 py-1 text-xs text-kite-text focus:border-kite-orange focus:outline-none focus:ring-1 focus:ring-kite-orange"
            value={toDate}
            onChange={(event) => onToChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={loading || runDisabled || invalidRange || !fromDate || !toDate}
          className="cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? loadingLabel : runLabel}
        </button>
      </div>
      {invalidRange && (
        <p className="mt-2 mb-0 text-xs text-kite-red">
          From date must be on or before to date.
        </p>
      )}
    </section>
  );
}
