import {
  SECTOR_ORDER,
  SECTOR_WATCHLIST,
  type SectorName,
  type SectorWatchlistEntry,
} from "./sectorWatchlist.js";

export function shuffleArray<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

/**
 * Interleaves stocks across sectors in a random sector order so Samco entries
 * are not always processed in fixed watchlist sequence (e.g. all Bank names first).
 */
export function buildSectorRandomizedWatchlist(
  entries: SectorWatchlistEntry[] = SECTOR_WATCHLIST,
  random: () => number = Math.random,
): SectorWatchlistEntry[] {
  const bySector = new Map<SectorName, SectorWatchlistEntry[]>();

  for (const entry of entries) {
    const group = bySector.get(entry.sector) ?? [];
    group.push(entry);
    bySector.set(entry.sector, group);
  }

  const sectorOrder = shuffleArray(
    SECTOR_ORDER.filter((sector) => (bySector.get(sector)?.length ?? 0) > 0),
    random,
  );

  for (const sector of sectorOrder) {
    bySector.set(sector, shuffleArray(bySector.get(sector) ?? [], random));
  }

  const ordered: SectorWatchlistEntry[] = [];
  let hasRemaining = true;

  while (hasRemaining) {
    hasRemaining = false;
    for (const sector of sectorOrder) {
      const group = bySector.get(sector) ?? [];
      const next = group.shift();
      if (next) {
        ordered.push(next);
        hasRemaining = true;
      }
    }
  }

  return ordered;
}
