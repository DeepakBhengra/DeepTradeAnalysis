interface AnalysisDatePickerProps {
  analysisDate: string | null;
  onChange: (date: string | null) => void;
  showTodayButton?: boolean;
}

export function AnalysisDatePicker({
  analysisDate,
  onChange,
  showTodayButton = true,
}: AnalysisDatePickerProps) {
  return (
    <div className="text-right">
      <label
        className="mb-0.5 block text-[10px] uppercase tracking-wide text-kite-muted"
        htmlFor="analysis-date"
      >
        Analysis Date
      </label>
      <div className="flex items-center justify-end gap-1.5">
        <input
          id="analysis-date"
          type="date"
          className="rounded-sm border border-kite-border bg-kite-surface px-1.5 py-1 text-xs text-kite-text focus:border-kite-orange focus:outline-none focus:ring-1 focus:ring-kite-orange"
          value={analysisDate ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onChange(value || null);
          }}
        />
        {showTodayButton && (
          <button
            type="button"
            className="cursor-pointer rounded-sm border border-kite-border bg-kite-surface px-2 py-1 text-xs text-kite-text hover:bg-kite-surface"
            onClick={() => onChange(null)}
          >
            Today
          </button>
        )}
      </div>
      <p className="mt-0.5 mb-0 text-[10px] text-kite-muted">
        {showTodayButton
          ? analysisDate
            ? `Historical mode · ${analysisDate}`
            : "Live mode · latest session"
          : analysisDate
            ? `Replay date · ${analysisDate}`
            : "Select a replay date"}
      </p>
    </div>
  );
}
