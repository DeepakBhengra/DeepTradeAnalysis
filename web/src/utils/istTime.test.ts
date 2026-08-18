import { TickMarkType } from "lightweight-charts";
import { describe, expect, it } from "vitest";
import {
  currentIstHm,
  formatIstCrosshairTime,
  formatIstDateTime,
  formatIstTickMark,
  msUntilNextQuarterHourIst,
  shouldLiveRefreshDayScan,
  todayIstDateKey,
} from "./istTime";

describe("istTime", () => {
  const nseOpenUtcSeconds = Math.floor(
    new Date("2026-06-18T03:45:00.000Z").getTime() / 1000,
  );

  it("computes today and live-refresh window in IST", () => {
    const morning = new Date("2026-08-03T04:30:00.000Z"); // 10:00 IST
    const afterClose = new Date("2026-08-03T10:00:00.000Z"); // 15:30 IST
    expect(todayIstDateKey(morning)).toBe("2026-08-03");
    expect(currentIstHm(morning)).toBe("10:00");
    expect(shouldLiveRefreshDayScan("2026-08-03", morning)).toBe(true);
    expect(shouldLiveRefreshDayScan("2026-08-03", afterClose)).toBe(false);
    expect(shouldLiveRefreshDayScan("2026-06-01", morning)).toBe(false);
  });

  it("schedules the next IST quarter-hour probe with a feed buffer", () => {
    // 13:20:00 IST → next boundary 13:30 + 10s buffer
    const mid = new Date("2026-08-18T07:50:00.000Z");
    expect(msUntilNextQuarterHourIst(mid, 10_000)).toBe(10 * 60_000 + 10_000);

    // Exactly on a boundary → probe soon
    const onBoundary = new Date("2026-08-18T08:00:00.000Z"); // 13:30:00 IST
    expect(msUntilNextQuarterHourIst(onBoundary, 10_000)).toBe(10_000);
  });

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
