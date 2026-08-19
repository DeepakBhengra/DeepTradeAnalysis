import { useEffect, useMemo, useRef, useState } from "react";

import { fetchDashboard } from "../api/client";
import { DayScanProgressBanner } from "../components/DayScanProgressBanner";
import { DayScanRunControls } from "../components/DayScanRunControls";
import { DeepakPostMortemReportView } from "../components/DeepakPostMortemReport";
import { SectorBacktestResultsTable } from "../components/SectorBacktestResultsTable";
import { SECTOR_WATCHLIST_SIZE } from "../data/sectorWatchlist";
import {
  DAY_SCAN_RULE_VARIANT_LABEL,
  isDayScanRuleVariant,
  useVariantDayScan,
  type DayScanRuleVariant,
} from "../hooks/useVariantDayScan";
import type { DashboardSeriesPoint } from "../types/dashboard";
import type { DeepakDayScanTrade } from "../types/backtest";
import type { DeepakPostMortemReport } from "../types/postMortem";
import { buildDeepakPostMortemReport } from "../utils/buildDeepakPostMortemReport";
import {
  decisionForDayScanVariant,
  postMortemVariantForDayScan,
} from "../utils/dayScanPostMortemVariant";
import {
  FAVOURABLE_RULE_LABEL,
  FAVOURABLE_RULE_SYMBOL,
  isFavourableSymbolRuleVariant,
} from "../utils/favourableSymbolRule";
import { todayIstDateKey } from "../utils/istTime";
import { readLocalStorage, writeLocalStorage } from "../utils/safeStorage";

const VARIANT_STORAGE_KEY = "dayscan-postmortem-variant";

const CSV_PREFIX: Record<DayScanRuleVariant, string> = {
  deepak: "dayscan-postmortem-deepak",
  deepak2: "dayscan-postmortem-deepak-2",
  deepak3: "dayscan-postmortem-deepak-3",
  watchParty: "dayscan-postmortem-watch-party",
  deeppro: "dayscan-postmortem-deeppro",
  deeppro1: "dayscan-postmortem-deeppro1",
  rulePnb: "dayscan-postmortem-rule-pnb",
  ruleSunpharma: "dayscan-postmortem-rule-sunpharma",
  ruleLtm: "dayscan-postmortem-rule-ltm",
  ruleIcicigi: "dayscan-postmortem-rule-icicigi",
  ruleTechm: "dayscan-postmortem-rule-techm",
  ruleTvsmotor: "dayscan-postmortem-rule-tvsmotor",
  rulePolicybzr: "dayscan-postmortem-rule-policybzr",
};

interface SymbolOption {
  tradingSymbol: string;
  sector: string;
  signalCount: number;
  buyCount: number;
  sellCount: number;
}

interface LoadedReport {
  symbol: string;
  mode: string;
  report: DeepakPostMortemReport;
  series: DashboardSeriesPoint[];
}

function readStoredVariant(): DayScanRuleVariant {
  const stored = readLocalStorage(VARIANT_STORAGE_KEY);
  return isDayScanRuleVariant(stored) ? stored : "deeppro";
}

function descriptionForVariant(variant: DayScanRuleVariant): string {
  const label = DAY_SCAN_RULE_VARIANT_LABEL[variant];
  if (variant === "rulePnb") {
    return `Scan PNB only with ${label} for one session date, then open a path-graded post-mortem. RulePNB is separate from Deepak/Deeppro and does not apply to other stocks.`;
  }
  if (variant === "ruleSunpharma") {
    return `Scan SUNPHARMA only with ${label} for one session date, then open a path-graded post-mortem. RuleSUNPHARMA is separate from Deepak/Deeppro/RulePNB and does not apply to other stocks.`;
  }
  if (isFavourableSymbolRuleVariant(variant)) {
    const symbol = FAVOURABLE_RULE_SYMBOL[variant];
    const ruleLabel = FAVOURABLE_RULE_LABEL[variant];
    return `Scan ${symbol} only with ${ruleLabel} for one session date, then open a path-graded post-mortem. ${ruleLabel} is separate from Deepak/Deeppro and does not apply to other stocks.`;
  }
  return `Scan ${SECTOR_WATCHLIST_SIZE} liquid NSE stocks with ${label} for one session date, then open a path-graded post-mortem for any signal stock.`;
}

function symbolOptionsFromTrades(trades: DeepakDayScanTrade[]): SymbolOption[] {
  const bySymbol = new Map<string, SymbolOption>();
  for (const trade of trades) {
    const existing = bySymbol.get(trade.tradingSymbol);
    if (existing) {
      existing.signalCount += 1;
      if (trade.side === "BUY") {
        existing.buyCount += 1;
      } else {
        existing.sellCount += 1;
      }
      continue;
    }
    bySymbol.set(trade.tradingSymbol, {
      tradingSymbol: trade.tradingSymbol,
      sector: trade.sector,
      signalCount: 1,
      buyCount: trade.side === "BUY" ? 1 : 0,
      sellCount: trade.side === "SELL" ? 1 : 0,
    });
  }
  return [...bySymbol.values()].sort((left, right) =>
    left.tradingSymbol.localeCompare(right.tradingSymbol),
  );
}

interface DayScanPostMortemWidgetProps {
  isActive: boolean;
  refreshTrigger?: number;
}

export function DayScanPostMortemWidget({
  isActive,
  refreshTrigger = 0,
}: DayScanPostMortemWidgetProps) {
  const [date, setDate] = useState(todayIstDateKey);
  const [variant, setVariant] = useState<DayScanRuleVariant>(readStoredVariant);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportNonce, setReportNonce] = useState(0);

  const { data, loading, loadingElapsedSec, error, info, run, stop, reset } =
    useVariantDayScan(variant);
  const hasRunRef = useRef(false);
  const reportRequestIdRef = useRef(0);
  const variantLabel = DAY_SCAN_RULE_VARIANT_LABEL[variant];

  const symbolOptions = useMemo(
    () => (data ? symbolOptionsFromTrades(data.trades) : []),
    [data],
  );

  const handleDateChange = (next: string) => {
    setDate(next);
    setSelectedSymbol(null);
    setLoaded(null);
    setReportError(null);
    hasRunRef.current = false;
    reset();
  };

  const handleVariantChange = (next: DayScanRuleVariant) => {
    if (next === variant) {
      return;
    }
    setVariant(next);
    writeLocalStorage(VARIANT_STORAGE_KEY, next);
    setSelectedSymbol(null);
    setLoaded(null);
    setReportError(null);
    hasRunRef.current = false;
    reset();
  };

  const handleRun = () => {
    hasRunRef.current = true;
    setSelectedSymbol(null);
    setLoaded(null);
    setReportError(null);
    void run(date);
  };

  useEffect(() => {
    if (refreshTrigger > 0 && isActive && hasRunRef.current) {
      void run(date);
    }
  }, [refreshTrigger, isActive, run, date]);

  // Auto-select first signal symbol after a successful scan.
  useEffect(() => {
    if (!data || loading) {
      return;
    }
    if (symbolOptions.length === 0) {
      setSelectedSymbol(null);
      return;
    }
    setSelectedSymbol((prev) =>
      prev && symbolOptions.some((option) => option.tradingSymbol === prev)
        ? prev
        : symbolOptions[0].tradingSymbol,
    );
  }, [data, loading, symbolOptions]);

  useEffect(() => {
    if (!selectedSymbol || !data) {
      setLoaded(null);
      setReportError(null);
      setReportLoading(false);
      return;
    }

    const requestId = ++reportRequestIdRef.current;
    let cancelled = false;
    const postMortemVariant = postMortemVariantForDayScan(variant);

    const loadReport = async () => {
      setReportLoading(true);
      setReportError(null);
      try {
        const payload = await fetchDashboard(selectedSymbol, data.date);
        if (cancelled || requestId !== reportRequestIdRef.current) {
          return;
        }
        if (payload.analysisDate !== data.date) {
          setLoaded(null);
          setReportError(
            `Dashboard date mismatch: expected ${data.date}, received ${payload.analysisDate ?? "live"}.`,
          );
          return;
        }

        const decision = decisionForDayScanVariant(payload, variant);
        const graded = buildDeepakPostMortemReport(
          decision,
          payload.series,
          postMortemVariant,
        );
        if (!graded) {
          setLoaded(null);
          setReportError(
            `No ${variantLabel} path decision for ${selectedSymbol} on ${data.date}. Day-scan listed a signal, but the dashboard grader found none.`,
          );
          return;
        }

        if (cancelled || requestId !== reportRequestIdRef.current) {
          return;
        }
        setLoaded({
          symbol: payload.symbol,
          mode: payload.mode,
          report: graded,
          series: payload.series,
        });
      } catch (err) {
        if (cancelled || requestId !== reportRequestIdRef.current) {
          return;
        }
        setReportError(err instanceof Error ? err.message : String(err));
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
  }, [selectedSymbol, data, variant, variantLabel, reportNonce]);

  const selectedMeta =
    symbolOptions.find((option) => option.tradingSymbol === selectedSymbol) ?? null;
  const busy = loading || reportLoading;

  return (
    <div hidden={!isActive}>
      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
        <DayScanRunControls
          date={date}
          onDateChange={handleDateChange}
          loading={loading}
          onRun={handleRun}
          onStop={stop}
          ruleVariant={variant}
          onRuleVariantChange={handleVariantChange}
          idPrefix="dayscan-postmortem"
          description={descriptionForVariant(variant)}
        />

        {loading && <DayScanProgressBanner date={date} elapsedSeconds={loadingElapsedSec} />}

        {info && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            {info}
          </section>
        )}

        {error && (
          <section className="border border-kite-red/30 bg-kite-surface p-3 text-xs text-kite-red">
            {error}
          </section>
        )}

        {data && !loading && (
          <>
            <SectorBacktestResultsTable
              payload={data}
              csvFilePrefix={CSV_PREFIX[variant]}
              showStopSummary={variant === "watchParty"}
              showConfidenceFactors={variant === "deepak3"}
            />

            <section className="flex flex-wrap items-end justify-between gap-3 border border-kite-border bg-kite-surface p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label
                    className="mb-0.5 block text-[10px] uppercase tracking-wide text-kite-muted"
                    htmlFor="dayscan-postmortem-symbol"
                  >
                    Signal stock
                  </label>
                  <select
                    id="dayscan-postmortem-symbol"
                    value={selectedSymbol ?? ""}
                    onChange={(event) => setSelectedSymbol(event.target.value || null)}
                    disabled={symbolOptions.length === 0 || busy}
                    className="min-w-[240px] rounded-sm border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text focus:border-kite-orange focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {symbolOptions.length === 0 ? (
                      <option value="">No signal stocks for this scan</option>
                    ) : (
                      symbolOptions.map((option) => (
                        <option key={option.tradingSymbol} value={option.tradingSymbol}>
                          {option.tradingSymbol} · {option.sector} · {option.signalCount}{" "}
                          signal{option.signalCount === 1 ? "" : "s"} · {option.buyCount}B/
                          {option.sellCount}S
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setReportNonce((value) => value + 1)}
                  disabled={busy || !selectedSymbol}
                  className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-3 py-1.5 text-xs text-kite-text hover:border-kite-orange disabled:cursor-not-allowed disabled:opacity-60"
                  title="Recompute the open stock post-mortem"
                >
                  {reportLoading ? "Loading…" : "Refresh report"}
                </button>
              </div>

              {selectedMeta && (
                <p className="m-0 text-[10px] text-kite-muted">
                  Grading {selectedMeta.tradingSymbol} with{" "}
                  {DAY_SCAN_RULE_VARIANT_LABEL[variant]} · path variant{" "}
                  {postMortemVariantForDayScan(variant)} · {data.date}
                </p>
              )}
            </section>
          </>
        )}

        {reportError && (
          <section className="border border-kite-red/30 bg-kite-surface p-3 text-xs text-kite-red">
            {reportError}
          </section>
        )}

        {!loading && reportLoading && selectedSymbol && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            Loading post-mortem for {selectedSymbol} on {data?.date ?? date}…
          </section>
        )}

        {!loading && !data && !error && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            Pick a <strong>session date</strong> and <strong>rule variant</strong>, then click{" "}
            <strong>Run Scan</strong>. After signals appear, choose a stock to open the graded
            session path report (same format as Deepak Post-Mortem).
          </section>
        )}

        {loaded && (
          <DeepakPostMortemReportView
            symbol={loaded.symbol}
            mode={loaded.mode}
            report={loaded.report}
            series={loaded.series}
          />
        )}
      </main>
    </div>
  );
}
