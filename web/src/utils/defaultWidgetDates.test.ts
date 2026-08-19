import { describe, expect, it, vi } from "vitest";

import { todayIstDateKey } from "./istTime";

/**
 * Widgets initialize session/analysis dates with todayIstDateKey on mount so a
 * page load / refresh always shows the current IST trading day.
 */
describe("default widget dates", () => {
  it("todayIstDateKey returns the current Asia/Kolkata calendar day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T04:00:00.000Z")); // 09:30 IST
    expect(todayIstDateKey()).toBe("2026-08-19");
    vi.useRealTimers();
  });
});
