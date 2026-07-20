import { useEffect, useRef, useState } from "react";

import { DayScanProgressBanner } from "../components/DayScanProgressBanner";
import { DayScanRunControls } from "../components/DayScanRunControls";
import { DeepakRulesPanel } from "../components/DeepakRulesPanel";
import { SectorBacktestResultsTable } from "../components/SectorBacktestResultsTable";
import { SectorWatchlistPreview } from "../components/SectorWatchlistPreview";
import { SECTOR_WATCHLIST_SIZE } from "../data/sectorWatchlist";
import { useDeepak2DayScan } from "../hooks/useDeepak2DayScan";

const DEFAULT_DATE = "2026-05-11";

interface Deepak2DayScanWidgetProps {
  isActive: boolean;
  refreshTrigger?: number;
}

export function Deepak2DayScanWidget({
  isActive,
  refreshTrigger = 0,
}: Deepak2DayScanWidgetProps) {
  const [date, setDate] = useState(DEFAULT_DATE);
  const [watchlistExpanded, setWatchlistExpanded] = useState(false);
  const { data, loading, loadingElapsedSec, error, info, run, stop } = useDeepak2DayScan();
  const hasRunRef = useRef(false);

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
          description={
            <>
              Scans {SECTOR_WATCHLIST_SIZE} large-cap stocks across Bank, IT, Metal, Insurance,
              Automobile, and Health using Deepak-2 rules (session starts 10:15 IST). May take 2–15
              minutes depending on Kite response time.
            </>
          }
        />

        <SectorWatchlistPreview
          expanded={watchlistExpanded}
          onToggle={() => setWatchlistExpanded((value) => !value)}
        />
        <DeepakRulesPanel variant="deepak2" />

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
            Pick a date and click Run Scan to evaluate Deepak-2 BUY/SELL signals across the sector
            watchlist.
          </section>
        )}

        {data && (
          <SectorBacktestResultsTable payload={data} csvFilePrefix="deepak-2-day-scan" />
        )}
      </main>
    </div>
  );
}
