/**
 * 100-stock study universe — same names as Day Scan SECTOR_WATCHLIST.
 */
import {
  SECTOR_WATCHLIST,
  type SectorWatchlistEntry,
} from "./sectorWatchlist.js";

export type StudyUniverseEntry = SectorWatchlistEntry;

export const STUDY_UNIVERSE_100: StudyUniverseEntry[] = SECTOR_WATCHLIST;

export function assertStudyUniverseSize(expected = 100): void {
  const symbols = new Set(STUDY_UNIVERSE_100.map((entry) => entry.tradingSymbol));
  if (symbols.size !== expected) {
    throw new Error(
      `STUDY_UNIVERSE_100 expected ${expected} unique symbols, got ${symbols.size}`,
    );
  }
}
