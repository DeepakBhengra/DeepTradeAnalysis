import { useEffect, useRef, useState } from "react";

import { pushDayScanSignalsToSamco } from "../api/samco";
import { DayScanProgressBanner } from "../components/DayScanProgressBanner";
import { DayScanRunControls } from "../components/DayScanRunControls";
import { DeepakRulesPanel } from "../components/DeepakRulesPanel";
import { SectorBacktestResultsTable } from "../components/SectorBacktestResultsTable";
import { SectorWatchlistPreview } from "../components/SectorWatchlistPreview";
import { SECTOR_WATCHLIST_SIZE } from "../data/sectorWatchlist";
import { useDayScanLiveRefresh } from "../hooks/useDayScanLiveRefresh";
import {
  DAY_SCAN_RULE_VARIANT_LABEL,
  isDayScanRuleVariant,
  useVariantDayScan,
  type DayScanRuleVariant,
} from "../hooks/useVariantDayScan";
import {
  FAVOURABLE_RULE_LABEL,
  FAVOURABLE_RULE_SYMBOL,
  isFavourableSymbolRuleVariant,
} from "../utils/favourableSymbolRule";
import { DAY_SCAN_LIVE_REFRESH_UNTIL_IST } from "../utils/istTime";
import { isSamcoRuleVariant } from "../utils/samcoRuleVariant";
import { readLocalStorage, writeLocalStorage } from "../utils/safeStorage";

const DEFAULT_DATE = "2026-05-11";
const VARIANT_STORAGE_KEY = "deepak-dayscan-variant";

const CSV_PREFIX: Record<DayScanRuleVariant, string> = {
  deepak: "deepak-day-scan",
  deepak2: "deepak-2-day-scan",
  deepak3: "deepak-3-day-scan",
  watchParty: "deepak-watch-party-day-scan",
  deeppro: "deeppro-day-scan",
  deeppro1: "deeppro1-day-scan",
  rulePnb: "rule-pnb-day-scan",
  ruleSunpharma: "rule-sunpharma-day-scan",
  ruleLtm: "rule-ltm-day-scan",
  ruleIcicigi: "rule-icicigi-day-scan",
  ruleTechm: "rule-techm-day-scan",
  ruleTvsmotor: "rule-tvsmotor-day-scan",
  rulePolicybzr: "rule-policybzr-day-scan",
};

function readStoredVariant(): DayScanRuleVariant {
  const stored = readLocalStorage(VARIANT_STORAGE_KEY);
  return isDayScanRuleVariant(stored) ? stored : "deepak";
}

function isSingleSymbolDayScanVariant(variant: DayScanRuleVariant): boolean {
  return (
    variant === "rulePnb" ||
    variant === "ruleSunpharma" ||
    isFavourableSymbolRuleVariant(variant)
  );
}

function descriptionForVariant(variant: DayScanRuleVariant): string {
  const label = DAY_SCAN_RULE_VARIANT_LABEL[variant];
  const universe = `${SECTOR_WATCHLIST_SIZE} liquid NSE stocks (Bank, IT, Metal, Insurance, Automobile, Health, Energy, FMCG, Finance, Infra, Consumer, Telecom, Defence)`;
  const liveRefresh = ` If the selected date is today, the scan auto-refreshes every 15 minutes until ${DAY_SCAN_LIVE_REFRESH_UNTIL_IST} IST.`;
  switch (variant) {
    case "deepak2":
      return `Scans ${universe} using ${label} rules (session starts 10:15 IST). May take several minutes depending on Kite response time.${liveRefresh}`;
    case "deepak3":
      return `Scans ${universe} using ${label} sure-shot filters (session 09:15 IST). May take several minutes depending on Kite response time.${liveRefresh}`;
    case "watchParty":
      return `Scans ${universe} for Deepak entries at 10:15 IST with Deepak-2 watch-party stop-loss exits. May take several minutes depending on Kite response time.${liveRefresh}`;
    case "deeppro":
      return `Scans ${universe} for ${label} Stch Mtm exhaustion reversals (pink-circle BUY/SELL, entry before 14:00 IST). May take several minutes depending on Kite response time.${liveRefresh}`;
    case "deeppro1":
      return `Scans ${universe} with ${label} — SMI black↔red cross entries (Stch Mtm 10,3,3) until 11:45 IST (one open position at a time). Exits: 0.45% target, breakeven after 0.3% then return to entry, opposite-cross flip (also opens the new side if ≤ 11:45), or forced 15:00 exit. Separate from Deeppro exhaustion. May take several minutes depending on Kite response time.${liveRefresh}`;
    case "rulePnb":
      return `Scans PNB only with ${label} — a separate RSI/SMI/BB proximity rule from the PNB favourable profit-range study (BUY quality / SELL quality / BUY extended, entry before 14:00 IST). Not mixed with Deepak or Deeppro and not applied to other stocks.${liveRefresh}`;
    case "ruleSunpharma":
      return `Scans SUNPHARMA only with ${label} — a separate RSI/SMI/BB proximity rule from the SUNPHARMA favourable profit-range study (BUY quality / SELL quality / BUY extended, entry before 14:00 IST). Not mixed with Deepak, Deeppro, or RulePNB and not applied to other stocks.${liveRefresh}`;
    case "ruleLtm":
    case "ruleIcicigi":
    case "ruleTechm":
    case "ruleTvsmotor":
    case "rulePolicybzr": {
      const symbol = FAVOURABLE_RULE_SYMBOL[variant];
      const ruleLabel = FAVOURABLE_RULE_LABEL[variant];
      return `Scans ${symbol} only with ${ruleLabel} — a separate RSI/SMI/BB proximity rule from the ${symbol} favourable profit-range study (BUY quality / SELL quality / BUY extended, entry before 14:00 IST). Not mixed with Deepak/Deeppro and not applied to other stocks.${liveRefresh}`;
    }
    case "deepak":
    default:
      return `Scans ${universe} using ${label} rules. May take several minutes depending on Kite response time.${liveRefresh}`;
  }
}

function rulesPanelVariant(
  variant: DayScanRuleVariant,
):
  | "deepak"
  | "deepak2"
  | "deepak3"
  | "deeppro"
  | "deeppro1"
  | "rulePnb"
  | "ruleSunpharma"
  | "ruleLtm"
  | "ruleIcicigi"
  | "ruleTechm"
  | "ruleTvsmotor"
  | "rulePolicybzr" {
  if (
    variant === "deepak2" ||
    variant === "deepak3" ||
    variant === "deeppro" ||
    variant === "deeppro1" ||
    variant === "rulePnb" ||
    variant === "ruleSunpharma" ||
    isFavourableSymbolRuleVariant(variant)
  ) {
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
  const [hasStarted, setHasStarted] = useState(false);
  const { data, loading, loadingElapsedSec, error, info, run, stop, reset } =
    useVariantDayScan(variant);
  const hasRunRef = useRef(false);
  const [samcoPushInfo, setSamcoPushInfo] = useState<string | null>(null);

  const variantLabel = DAY_SCAN_RULE_VARIANT_LABEL[variant];

  useEffect(() => {
    if (!data || !isSamcoRuleVariant(variant)) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await pushDayScanSignalsToSamco({
          date: data.date,
          variant,
          runAt: data.runAt,
          trades: data.trades.map((trade) => ({
            tradingSymbol: trade.tradingSymbol,
            symbol: trade.symbol,
            sector: trade.sector,
            side: trade.side,
            scenarioNumber: trade.scenarioNumber,
            scenarioKey: trade.scenarioKey,
            entryTimeIst: trade.entryTimeIst,
            entryPrice: trade.entryPrice,
            exitTimeIst: trade.exitTimeIst,
            exitPrice: trade.exitPrice,
            targetHit: trade.targetHit,
            exitReason: trade.exitReason ?? null,
            stopLossHit: trade.stopLossHit,
          })),
        });
        if (!cancelled) {
          setSamcoPushInfo(
            `Pushed ${data.trades.length} Day Scan trade(s) to Samco Trading (${variantLabel}).`,
          );
        }
      } catch (pushError) {
        if (!cancelled) {
          const message =
            pushError instanceof Error ? pushError.message : String(pushError);
          setSamcoPushInfo(`Samco push skipped: ${message}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, variant, variantLabel]);

  const handleVariantChange = (next: DayScanRuleVariant) => {
    if (next === variant) {
      return;
    }
    setVariant(next);
    writeLocalStorage(VARIANT_STORAGE_KEY, next);
    hasRunRef.current = false;
    setHasStarted(false);
    reset();
  };

  const handleRun = () => {
    hasRunRef.current = true;
    setHasStarted(true);
    void run(date);
  };

  useEffect(() => {
    if (refreshTrigger > 0 && isActive && hasRunRef.current) {
      void run(date);
    }
  }, [refreshTrigger, isActive, run, date]);

  useDayScanLiveRefresh({
    date,
    hasStarted,
    loading,
    isActive,
    run,
  });

  return (
    <div hidden={!isActive}>
      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
        <DayScanRunControls
          date={date}
          onDateChange={(next) => {
            setDate(next);
            hasRunRef.current = false;
            setHasStarted(false);
            reset();
          }}
          loading={loading}
          onRun={handleRun}
          onStop={stop}
          ruleVariant={variant}
          onRuleVariantChange={handleVariantChange}
          description={descriptionForVariant(variant)}
        />

        {!isSingleSymbolDayScanVariant(variant) && (
          <SectorWatchlistPreview
            expanded={watchlistExpanded}
            onToggle={() => setWatchlistExpanded((value) => !value)}
          />
        )}
        <DeepakRulesPanel variant={rulesPanelVariant(variant)} />

        {loading && <DayScanProgressBanner date={date} elapsedSeconds={loadingElapsedSec} />}

        {info && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            {info}
          </section>
        )}

        {samcoPushInfo && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            {samcoPushInfo}
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
