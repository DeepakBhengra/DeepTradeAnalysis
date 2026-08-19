import { useEffect, useRef, useState } from "react";

import { DayScanProgressBanner } from "../components/DayScanProgressBanner";
import { DayScanRunControls } from "../components/DayScanRunControls";
import { DeepakRulesPanel } from "../components/DeepakRulesPanel";
import { SectorBacktestResultsTable } from "../components/SectorBacktestResultsTable";
import { SectorWatchlistPreview } from "../components/SectorWatchlistPreview";
import { SECTOR_WATCHLIST_SIZE } from "../data/sectorWatchlist";
import { useDeepak3DayScan } from "../hooks/useDeepak3DayScan";
import { todayIstDateKey } from "../utils/istTime";

interface Deepak3DayScanWidgetProps {
  isActive: boolean;
  refreshTrigger?: number;
}

export function Deepak3DayScanWidget({
  isActive,
  refreshTrigger = 0,
}: Deepak3DayScanWidgetProps) {
  const [date, setDate] = useState(todayIstDateKey);
  const [watchlistExpanded, setWatchlistExpanded] = useState(false);
  const { data, loading, loadingElapsedSec, error, info, run, stop } = useDeepak3DayScan();
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
              Scans {SECTOR_WATCHLIST_SIZE} large-cap stocks using Deepak-3 sure-shot filters
              (crossed anchor, continue-2 only, entry range ≥ target, sector breadth ≥ 3). May take
              2–15 minutes depending on Kite response time.
            </>
          }
        />

        <SectorWatchlistPreview
          expanded={watchlistExpanded}
          onToggle={() => setWatchlistExpanded((value) => !value)}
        />
        <DeepakRulesPanel variant="deepak3" />

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
            Pick a date and click Run Scan to evaluate Deepak-3 BUY/SELL signals across the sector
            watchlist.
          </section>
        )}

        {data && (
          <SectorBacktestResultsTable payload={data} showConfidenceFactors />
        )}
      </main>
    </div>
  );
}
