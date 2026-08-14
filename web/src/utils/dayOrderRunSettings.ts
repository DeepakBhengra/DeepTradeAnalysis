import type { DayOrderRunSettings } from "../types/dayOrder";
import {
  DEFAULT_DAY_ORDER_RUN_SETTINGS,
  MAX_ENTRY_PRICE,
  MIN_ENTRY_PRICE,
  ORDER_QUANTITY,
} from "../types/dayOrder";
import { normalizeStopLossPct } from "./stopLossPct";

/** Parse comma / space / semicolon separated trading symbols; empty → all stocks. */
export function parseTradingSymbolsText(text: string): string[] {
  const parts = text
    .split(/[\s,;]+/)
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0);
  return [...new Set(parts)];
}

export function formatTradingSymbolsText(symbols: string[]): string {
  return symbols.join(", ");
}

export function parseDayOrderRunSettingsInput(input: {
  quantityText: string;
  minEntryPriceText: string;
  maxEntryPriceText: string;
  stopLossPctText: string;
  tradingSymbolsText?: string;
}): DayOrderRunSettings {
  const quantity = Number.parseInt(input.quantityText.trim(), 10);
  const minEntryPrice = Number(input.minEntryPriceText.trim());
  const maxEntryPrice = Number(input.maxEntryPriceText.trim());
  const stopLossRaw = input.stopLossPctText.trim();
  const stopLossParsed =
    stopLossRaw === "" ? null : Number(stopLossRaw);

  return {
    quantity: Number.isFinite(quantity) ? quantity : Number.NaN,
    minEntryPrice: Number.isFinite(minEntryPrice) ? minEntryPrice : Number.NaN,
    maxEntryPrice: Number.isFinite(maxEntryPrice) ? maxEntryPrice : Number.NaN,
    stopLossPct: normalizeStopLossPct(
      stopLossParsed == null || !Number.isFinite(stopLossParsed)
        ? null
        : stopLossParsed,
    ),
    tradingSymbols: parseTradingSymbolsText(input.tradingSymbolsText ?? ""),
  };
}

export function formatDayOrderRunSettings(settings: DayOrderRunSettings): {
  quantityText: string;
  minEntryPriceText: string;
  maxEntryPriceText: string;
  stopLossPctText: string;
  tradingSymbolsText: string;
} {
  return {
    quantityText: String(settings.quantity),
    minEntryPriceText: String(settings.minEntryPrice),
    maxEntryPriceText: String(settings.maxEntryPrice),
    stopLossPctText:
      settings.stopLossPct == null ? "" : String(settings.stopLossPct),
    tradingSymbolsText: formatTradingSymbolsText(settings.tradingSymbols ?? []),
  };
}

export function defaultDayOrderRunSettings(): DayOrderRunSettings {
  return {
    ...DEFAULT_DAY_ORDER_RUN_SETTINGS,
    tradingSymbols: [...DEFAULT_DAY_ORDER_RUN_SETTINGS.tradingSymbols],
  };
}

export const DAY_ORDER_SETTINGS_DEFAULTS = {
  quantity: ORDER_QUANTITY,
  minEntryPrice: MIN_ENTRY_PRICE,
  maxEntryPrice: MAX_ENTRY_PRICE,
  stopLossPct: null as number | null,
  tradingSymbols: [] as string[],
} as const;
