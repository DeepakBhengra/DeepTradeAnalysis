import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchCachedPostMortemReport,
  fetchCachedPostMortemSignalDays,
  fetchDashboard,
  fetchDeepak2Backtest,
  fetchDeepakBacktest,
  fetchDeepproBacktest,
  fetchRulePnbBacktest,
  savePostMortemReport,
  savePostMortemSignalDays,
} from "../api/client";
import { DateRangePicker } from "../components/DateRangePicker";
import { DeepakPostMortemReportView } from "../components/DeepakPostMortemReport";
import { StockSymbolInput } from "../components/StockSymbolInput";
import type { DashboardSeriesPoint } from "../types/dashboard";
import type { DeepakPostMortemReport, PostMortemVariant } from "../types/postMortem";
import { buildDeepakPostMortemReport } from "../utils/buildDeepakPostMortemReport";
import { readLocalStorage, writeLocalStorage } from "../utils/safeStorage";
import {
  signalDaysFromTrades,
  type SignalDayOption,
} from "../utils/signalDaysFromTrades";

const DEFAULT_SYMBOL = "POLICYBZR";
const DEFAULT_FROM_DATE = "2026-05-01";
const DEFAULT_TO_DATE = "2026-07-20";
const SYMBOL_STORAGE_KEY = "deepak-postmortem-symbol";
const VARIANT_STORAGE_KEY = "deepak-postmortem-variant";

function readStoredSymbol(): string {
  const stored = readLocalStorage(SYMBOL_STORAGE_KEY)?.trim().toUpperCase();
  return stored || DEFAULT_SYMBOL;
}

const VARIANT_LABEL: Record<PostMortemVariant, string> = {
  deepak: "Deepak",
  deepak2: "Deepak-2",
  deeppro: "Deeppro",
  rulePnb: "RulePNB",
};

function readStoredVariant(): PostMortemVariant {
  const stored = readLocalStorage(VARIANT_STORAGE_KEY);
  if (stored === "deepak2" || stored === "deeppro" || stored === "rulePnb") {
    return stored;
  }
  return "deepak";
}

interface LoadedReport {
  symbol: string;
  mode: string;
  report: DeepakPostMortemReport;
  series: DashboardSeriesPoint[];
  source: "cache" | "computed";
  savedAt?: string;
}

interface DeepakPostMortemWidgetProps {
  isActive: boolean;
  refreshTrigger?: number;
}

export function DeepakPostMortemWidget({
  isActive,
  refreshTrigger = 0,
}: DeepakPostMortemWidgetProps) {
  const [symbolInput, setSymbolInput] = useState(readStoredSymbol);
  const [activeSymbol, setActiveSymbol] = useState(readStoredSymbol);
  const [fromDate, setFromDate] = useState(DEFAULT_FROM_DATE);
  const [toDate, setToDate] = useState(DEFAULT_TO_DATE);
  const [variant, setVariant] = useState<PostMortemVariant>(readStoredVariant);

  const [signalDays, setSignalDays] = useState<SignalDayOption[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const hasScannedRef = useRef(false);

  const [loaded, setLoaded] = useState<LoadedReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportNonce, setReportNonce] = useState(0);
  const reportRequestIdRef = useRef(0);
  const forceReportRef = useRef(false);

  const clearResults = () => {
    setSignalDays([]);
    setSelectedDate(null);
    setLoaded(null);
    setScanInfo(null);
    setScanError(null);
    setReportError(null);
    hasScannedRef.current = false;
  };

  const handleLoadSymbol = () => {
    const normalized = symbolInput.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    setActiveSymbol(normalized);
    writeLocalStorage(SYMBOL_STORAGE_KEY, normalized);
    clearResults();
  };

  const handleVariantChange = (next: PostMortemVariant) => {
    setVariant(next);
    writeLocalStorage(VARIANT_STORAGE_KEY, next);
    clearResults();
    setScanInfo("Variant changed — scan the date range again.");
  };

  const runRangeScan = useCallback(
    async (force = false) => {
      const normalized = activeSymbol.trim().toUpperCase();
      if (!normalized) {
        setScanError("Enter a valid symbol and click Load.");
        return;
      }
      if (!fromDate || !toDate) {
        setScanError("Select both from and to dates.");
        return;
      }
      if (fromDate > toDate) {
        setScanError("From date must be on or before to date.");
        return;
      }

      try {
        setScanLoading(true);
        setScanError(null);
        setScanInfo(null);
        setLoaded(null);

        if (!force) {
          const cached = await fetchCachedPostMortemSignalDays(
            normalized,
            fromDate,
            toDate,
            variant,
          );
          if (cached) {
            setSignalDays(cached.days);
            hasScannedRef.current = true;
            if (cached.days.length === 0) {
              setSelectedDate(null);
              setScanInfo(
                `Cached: no ${VARIANT_LABEL[variant]} signals for ${normalized} (${fromDate} → ${toDate}). Saved ${cached.savedAt}.`,
              );
            } else {
              setSelectedDate((prev) =>
                prev && cached.days.some((d) => d.date === prev)
                  ? prev
                  : cached.days[0].date,
              );
              setScanInfo(
                `Loaded from cache · ${cached.days.length} signal day(s) · ${cached.totalSignals} signal(s) · saved ${cached.savedAt}.`,
              );
            }
            return;
          }
        }

        const payload =
          variant === "deepak2"
            ? await fetchDeepak2Backtest(normalized, fromDate, toDate)
            : variant === "deeppro"
              ? await fetchDeepproBacktest(normalized, fromDate, toDate)
              : variant === "rulePnb"
                ? await fetchRulePnbBacktest(normalized, fromDate, toDate)
              : await fetchDeepakBacktest(normalized, fromDate, toDate);

        const days = signalDaysFromTrades(payload.trades);
        setSignalDays(days);
        hasScannedRef.current = true;

        try {
          await savePostMortemSignalDays({
            symbol: normalized,
            fromDate,
            toDate,
            variant,
            days,
            tradingDaysScanned: payload.summary.tradingDaysScanned,
            totalSignals: payload.summary.totalSignals,
          });
        } catch {
          // Non-fatal: report still usable without cache write
        }

        if (days.length === 0) {
          setSelectedDate(null);
          setScanInfo(
            `No ${VARIANT_LABEL[variant]} signals for ${normalized} between ${fromDate} and ${toDate}.`,
          );
        } else {
          setSelectedDate((prev) =>
            prev && days.some((d) => d.date === prev) ? prev : days[0].date,
          );
          setScanInfo(
            `Computed and saved · ${days.length} signal day(s) · ${payload.summary.totalSignals} signal(s) · scanned ${payload.summary.tradingDaysScanned} trading day(s).`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setScanError(message);
        setSignalDays([]);
        setSelectedDate(null);
        setScanInfo(null);
      } finally {
        setScanLoading(false);
      }
    },
    [activeSymbol, fromDate, toDate, variant],
  );

  useEffect(() => {
    if (refreshTrigger > 0 && isActive && hasScannedRef.current) {
      void runRangeScan(true);
    }
  }, [refreshTrigger, isActive, runRangeScan]);

  useEffect(() => {
    if (!selectedDate) {
      setLoaded(null);
      setReportError(null);
      setReportLoading(false);
      return;
    }

    const requestId = ++reportRequestIdRef.current;
    const force = forceReportRef.current;
    forceReportRef.current = false;
    let cancelled = false;

    const loadReport = async () => {
      setReportLoading(true);
      setReportError(null);
      try {
        if (!force) {
          const cached = await fetchCachedPostMortemReport(
            activeSymbol,
            selectedDate,
            variant,
          );
          if (cancelled || requestId !== reportRequestIdRef.current) {
            return;
          }
          if (cached) {
            setLoaded({
              symbol: cached.symbol,
              mode: cached.mode,
              report: cached.report,
              series: cached.series,
              source: "cache",
              savedAt: cached.savedAt,
            });
            return;
          }
        }

        const payload = await fetchDashboard(activeSymbol, selectedDate);
        if (cancelled || requestId !== reportRequestIdRef.current) {
          return;
        }
        if (payload.analysisDate !== selectedDate) {
          setLoaded(null);
          setReportError(
            `Dashboard date mismatch: expected ${selectedDate}, received ${payload.analysisDate ?? "live"}.`,
          );
          return;
        }

        const decision =
          variant === "deepak2"
            ? payload.deepak2Decision
            : variant === "deeppro"
              ? payload.deepproDecision
              : variant === "rulePnb"
                ? payload.rulePnbDecision
              : payload.deepakDecision;
        const graded = buildDeepakPostMortemReport(decision, payload.series, variant);
        if (!graded) {
          setLoaded(null);
          setReportError(
            `No ${VARIANT_LABEL[variant]} decision for ${activeSymbol} on ${selectedDate}.`,
          );
          return;
        }

        let savedAt: string | undefined;
        try {
          const saved = await savePostMortemReport({
            symbol: payload.symbol,
            date: selectedDate,
            variant,
            mode: payload.mode,
            report: graded,
            series: payload.series,
          });
          savedAt = saved.savedAt;
        } catch {
          // Non-fatal
        }

        if (cancelled || requestId !== reportRequestIdRef.current) {
          return;
        }
        setLoaded({
          symbol: payload.symbol,
          mode: payload.mode,
          report: graded,
          series: payload.series,
          source: "computed",
          savedAt,
        });
      } catch (err) {
        if (cancelled || requestId !== reportRequestIdRef.current) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setReportError(message);
        setLoaded(null);
      } finally {
        if (!cancelled && requestId === reportRequestIdRef.current) {
          setReportLoading(false);
        }
      }
    };

    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [activeSymbol, selectedDate, variant, reportNonce]);

  const selectedDayMeta = signalDays.find((d) => d.date === selectedDate) ?? null;
  const busy = scanLoading || reportLoading;

  return (
    <div hidden={!isActive}>
      <StockSymbolInput
        value={symbolInput}
        onChange={setSymbolInput}
        onLoad={handleLoadSymbol}
        loading={busy}
      />

      <DateRangePicker
        fromDate={fromDate}
        toDate={toDate}
        onFromChange={(date) => {
          setFromDate(date);
          clearResults();
        }}
        onToChange={(date) => {
          setToDate(date);
          clearResults();
        }}
        onRun={() => void runRangeScan(false)}
        loading={scanLoading}
        runDisabled={activeSymbol.trim().length === 0}
        runLabel="Scan signal days"
        loadingLabel="Scanning..."
        idPrefix="postmortem"
        description="Scan BUY/SELL days for the selected rule variant (max 90 calendar days). Results are stored on the server; later scans reuse cache unless you Refresh."
      />

      <section className="flex flex-wrap items-end justify-between gap-3 border-b border-kite-border bg-kite-surface px-3 py-2">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              className="mb-0.5 block text-[10px] uppercase tracking-wide text-kite-muted"
              htmlFor="postmortem-variant"
            >
              Rule variant
            </label>
            <select
              id="postmortem-variant"
              value={variant}
              onChange={(event) =>
                handleVariantChange(event.target.value as PostMortemVariant)
              }
              disabled={busy}
              className="rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="deepak">Deepak</option>
              <option value="deepak2">Deepak-2</option>
              <option value="deeppro">Deeppro</option>
              <option value="rulePnb">RulePNB</option>
            </select>
          </div>

          <div>
            <label
              className="mb-0.5 block text-[10px] uppercase tracking-wide text-kite-muted"
              htmlFor="postmortem-signal-date"
            >
              Signal date
            </label>
            <select
              id="postmortem-signal-date"
              value={selectedDate ?? ""}
              onChange={(event) => setSelectedDate(event.target.value || null)}
              disabled={signalDays.length === 0 || scanLoading}
              className="min-w-[220px] rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signalDays.length === 0 ? (
                <option value="">Scan range to list signal days</option>
              ) : (
                signalDays.map((day) => (
                  <option key={day.date} value={day.date}>
                    {day.date} · {day.signalCount} signal
                    {day.signalCount === 1 ? "" : "s"} · {day.buyCount}B/{day.sellCount}S
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              void (async () => {
                forceReportRef.current = true;
                await runRangeScan(true);
                setReportNonce((value) => value + 1);
              })();
            }}
            disabled={busy || !hasScannedRef.current}
            className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs text-kite-text hover:border-kite-orange disabled:cursor-not-allowed disabled:opacity-60"
            title="Recompute and overwrite cached signal days and the open report"
          >
            {busy ? "Working..." : "Refresh (recompute)"}
          </button>
        </div>

        {selectedDayMeta && (
          <p className="m-0 text-[10px] text-kite-muted">
            Viewing {selectedDayMeta.date} · {selectedDayMeta.signalCount} signal
            {selectedDayMeta.signalCount === 1 ? "" : "s"}
          </p>
        )}
      </section>

      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
        {scanInfo && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            {scanInfo}
          </section>
        )}

        {scanError && (
          <section className="border border-kite-red/30 bg-kite-surface p-3 text-xs text-kite-red">
            {scanError}
          </section>
        )}

        {reportError && (
          <section className="border border-kite-red/30 bg-kite-surface p-3 text-xs text-kite-red">
            {reportError}
          </section>
        )}

        {scanLoading && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            Scanning {activeSymbol} for {VARIANT_LABEL[variant]} signal days…
          </section>
        )}

        {!scanLoading && reportLoading && selectedDate && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            Loading post-mortem for {activeSymbol} on {selectedDate}…
          </section>
        )}

        {!scanLoading && !reportLoading && !scanError && !reportError && !selectedDate && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            Load a symbol, pick a date range, then click <strong>Scan signal days</strong>. Reports
            are saved under <code>data/post-mortem/</code> and reused next time.
          </section>
        )}

        {loaded && (
          <>
            <section
              className={`border p-3 text-xs ${
                loaded.source === "cache"
                  ? "border-sky-500/40 bg-kite-surface text-kite-muted"
                  : "border-kite-border bg-kite-surface text-kite-muted"
              }`}
            >
              {loaded.source === "cache"
                ? `Report loaded from cache${loaded.savedAt ? ` · saved ${loaded.savedAt}` : ""}.`
                : `Report computed and saved${loaded.savedAt ? ` · ${loaded.savedAt}` : ""}.`}
            </section>
            <DeepakPostMortemReportView
              symbol={loaded.symbol}
              mode={loaded.mode}
              report={loaded.report}
              series={loaded.series}
            />
          </>
        )}
      </main>
    </div>
  );
}
