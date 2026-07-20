import { SECTOR_WATCHLIST_SIZE } from "../data/sectorWatchlist";

interface DayScanProgressBannerProps {
  date: string;
  elapsedSeconds: number;
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) {
    return `${remainder}s`;
  }
  return `${minutes}m ${remainder}s`;
}

export function DayScanProgressBanner({ date, elapsedSeconds }: DayScanProgressBannerProps) {
  return (
    <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
      Scanning NSE stocks for {date}… ({SECTOR_WATCHLIST_SIZE} symbols,{" "}
      {formatElapsed(elapsedSeconds)} elapsed)
    </section>
  );
}
