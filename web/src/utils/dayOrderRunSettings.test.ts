import { describe, expect, it } from "vitest";

import {
  formatDayOrderRunSettings,
  parseDayOrderRunSettingsInput,
} from "./dayOrderRunSettings";

describe("dayOrderRunSettings", () => {
  it("parses quantity and price range inputs", () => {
    expect(
      parseDayOrderRunSettingsInput({
        quantityText: "50",
        minEntryPriceText: "100",
        maxEntryPriceText: "1500.5",
      }),
    ).toEqual({
      quantity: 50,
      minEntryPrice: 100,
      maxEntryPrice: 1500.5,
    });
  });

  it("formats settings for controlled inputs", () => {
    expect(
      formatDayOrderRunSettings({
        quantity: 100,
        minEntryPrice: 0,
        maxEntryPrice: 1900,
      }),
    ).toEqual({
      quantityText: "100",
      minEntryPriceText: "0",
      maxEntryPriceText: "1900",
    });
  });
});
