import { useState } from "react";
import { AnalysisDatePicker } from "../components/AnalysisDatePicker";
import { useSamcoTrading } from "../hooks/useSamcoTrading";

interface SamcoTradingWidgetProps {
  isActive: boolean;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function levelClass(level: string): string {
  switch (level) {
    case "error":
      return "text-kite-red";
    case "warn":
      return "text-kite-orange";
    default:
      return "text-kite-text";
  }
}

export function SamcoTradingWidget({ isActive }: SamcoTradingWidgetProps) {
  const {
    status,
    settings,
    ledger,
    logs,
    logDate,
    setLogDate,
    quantityInput,
    setQuantityInput,
    minPriceInput,
    setMinPriceInput,
    maxPriceInput,
    setMaxPriceInput,
    loading,
    error,
    actionError,
    modeLabel,
    refresh,
    setDryRun,
    setLiveTrading,
    applyDayQuantity,
    applyEntryPriceRange,
    applyTradingParams,
    refreshSession,
    downloadLogs,
  } = useSamcoTrading(isActive);

  const [pendingLiveEnable, setPendingLiveEnable] = useState(false);

  const handleDryRunToggle = async () => {
    if (!settings) {
      return;
    }

    const next = !settings.dryRun;
    if (!next && settings.liveTradingEnabled) {
      const confirmed = window.confirm(
        "Disable dry-run while live trading is enabled? Real MIS orders will be placed.",
      );
      if (!confirmed) {
        return;
      }
      await setDryRun(false, true);
      return;
    }

    await setDryRun(next);
  };

  const handleLiveToggle = async () => {
    if (!settings) {
      return;
    }

    const next = !settings.liveTradingEnabled;
    if (next && !settings.dryRun) {
      setPendingLiveEnable(true);
      return;
    }

    await setLiveTrading(next);
  };

  const confirmLiveEnable = async () => {
    await setLiveTrading(true, true);
    setPendingLiveEnable(false);
  };

  const openEntries =
    ledger?.entries.filter(
      (entry) => entry.status === "open" || entry.status === "closing",
    ) ?? [];

  return (
    <div hidden={!isActive}>
      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
        <section className="border border-kite-border bg-kite-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-sm font-semibold text-kite-text">Samco Trading</h2>
              <p className="mt-1 text-xs text-kite-muted">
                MIS execution for Deepak + Deepak-2 day scan signals across 50
                sector stocks (configurable entry price range; EOD 15:01–15:15 IST).
              </p>
            </div>
            <span
              className={`rounded-sm border px-2 py-1 text-[10px] font-semibold tracking-wide ${
                modeLabel === "LIVE"
                  ? "border-kite-red text-kite-red"
                  : "border-kite-orange text-kite-orange"
              }`}
            >
              {modeLabel}
            </span>
          </div>

          <div className="mt-3 grid gap-1 text-xs text-kite-muted sm:grid-cols-2 lg:grid-cols-4">
            <p className="m-0">
              Session:{" "}
              <span className="text-kite-text">
                {loading ? "..." : status?.connected ? "Connected" : "Not connected"}
              </span>
            </p>
            <p className="m-0">
              IP: <span className="text-kite-text">{status?.srcIp ?? "—"}</span>
            </p>
            <p className="m-0">
              Open positions:{" "}
              <span className="text-kite-text">{status?.openPositionsCount ?? 0}</span>
            </p>
            <p className="m-0">
              Watchlist:{" "}
              <span className="text-kite-text">50 sector stocks</span>
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshSession()}
              className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs font-medium text-kite-text hover:bg-kite-surface"
            >
              Refresh session
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs font-medium text-kite-text hover:bg-kite-surface"
            >
              Refresh data
            </button>
          </div>

          {error && (
            <p className="mt-3 text-xs text-kite-red">{error}</p>
          )}
          {actionError && (
            <p className="mt-3 text-xs text-kite-red">{actionError}</p>
          )}
        </section>

        <section className="border border-kite-border bg-kite-surface p-3">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
            Controls
          </h3>

          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="flex items-center gap-2 text-xs text-kite-text">
              <input
                type="checkbox"
                checked={settings?.dryRun ?? true}
                onChange={() => void handleDryRunToggle()}
                disabled={loading || !settings}
                className="h-4 w-4 accent-kite-orange"
              />
              Dry run
            </label>

            <label className="flex items-center gap-2 text-xs text-kite-text">
              <input
                type="checkbox"
                checked={settings?.liveTradingEnabled ?? false}
                onChange={() => void handleLiveToggle()}
                disabled={loading || !settings}
                className="h-4 w-4 accent-kite-orange"
              />
              Live trading
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-kite-muted">
                Min entry (₹)
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={minPriceInput}
                  onChange={(event) => setMinPriceInput(event.target.value)}
                  className="w-24 rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-xs text-kite-text"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-kite-muted">
                Max entry (₹)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={maxPriceInput}
                  onChange={(event) => setMaxPriceInput(event.target.value)}
                  className="w-24 rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-xs text-kite-text"
                />
              </label>
              <button
                type="button"
                onClick={() => void applyEntryPriceRange()}
                disabled={loading}
                className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs font-medium text-kite-text hover:bg-kite-surface disabled:opacity-50"
              >
                Apply range
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-kite-muted">
                Quantity (today)
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={quantityInput}
                  onChange={(event) => setQuantityInput(event.target.value)}
                  className="w-24 rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-xs text-kite-text"
                />
              </label>
              <button
                type="button"
                onClick={() => void applyDayQuantity()}
                disabled={loading}
                className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs font-medium text-kite-text hover:bg-kite-surface disabled:opacity-50"
              >
                Apply qty
              </button>
              <button
                type="button"
                onClick={() => void applyTradingParams()}
                disabled={loading}
                className="cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Apply all
              </button>
            </div>
          </div>

          <p className="mt-2 text-[10px] text-kite-muted">
            Settings date: {settings?.dateKey ?? "—"} · Saved entry range: ₹
            {settings?.entryPriceMin ?? "—"}–₹{settings?.entryPriceMax ?? "—"} ·
            Saved qty: {settings?.effectiveQuantity ?? "—"} · Env defaults: ₹
            {settings?.envDefaultEntryPriceMin ?? "—"}–₹
            {settings?.envDefaultEntryPriceMax ?? "—"}, qty{" "}
            {settings?.envDefaultQuantity ?? "—"} · Click Apply to save edits
          </p>
        </section>

        {pendingLiveEnable && (
          <section className="border border-kite-red bg-kite-surface p-3">
            <p className="m-0 text-xs text-kite-text">
              Live trading with dry-run off will place real MIS orders on Samco.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void confirmLiveEnable()}
                className="cursor-pointer rounded-sm border border-kite-red bg-kite-red px-3 py-1.5 text-xs font-medium text-white"
              >
                Confirm live trading
              </button>
              <button
                type="button"
                onClick={() => setPendingLiveEnable(false)}
                className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs font-medium text-kite-text"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        <section className="border border-kite-border bg-kite-surface p-3">
          <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
            Position ledger
          </h3>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-kite-border text-kite-muted">
                  <th className="py-2 pr-3 font-medium">Symbol</th>
                  <th className="py-2 pr-3 font-medium">Signal</th>
                  <th className="py-2 pr-3 font-medium">Side</th>
                  <th className="py-2 pr-3 font-medium">Qty</th>
                  <th className="py-2 pr-3 font-medium">Entry</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {openEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-3 text-kite-muted">
                      No open ledger positions.
                    </td>
                  </tr>
                ) : (
                  openEntries.map((entry) => (
                    <tr key={entry.signalKey} className="border-b border-kite-border/60">
                      <td className="py-2 pr-3 text-kite-text">{entry.tradingSymbol}</td>
                      <td className="py-2 pr-3 text-kite-text">{entry.signalKey}</td>
                      <td className="py-2 pr-3 text-kite-text">{entry.side}</td>
                      <td className="py-2 pr-3 text-kite-text">{entry.quantity}</td>
                      <td className="py-2 pr-3 text-kite-text">
                        {entry.entryTimeIst} @ {entry.entryPrice ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-kite-text">{entry.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-kite-border bg-kite-surface p-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
              Trade logs
            </h3>
            <div className="flex flex-wrap items-end gap-2">
              <AnalysisDatePicker
                analysisDate={logDate}
                onChange={(date) => {
                  setLogDate(date ?? new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Kolkata",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date()));
                }}
                showTodayButton
              />
              <button
                type="button"
                onClick={() => void downloadLogs("csv")}
                className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs font-medium text-kite-text"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => void downloadLogs("json")}
                className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs font-medium text-kite-text"
              >
                Download JSON
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-80 overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-kite-surface">
                <tr className="border-b border-kite-border text-kite-muted">
                  <th className="py-2 pr-3 font-medium">Time (IST)</th>
                  <th className="py-2 pr-3 font-medium">Level</th>
                  <th className="py-2 pr-3 font-medium">Message</th>
                  <th className="py-2 pr-3 font-medium">Signal</th>
                  <th className="py-2 pr-3 font-medium">Dry run</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-kite-muted">
                      No logs for {logDate}.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-kite-border/60">
                      <td className="py-2 pr-3 text-kite-text">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className={`py-2 pr-3 ${levelClass(log.level)}`}>{log.level}</td>
                      <td className="py-2 pr-3 text-kite-text">{log.message}</td>
                      <td className="py-2 pr-3 text-kite-muted">{log.signalKey ?? "—"}</td>
                      <td className="py-2 pr-3 text-kite-text">
                        {log.dryRun ? "yes" : "no"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
