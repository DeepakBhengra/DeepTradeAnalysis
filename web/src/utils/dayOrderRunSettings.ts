import type { DayOrderRunSettings } from "../types/dayOrder";
import {
  DEFAULT_DAY_ORDER_RUN_SETTINGS,
  MAX_ENTRY_PRICE,
  MIN_ENTRY_PRICE,
  ORDER_QUANTITY,
} from "../types/dayOrder";

export function parseDayOrderRunSettingsInput(input: {
  quantityText: string;
  minEntryPriceText: string;
  maxEntryPriceText: string;
}): DayOrderRunSettings {
  const quantity = Number.parseInt(input.quantityText.trim(), 10);
  const minEntryPrice = Number(input.minEntryPriceText.trim());
  const maxEntryPrice = Number(input.maxEntryPriceText.trim());

  return {
    quantity: Number.isFinite(quantity) ? quantity : Number.NaN,
    minEntryPrice: Number.isFinite(minEntryPrice) ? minEntryPrice : Number.NaN,
    maxEntryPrice: Number.isFinite(maxEntryPrice) ? maxEntryPrice : Number.NaN,
  };
}

export function formatDayOrderRunSettings(settings: DayOrderRunSettings): {
  quantityText: string;
  minEntryPriceText: string;
  maxEntryPriceText: string;
} {
  return {
    quantityText: String(settings.quantity),
    minEntryPriceText: String(settings.minEntryPrice),
    maxEntryPriceText: String(settings.maxEntryPrice),
  };
}

export function defaultDayOrderRunSettings(): DayOrderRunSettings {
  return { ...DEFAULT_DAY_ORDER_RUN_SETTINGS };
}

export const DAY_ORDER_SETTINGS_DEFAULTS = {
  quantity: ORDER_QUANTITY,
  minEntryPrice: MIN_ENTRY_PRICE,
  maxEntryPrice: MAX_ENTRY_PRICE,
} as const;
