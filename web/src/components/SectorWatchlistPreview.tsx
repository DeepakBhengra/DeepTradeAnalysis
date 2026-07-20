import {
  SECTOR_WATCHLIST_PREVIEW,
  SECTOR_WATCHLIST_SIZE,
} from "../data/sectorWatchlist";

interface SectorWatchlistPreviewProps {
  expanded: boolean;
  onToggle: () => void;
}

export function SectorWatchlistPreview({ expanded, onToggle }: SectorWatchlistPreviewProps) {
  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left"
      >
        <h2 className="m-0 text-xs font-medium uppercase tracking-wide text-kite-muted">
          Sector watchlist ({SECTOR_WATCHLIST_SIZE} stocks)
        </h2>
        <span className="text-xs text-kite-muted">{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 text-xs">
          {SECTOR_WATCHLIST_PREVIEW.map((group) => (
            <div key={group.sector}>
              <p className="m-0 font-medium text-kite-text">{group.sector}</p>
              <p className="m-0 mt-1 text-kite-muted">{group.symbols.join(", ")}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
