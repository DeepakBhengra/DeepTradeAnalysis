import { describe, expect, it } from "vitest";

import {
  formatDayOrderRunSettings,
  parseDayOrderRunSettingsInput,
  parseTradingSymbolsText,
} from "./dayOrderRunSettings";

describe("dayOrderRunSettings", () => {
  it("parses quantity, price range, stop-loss, and stock inputs", () => {
    expect(
      parseDayOrderRunSettingsInput({
        quantityText: "50",
        minEntryPriceText: "100",
        maxEntryPriceText: "1500.5",
        stopLossPctText: "0.5",
        tradingSymbolsText: "reliance, TCS  infy",
      }),
    ).toEqual({
      quantity: 50,
      minEntryPrice: 100,
      maxEntryPrice: 1500.5,
      stopLossPct: 0.5,
      tradingSymbols: ["RELIANCE", "TCS", "INFY"],
    });
  });

  it("treats blank or zero stop-loss as off", () => {
    expect(
      parseDayOrderRunSettingsInput({
        quantityText: "100",
        minEntryPriceText: "0",
        maxEntryPriceText: "1900",
        stopLossPctText: "",
      }).stopLossPct,
    ).toBeNull();
    expect(
      parseDayOrderRunSettingsInput({
        quantityText: "100",
        minEntryPriceText: "0",
        maxEntryPriceText: "1900",
        stopLossPctText: "0",
      }).stopLossPct,
    ).toBeNull();
  });

  it("formats settings for controlled inputs", () => {
    expect(
      formatDayOrderRunSettings({
        quantity: 100,
        minEntryPrice: 0,
        maxEntryPrice: 1900,
        stopLossPct: null,
        tradingSymbols: ["RELIANCE", "TCS"],
      }),
    ).toEqual({
      quantityText: "100",
      minEntryPriceText: "0",
      maxEntryPriceText: "1900",
      stopLossPctText: "",
      tradingSymbolsText: "RELIANCE, TCS",
    });
  });

  it("parses blank stock text as all stocks", () => {
    expect(parseTradingSymbolsText("")).toEqual([]);
    expect(parseTradingSymbolsText("  , ; ")).toEqual([]);
  });
});
