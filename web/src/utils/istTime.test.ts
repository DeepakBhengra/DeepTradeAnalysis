import { TickMarkType } from "lightweight-charts";
import { describe, expect, it } from "vitest";
import {
  formatIstCrosshairTime,
  formatIstDateTime,
  formatIstTickMark,
} from "./istTime";

describe("istTime", () => {
  const nseOpenUtcSeconds = Math.floor(
    new Date("2026-06-18T03:45:00.000Z").getTime() / 1000,
  );

  it("formats chart time ticks in IST", () => {
    expect(formatIstTickMark(nseOpenUtcSeconds, TickMarkType.Time)).toBe("09:15");
  });

  it("formats trading-day labels with weekday", () => {
    expect(formatIstTickMark(nseOpenUtcSeconds, TickMarkType.DayOfMonth)).toBe(
      "Thu, 18 Jun",
    );
  });

  it("formats crosshair labels with IST date and time", () => {
    expect(formatIstCrosshairTime(nseOpenUtcSeconds)).toBe("Thu, 18 Jun, 09:15");
  });

  it("formats dashboard timestamps in IST", () => {
    expect(formatIstDateTime("2026-06-18T03:45:00.000Z")).toBe(
      "Thu, 18 Jun, 09:15",
    );
  });
});
