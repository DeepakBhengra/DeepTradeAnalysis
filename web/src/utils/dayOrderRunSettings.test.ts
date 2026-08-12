import { describe, expect, it } from "vitest";

import {
  formatDayOrderRunSettings,
  parseDayOrderRunSettingsInput,
} from "./dayOrderRunSettings";

describe("dayOrderRunSettings", () => {
  it("parses quantity, price range, and stop-loss inputs", () => {
    expect(
      parseDayOrderRunSettingsInput({
        quantityText: "50",
        minEntryPriceText: "100",
        maxEntryPriceText: "1500.5",
        stopLossPctText: "0.5",
      }),
    ).toEqual({
      quantity: 50,
      minEntryPrice: 100,
      maxEntryPrice: 1500.5,
      stopLossPct: 0.5,
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
      }),
    ).toEqual({
      quantityText: "100",
      minEntryPriceText: "0",
      maxEntryPriceText: "1900",
      stopLossPctText: "",
    });
  });
});
