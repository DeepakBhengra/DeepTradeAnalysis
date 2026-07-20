import { describe, expect, it } from "vitest";
import {
  getIstTimeParts,
  isValidAnalysisDate,
  isWithinIstSessionWindow,
  parseHmToMinutes,
} from "../../src/utils/marketTime.js";

describe("marketTime", () => {
  it("parses HH:mm to minutes", () => {
    expect(parseHmToMinutes("09:30")).toBe(570);
    expect(parseHmToMinutes("12:00")).toBe(720);
  });

  it("detects candles inside the 9:15-12:00 IST session window", () => {
    const at915 = new Date("2026-06-19T09:15:00+05:30");
    const at930 = new Date("2026-06-19T09:30:00+05:30");
    const at1215 = new Date("2026-06-19T12:15:00+05:30");

    expect(isWithinIstSessionWindow(at915, "09:15", "12:00")).toBe(true);
    expect(isWithinIstSessionWindow(at930, "09:15", "12:00")).toBe(true);
    expect(isWithinIstSessionWindow(at1215, "09:15", "12:00")).toBe(false);
  });

  it("validates analysis date strings", () => {
    expect(isValidAnalysisDate("2026-06-19")).toBe(true);
    expect(isValidAnalysisDate("2026-13-01")).toBe(false);
    expect(isValidAnalysisDate("bad-date")).toBe(false);
  });

  it("extracts IST date parts", () => {
    const date = new Date("2026-06-18T10:15:00+05:30");
    const parts = getIstTimeParts(date);

    expect(parts.dateKey).toBe("2026-06-18");
    expect(parts.hour).toBe(10);
    expect(parts.minute).toBe(15);
  });
});
