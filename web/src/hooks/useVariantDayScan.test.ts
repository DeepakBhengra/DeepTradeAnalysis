import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useVariantDayScan } from "./useVariantDayScan";

const fetchDeepakDayScan = vi.fn();
const fetchDeepak2DayScan = vi.fn();
const fetchDeepak3DayScan = vi.fn();
const fetchDeepakWatchPartyDayScan = vi.fn();
const fetchDeepproDayScan = vi.fn();
const fetchRulePnbDayScan = vi.fn();
const fetchRuleSunpharmaDayScan = vi.fn();

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
  fetchDeepproDayScan: (...args: unknown[]) => fetchDeepproDayScan(...args),
  fetchRulePnbDayScan: (...args: unknown[]) => fetchRulePnbDayScan(...args),
  fetchRuleSunpharmaDayScan: (...args: unknown[]) =>
    fetchRuleSunpharmaDayScan(...args),
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
    fetchDeepproDayScan.mockResolvedValue({
      ...payload,
      label: "deeppro",
    });
    fetchRulePnbDayScan.mockResolvedValue({
      ...payload,
      label: "rulePnb",
    });
    fetchRuleSunpharmaDayScan.mockResolvedValue({
      ...payload,
      label: "ruleSunpharma",
    });
  });

  it("routes each rule variant to its day-scan API", async () => {
    const { result, rerender } = renderHook(
      ({ variant }) => useVariantDayScan(variant),
      { initialProps: { variant: "deepak" as const } },
    );

    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchDeepakDayScan).toHaveBeenCalledWith(
      "2026-05-11",
      expect.any(AbortSignal),
    );

    rerender({ variant: "deepak2" });
    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchDeepak2DayScan).toHaveBeenCalledTimes(1);

    rerender({ variant: "deepak3" });
    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchDeepak3DayScan).toHaveBeenCalledTimes(1);

    rerender({ variant: "watchParty" });
    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchDeepakWatchPartyDayScan).toHaveBeenCalledTimes(1);

    rerender({ variant: "deeppro" });
    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchDeepproDayScan).toHaveBeenCalledTimes(1);

    rerender({ variant: "rulePnb" });
    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchRulePnbDayScan).toHaveBeenCalledWith(
      "2026-05-11",
      expect.any(AbortSignal),
    );

    rerender({ variant: "ruleSunpharma" });
    await act(async () => {
      await result.current.run("2026-05-11");
    });
    expect(fetchRuleSunpharmaDayScan).toHaveBeenCalledWith(
      "2026-05-11",
      expect.any(AbortSignal),
    );
  });
});
