import { useEffect, useRef, useState } from "react";

import { DayScanProgressBanner } from "../components/DayScanProgressBanner";
import { DayScanRunControls } from "../components/DayScanRunControls";
import { DeepakRulesPanel } from "../components/DeepakRulesPanel";
import { SectorBacktestResultsTable } from "../components/SectorBacktestResultsTable";
import { SectorWatchlistPreview } from "../components/SectorWatchlistPreview";
import { SECTOR_WATCHLIST_SIZE } from "../data/sectorWatchlist";
import {
  DAY_SCAN_RULE_VARIANT_LABEL,
  isDayScanRuleVariant,
  useVariantDayScan,
  type DayScanRuleVariant,
} from "../hooks/useVariantDayScan";
import { readLocalStorage, writeLocalStorage } from "../utils/safeStorage";

const DEFAULT_DATE = "2026-05-11";
const VARIANT_STORAGE_KEY = "deepak-dayscan-variant";

const CSV_PREFIX: Record<DayScanRuleVariant, string> = {
  deepak: "deepak-day-scan",
  deepak2: "deepak-2-day-scan",
  deepak3: "deepak-3-day-scan",
  watchParty: "deepak-watch-party-day-scan",
};

function readStoredVariant(): DayScanRuleVariant {
  const stored = readLocalStorage(VARIANT_STORAGE_KEY);
  return isDayScanRuleVariant(stored) ? stored : "deepak";
}

function descriptionForVariant(variant: DayScanRuleVariant): string {
  const label = DAY_SCAN_RULE_VARIANT_LABEL[variant];
  switch (variant) {
    case "deepak2":
      return `Scans ${SECTOR_WATCHLIST_SIZE} large-cap stocks across Bank, IT, Metal, Insurance, Automobile, and Health using ${label} rules (session starts 10:15 IST). May take 2–15 minutes depending on Kite response time.`;
    case "deepak3":
      return `Scans ${SECTOR_WATCHLIST_SIZE} large-cap stocks across Bank, IT, Metal, Insurance, Automobile, and Health using ${label} sure-shot filters (session 09:15 IST). May take 2–15 minutes depending on Kite response time.`;
    case "watchParty":
      return `Scans ${SECTOR_WATCHLIST_SIZE} large-cap stocks for Deepak entries at 10:15 IST with Deepak-2 watch-party stop-loss exits. May take 2–15 minutes depending on Kite response time.`;
    case "deepak":
    default:
      return `Scans ${SECTOR_WATCHLIST_SIZE} large-cap stocks across Bank, IT, Metal, Insurance, Automobile, and Health using ${label} rules. May take 2–15 minutes depending on Kite response time.`;
  }
}

function rulesPanelVariant(
  variant: DayScanRuleVariant,
): "deepak" | "deepak2" | "deepak3" {
  if (variant === "deepak2" || variant === "deepak3") {
    return variant;
  }
  return "deepak";
}

interface DeepakDayScanWidgetProps {
  isActive: boolean;
  refreshTrigger?: number;
}

export function DeepakDayScanWidget({
  isActive,
  refreshTrigger = 0,
}: DeepakDayScanWidgetProps) {
  const [date, setDate] = useState(DEFAULT_DATE);
  const [variant, setVariant] = useState<DayScanRuleVariant>(readStoredVariant);
  const [watchlistExpanded, setWatchlistExpanded] = useState(false);
  const { data, loading, loadingElapsedSec, error, info, run, stop, reset } =
    useVariantDayScan(variant);
  const hasRunRef = useRef(false);

  const variantLabel = DAY_SCAN_RULE_VARIANT_LABEL[variant];

  const handleVariantChange = (next: DayScanRuleVariant) => {
    if (next === variant) {
      return;
    }
    setVariant(next);
    writeLocalStorage(VARIANT_STORAGE_KEY, next);
    hasRunRef.current = false;
    reset();
  };

  const handleRun = () => {
    hasRunRef.current = true;
    void run(date);
  };

  useEffect(() => {
    if (refreshTrigger > 0 && isActive && hasRunRef.current) {
      void run(date);
    }
  }, [refreshTrigger, isActive, run, date]);

  return (
    <div hidden={!isActive}>
      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
        <DayScanRunControls
          date={date}
          onDateChange={setDate}
          loading={loading}
          onRun={handleRun}
          onStop={stop}
          ruleVariant={variant}
          onRuleVariantChange={handleVariantChange}
          description={descriptionForVariant(variant)}
        />

        <SectorWatchlistPreview
          expanded={watchlistExpanded}
          onToggle={() => setWatchlistExpanded((value) => !value)}
        />
        <DeepakRulesPanel variant={rulesPanelVariant(variant)} />

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

        {!data && !loading && !error && !info && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            Pick a date and click Run Scan to evaluate {variantLabel} BUY/SELL signals across the
            sector watchlist.
          </section>
        )}

        {data && (
          <SectorBacktestResultsTable
            payload={data}
            csvFilePrefix={CSV_PREFIX[variant]}
            showStopSummary={variant === "watchParty"}
          />
        )}
      </main>
    </div>
  );
}
