import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDayScanLiveRefresh } from "./useDayScanLiveRefresh";

describe("useDayScanLiveRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes every interval while date is today and before 15:15 IST", () => {
    const run = vi.fn();
    // 2026-08-03 10:00 IST = 2026-08-03 04:30 UTC
    const now = () => new Date("2026-08-03T04:30:00.000Z");

    renderHook(() =>
      useDayScanLiveRefresh({
        date: "2026-08-03",
        hasStarted: true,
        loading: false,
        isActive: true,
        run,
        intervalMs: 60_000,
        now,
      }),
    );

    expect(run).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("2026-08-03");
  });

  it("does not refresh for a historical date", () => {
    const run = vi.fn();
    const now = () => new Date("2026-08-03T04:30:00.000Z");

    renderHook(() =>
      useDayScanLiveRefresh({
        date: "2026-06-01",
        hasStarted: true,
        loading: false,
        isActive: true,
        run,
        intervalMs: 60_000,
        now,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(run).not.toHaveBeenCalled();
  });

  it("skips a tick while loading", () => {
    const run = vi.fn();
    const now = () => new Date("2026-08-03T04:30:00.000Z");

    const { rerender } = renderHook(
      ({ loading }) =>
        useDayScanLiveRefresh({
          date: "2026-08-03",
          hasStarted: true,
          loading,
          isActive: true,
          run,
          intervalMs: 60_000,
          now,
        }),
      { initialProps: { loading: true } },
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(run).not.toHaveBeenCalled();

    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
