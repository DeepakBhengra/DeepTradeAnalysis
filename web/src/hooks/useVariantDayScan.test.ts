import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useVariantDayScan } from "./useVariantDayScan";

const fetchDeepakDayScan = vi.fn();
const fetchDeepak2DayScan = vi.fn();
const fetchDeepak3DayScan = vi.fn();
const fetchDeepakWatchPartyDayScan = vi.fn();

vi.mock("../api/client", () => ({
  ScanStoppedError: class ScanStoppedError extends Error {
    constructor() {
      super("stopped");
      this.name = "ScanStoppedError";
    }
  },
  fetchDeepakDayScan: (...args: unknown[]) => fetchDeepakDayScan(...args),
  fetchDeepak2DayScan: (...args: unknown[]) => fetchDeepak2DayScan(...args),
  fetchDeepak3DayScan: (...args: unknown[]) => fetchDeepak3DayScan(...args),
  fetchDeepakWatchPartyDayScan: (...args: unknown[]) =>
    fetchDeepakWatchPartyDayScan(...args),
}));

const payload = {
  date: "2026-05-11",
  runAt: "2026-05-11T10:00:00.000Z",
  summary: {
    stocksScanned: 1,
    stocksWithSignals: 1,
    totalSignals: 1,
    buyCount: 1,
    sellCount: 0,
    targetsHit: 0,
    targetsMissed: 1,
  },
  trades: [],
  errors: [],
};

describe("useVariantDayScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchDeepakDayScan.mockResolvedValue({ ...payload, label: "deepak" });
    fetchDeepak2DayScan.mockResolvedValue({ ...payload, label: "deepak2" });
    fetchDeepak3DayScan.mockResolvedValue({ ...payload, label: "deepak3" });
    fetchDeepakWatchPartyDayScan.mockResolvedValue({
      ...payload,
      label: "watchParty",
    });
  });

  it("calls the Deepak day-scan API for the deepak variant", async () => {
    const { result } = renderHook(() => useVariantDayScan("deepak"));

    await act(async () => {
      await result.current.run("2026-05-11");
    });

    expect(fetchDeepakDayScan).toHaveBeenCalledWith(
      "2026-05-11",
      expect.any(AbortSignal),
    );
    expect(fetchDeepak2DayScan).not.toHaveBeenCalled();
    expect(result.current.data).toMatchObject({ label: "deepak" });
  });

  it("switches fetchers when the rule variant changes", async () => {
    const { result, rerender } = renderHook(
      ({ variant }) => useVariantDayScan(variant),
      { initialProps: { variant: "deepak" as const } },
    );

    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchDeepakDayScan).toHaveBeenCalledTimes(1);

    rerender({ variant: "deepak2" });
    act(() => {
      result.current.reset();
    });

    await act(async () => {
      await result.current.run("2026-05-11");
    });

    expect(fetchDeepak2DayScan).toHaveBeenCalledWith(
      "2026-05-11",
      expect.any(AbortSignal),
    );
    expect(result.current.data).toMatchObject({ label: "deepak2" });
  });

  it("routes deepak3 and watchParty to their APIs", async () => {
    const { result, rerender } = renderHook(
      ({ variant }) => useVariantDayScan(variant),
      { initialProps: { variant: "deepak3" as const } },
    );

    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchDeepak3DayScan).toHaveBeenCalledTimes(1);

    rerender({ variant: "watchParty" });
    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchDeepakWatchPartyDayScan).toHaveBeenCalledTimes(1);
  });
});
