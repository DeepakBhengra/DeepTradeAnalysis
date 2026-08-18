import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SIMULATION_INTERVAL_MS,
  useDayScanSimulation,
} from "./useDayScanSimulation";

const { fetchDayScanSimulationMock } = vi.hoisted(() => ({
  fetchDayScanSimulationMock: vi.fn(),
}));

vi.mock("../api/client", () => ({
  fetchDayScanSimulation: fetchDayScanSimulationMock,
}));

function makePayload(
  sessionIndex: number,
  sessionCandleCount = 3,
  date = "2026-06-09",
) {
  const times = ["09:15", "09:30", "09:45", "10:00", "10:15"];
  return {
    date,
    simulation: {
      sessionIndex,
      sessionCandleCount,
      simulatedTimeIst: times[sessionIndex] ?? "09:15",
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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchDayScanSimulationMock.mockReset();
    fetchDayScanSimulationMock.mockImplementation(async (_date, index) =>
      makePayload(index),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
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

    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith(
      "2026-06-09",
      0,
      "all",
      undefined,
    );
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
      undefined,
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
      undefined,
    );
  });

  it("reloadLatest jumps to the newest session candle and completes on historical dates", async () => {
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
    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith(
      "2026-06-09",
      0,
      "all",
      { refresh: true },
    );
    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith(
      "2026-06-09",
      2,
      "all",
      undefined,
    );
  });

  it("does not mark complete mid-day when live candles are exhausted", async () => {
    // 2026-08-18 13:20 IST — live window still open; feed stuck at 2 candles.
    const now = () => new Date("2026-08-18T07:50:00.000Z");

    fetchDayScanSimulationMock.mockImplementation(async (date, index) =>
      makePayload(Math.min(index, 1), 2, date),
    );

    const { result } = renderHook(() =>
      useDayScanSimulation("2026-08-18", "all", now),
    );

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SIMULATION_INTERVAL_MS);
    });
    await waitFor(() => {
      expect(result.current.sessionIndex).toBe(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SIMULATION_INTERVAL_MS);
    });

    await waitFor(() => {
      expect(result.current.status).toBe("waiting");
    });
    expect(result.current.status).not.toBe("complete");
    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith(
      "2026-08-18",
      0,
      "all",
      { refresh: true },
    );
  });

  it("resumes playback when a live probe discovers a new candle", async () => {
    const now = () => new Date("2026-08-18T07:50:00.000Z");
    let candleCount = 2;

    fetchDayScanSimulationMock.mockImplementation(
      async (date, index, _variant, options) => {
        if (options?.refresh) {
          candleCount = 3;
        }
        return makePayload(
          Math.min(index, candleCount - 1),
          candleCount,
          date,
        );
      },
    );

    const { result } = renderHook(() =>
      useDayScanSimulation("2026-08-18", "all", now),
    );

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("playing");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SIMULATION_INTERVAL_MS);
    });
    await waitFor(() => {
      expect(result.current.sessionIndex).toBe(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SIMULATION_INTERVAL_MS);
    });

    // Immediate wait-probe force-refreshes, sees growth, resumes on candle 3.
    await waitFor(() => {
      expect(result.current.status).toBe("playing");
      expect(result.current.sessionIndex).toBe(2);
      expect(result.current.sessionCandleCount).toBe(3);
    });
    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith(
      "2026-08-18",
      0,
      "all",
      { refresh: true },
    );
  });

  it("reloadLatest keeps waiting while the live IST window is open", async () => {
    const now = () => new Date("2026-08-18T07:50:00.000Z"); // 13:20 IST
    fetchDayScanSimulationMock.mockImplementation(async (date, index) =>
      makePayload(index, 2, date),
    );

    const { result } = renderHook(() =>
      useDayScanSimulation("2026-08-18", "all", now),
    );

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
      expect(result.current.status).toBe("waiting");
    });

    expect(result.current.sessionIndex).toBe(1);
    expect(fetchDayScanSimulationMock).toHaveBeenCalledWith(
      "2026-08-18",
      0,
      "all",
      { refresh: true },
    );
  });
});
