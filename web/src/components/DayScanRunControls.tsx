import type { ReactNode } from "react";

interface DayScanRunControlsProps {
  date: string;
  onDateChange: (date: string) => void;
  loading: boolean;
  onRun: () => void;
  onStop: () => void;
  description: ReactNode;
}

export function DayScanRunControls({
  date,
  onDateChange,
  loading,
  onRun,
  onStop,
  description,
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
