import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDayScanSimulation } from "./useDayScanSimulation";

const { fetchDayScanSimulationMock } = vi.hoisted(() => ({
  fetchDayScanSimulationMock: vi.fn(),
}));

vi.mock("../api/client", () => ({
  fetchDayScanSimulation: fetchDayScanSimulationMock,
}));

function makePayload(sessionIndex: number) {
  return {
    date: "2026-06-09",
    simulation: {
      sessionIndex,
      sessionCandleCount: 3,
      simulatedTimeIst: sessionIndex === 0 ? "09:15" : sessionIndex === 1 ? "09:30" : "09:45",
    },
    entries: [],
    exits: [],
    errors: [],
    summary: {
      stocksScanned: 20,
      stocksWithSignals: 0,
      entryCount: 0,
      exitCount: 0,
      openPositions: 0,
      buyCount: 0,
      sellCount: 0,
      targetsHit: 0,
      avgProfit: null,
      errorCount: 0,
    },
  };
}

describe("useDayScanSimulation", () => {
  beforeEach(() => {
    fetchDayScanSimulationMock.mockReset();
    fetchDayScanSimulationMock.mockImplementation(async (_date, index) =>
      makePayload(index),
    );
  });

  it("starts in idle state and loads first candle on start", async () => {
    const { result } = renderHook(() => useDayScanSimulation("2026-06-09"));

    expect(result.current.status).toBe("idle");

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith("2026-06-09", 0, "all");
    expect(result.current.simulatedTimeIst).toBe("09:15");
  });

  it("passes the selected rule variant to the simulation API", async () => {
    const { result } = renderHook(() =>
      useDayScanSimulation("2026-06-09", "deeppro1"),
    );

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith(
      "2026-06-09",
      0,
      "deeppro1",
    );
  });

  it("pauses and resumes playback", async () => {
    const { result } = renderHook(() => useDayScanSimulation("2026-06-09"));

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.status).toBe("paused");

    await act(async () => {
      result.current.start();
    });

    expect(result.current.status).toBe("playing");
  });

  it("stops and resets to first candle", async () => {
    const { result } = renderHook(() => useDayScanSimulation("2026-06-09"));

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    await act(async () => {
      result.current.stop();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("idle");
    });

    expect(fetchDayScanSimulationMock).toHaveBeenLastCalledWith(
      "2026-06-09",
      0,
      "all",
    );
  });

  it("reloadLatest jumps to the newest session candle and completes", async () => {
    const { result } = renderHook(() => useDayScanSimulation("2026-06-09"));

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    await act(async () => {
      result.current.reloadLatest();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("complete");
    });

    expect(result.current.sessionIndex).toBe(2);
    expect(result.current.simulatedTimeIst).toBe("09:45");
    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith("2026-06-09", 2, "all");
  });
});
