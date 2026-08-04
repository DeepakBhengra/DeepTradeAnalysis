import { config } from "../config.js";
import {
  FAVOURABLE_SYMBOL_RULE_IDS,
  type FavourableSymbolRuleId,
} from "../rules/favourableSymbolRule.js";
import type { DayScanStrategy } from "../types.js";
import { SECTOR_WATCHLIST, type SectorWatchlistEntry } from "../symbols/sectorWatchlist.js";

/** Day Scan rule ids accepted by the candle-by-candle simulator. */
export type DayScanSimulationRuleVariant =
  | "deepak"
  | "deepak2"
  | "deepak3"
  | "watchParty"
  | "deeppro"
  | "deeppro1"
  | "rulePnb"
  | "ruleSunpharma"
  | "ruleLtm"
  | "ruleIcicigi"
  | "ruleTechm"
  | "ruleTvsmotor"
  | "rulePolicybzr";

/**
 * Simulator variant selector values.
 * `all` keeps the classic Deepak + Deepak-2 + Watch Party combined replay.
 */
export type DayScanSimulationVariant = "all" | DayScanSimulationRuleVariant;

const RULE_VARIANTS = new Set<string>([
  "deepak",
  "deepak2",
  "deepak3",
  "watchParty",
  "deeppro",
  "deeppro1",
  "rulePnb",
  "ruleSunpharma",
  "ruleLtm",
  "ruleIcicigi",
  "ruleTechm",
  "ruleTvsmotor",
  "rulePolicybzr",
]);

const FAVOURABLE_LOCKED_SYMBOL: Record<FavourableSymbolRuleId, string> = {
  ruleLtm: "LTM",
  ruleIcicigi: "ICICIGI",
  ruleTechm: "TECHM",
  ruleTvsmotor: "TVSMOTOR",
  rulePolicybzr: "POLICYBZR",
};

export function isDayScanSimulationVariant(
  value: string | null | undefined,
): value is DayScanSimulationVariant {
  return value === "all" || (typeof value === "string" && RULE_VARIANTS.has(value));
}

export function parseDayScanSimulationVariant(
  value: string | null | undefined,
): DayScanSimulationVariant {
  if (isDayScanSimulationVariant(value)) {
    return value;
  }
  return "all";
}

export function dayScanStrategyForVariant(
  variant: DayScanSimulationRuleVariant,
): DayScanStrategy {
  switch (variant) {
    case "deepak2":
      return "deepak-2";
    case "deepak3":
      return "deepak-3";
    case "watchParty":
      return "deepak-watch-party";
    case "deeppro":
      return "deeppro";
    case "deeppro1":
      return "deeppro1";
    case "rulePnb":
      return "rulePnb";
    case "ruleSunpharma":
      return "ruleSunpharma";
    case "ruleLtm":
      return "ruleLtm";
    case "ruleIcicigi":
      return "ruleIcicigi";
    case "ruleTechm":
      return "ruleTechm";
    case "ruleTvsmotor":
      return "ruleTvsmotor";
    case "rulePolicybzr":
      return "rulePolicybzr";
    case "deepak":
    default:
      return "deepak";
  }
}

export function lockedTradingSymbolForSimulationVariant(
  variant: DayScanSimulationVariant,
): string | null {
  if (variant === "rulePnb") {
    return config.rulePnb.tradingSymbol;
  }
  if (variant === "ruleSunpharma") {
    return config.ruleSunpharma.tradingSymbol;
  }
  if (
    variant === "ruleLtm" ||
    variant === "ruleIcicigi" ||
    variant === "ruleTechm" ||
    variant === "ruleTvsmotor" ||
    variant === "rulePolicybzr"
  ) {
    return FAVOURABLE_LOCKED_SYMBOL[variant];
  }
  return null;
}

export function isFavourableSimulationVariant(
  variant: DayScanSimulationVariant,
): variant is FavourableSymbolRuleId {
  return (FAVOURABLE_SYMBOL_RULE_IDS as readonly string[]).includes(variant);
}

/** Watchlist entries evaluated for this simulation variant. */
export function watchlistForSimulationVariant(
  variant: DayScanSimulationVariant,
): SectorWatchlistEntry[] {
  const locked = lockedTradingSymbolForSimulationVariant(variant);
  if (!locked) {
    return SECTOR_WATCHLIST;
  }
  const entry = SECTOR_WATCHLIST.find((item) => item.tradingSymbol === locked);
  if (entry) {
    return [entry];
  }
  // Symbol may not be on the sector watchlist (still allow a synthetic entry).
  return [
    {
      tradingSymbol: locked,
      sector: "Finance",
    },
  ];
}
