import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDayScanSimulationPayload } from "../../src/api/buildDayScanSimulationPayload.js";
import {
  DayScanSimulationCache,
  getDayScanSessionCandles,
  truncateDayScanCandlesForIndex,
} from "../../src/api/dayScanSimulationCache.js";
import { SECTOR_WATCHLIST } from "../../src/symbols/sectorWatchlist.js";
import type { Candle, DeepakTradeSignal } from "../../src/types.js";

const {
  fetchPnbCandlesMock,
  evaluateDeepakDecisionMock,
  evaluateDeepak2DecisionMock,
  evaluateDeepakWatchPartyDecisionMock,
  evaluateDeeppro1DecisionMock,
} = vi.hoisted(() => ({
  fetchPnbCandlesMock: vi.fn(),
  evaluateDeepakDecisionMock: vi.fn(),
  evaluateDeepak2DecisionMock: vi.fn(),
  evaluateDeepakWatchPartyDecisionMock: vi.fn(),
  evaluateDeeppro1DecisionMock: vi.fn(),
}));

vi.mock("../../src/data/pnbFeed.js", () => ({
  fetchPnbCandles: fetchPnbCandlesMock,
}));

vi.mock("../../src/rules/deepakWatchParty.js", () => ({
  evaluateDeepakWatchPartyDecision: evaluateDeepakWatchPartyDecisionMock,
}));

vi.mock("../../src/rules/deeppro1Decision.js", () => ({
  evaluateDeeppro1Decision: evaluateDeeppro1DecisionMock,
}));

vi.mock("../../src/rules/deepakDecision.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/rules/deepakDecision.js")>();
  return {
    ...actual,
    evaluateDeepakDecision: evaluateDeepakDecisionMock,
    evaluateDeepak2Decision: evaluateDeepak2DecisionMock,
  };
});

function makeSessionCandles(sessionDate: string, count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const totalMinutes = 9 * 60 + 15 + index * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const close = 100 + index * 0.1;

    return {
      timestamp: new Date(
        `${sessionDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`,
      ),
      open: close - 0.2,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 1000 + index,
    };
  });
}

function makeCandlesWithWarmup(sessionDate: string, sessionCount: number): Candle[] {
  const warmup = makeSessionCandles("2026-06-07", 30);
  return [...warmup, ...makeSessionCandles(sessionDate, sessionCount)];
}

function makeSignal(timeIst: string, side: "BUY" | "SELL" = "SELL"): DeepakTradeSignal {
  return {
    side,
    scenarioKey: "deepak continue downward direction - 2",
    scenarioNumber: 4,
    timeIst,
    price: 100.5,
    bbMatchType: "crossed",
    profitTarget: 0.7,
    exit: null,
  };
}

describe("getDayScanSessionCandles", () => {
  it("includes candles from 09:15 through 15:00 and excludes 15:30", () => {
    const candles = makeSessionCandles("2026-06-09", 26);
    const sessionCandles = getDayScanSessionCandles(candles, "2026-06-09");

    expect(sessionCandles).toHaveLength(24);
    expect(sessionCandles[0]?.timestamp.toISOString()).toContain("03:45:00.000Z");
    expect(sessionCandles[sessionCandles.length - 1]?.timestamp.toISOString()).toContain(
      "09:30:00.000Z",
    );
  });
});

describe("truncateDayScanCandlesForIndex", () => {
  it("keeps warmup candles plus visible session slice", () => {
    const candles = makeCandlesWithWarmup("2026-06-09", 24);
    const truncated = truncateDayScanCandlesForIndex(candles, "2026-06-09", 1);

    expect(truncated.length).toBe(30 + 2);
  });

  it("does not place post-15:00 same-day candles before the visible session", () => {
    const warmup = makeSessionCandles("2026-06-08", 5);
    const sessionDay = makeSessionCandles("2026-06-09", 26);
    const candles = [...warmup, ...sessionDay];
    const truncated = truncateDayScanCandlesForIndex(candles, "2026-06-09", 23);

    const lastWarmup = truncated[warmup.length - 1];
    const firstSession = truncated[warmup.length];

    expect(lastWarmup?.timestamp.getTime()).toBeLessThan(firstSession?.timestamp.getTime() ?? 0);
    expect(truncated[truncated.length - 1]?.timestamp.toISOString()).toContain("09:30:00.000Z");
  });
});

describe("buildDayScanSimulationPayload", () => {
  const cache = new DayScanSimulationCache();

  beforeEach(() => {
    fetchPnbCandlesMock.mockReset();
    evaluateDeepakDecisionMock.mockReset();
    evaluateDeepak2DecisionMock.mockReset();
    evaluateDeepakWatchPartyDecisionMock.mockReset();
    evaluateDeeppro1DecisionMock.mockReset();
    cache.clear();

    fetchPnbCandlesMock.mockImplementation(async () =>
      makeCandlesWithWarmup("2026-06-09", 24),
    );
    evaluateDeepakDecisionMock.mockReturnValue(null);
    evaluateDeepak2DecisionMock.mockReturnValue(null);
    evaluateDeepakWatchPartyDecisionMock.mockReturnValue(null);
    evaluateDeeppro1DecisionMock.mockReturnValue(null);
  });

  it("returns simulation metadata at sessionIndex 0", async () => {
    const payload = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 0,
      cache,
    });

    expect(payload.simulation.sessionIndex).toBe(0);
    expect(payload.simulation.simulatedTimeIst).toBe("09:15");
    expect(payload.simulation.sessionCandleCount).toBe(24);
    expect(payload.summary.stocksScanned).toBe(SECTOR_WATCHLIST.length);
    expect(payload.marks.length).toBeGreaterThan(0);
    expect(payload.marks[0]).toEqual(
      expect.objectContaining({
        tradingSymbol: expect.any(String),
        price: expect.any(Number),
        timeIst: "09:15",
      }),
    );
  });

  it("reveals entry signals only when simulated time reaches entry time", async () => {
    let callCount = 0;
    evaluateDeepakDecisionMock.mockImplementation((_snapshots, dateKey) => {
      callCount += 1;
      if ((callCount - 1) % SECTOR_WATCHLIST.length !== 0 || dateKey !== "2026-06-09") {
        return null;
      }

      return {
        dateKey,
        decision: "SELL",
        activeScenario: null,
        scenarioTrail: [],
        signals: [makeSignal("10:15")],
        reasons: [],
        snapshot: {} as never,
      };
    });

    const early = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 3,
      cache,
    });
    const later = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 4,
      cache,
    });

    expect(early.simulation.simulatedTimeIst).toBe("10:00");
    expect(early.entries).toHaveLength(0);

    expect(later.simulation.simulatedTimeIst).toBe("10:15");
    expect(later.entries).toHaveLength(1);
    expect(later.entries[0]).toEqual(
      expect.objectContaining({
        strategy: "deepak",
        tradingSymbol: "HDFCBANK",
        entryTimeIst: "10:15",
        entryPrice: 100.5,
      }),
    );
  });

  it("tags deepak-2 strategy signals separately", async () => {
    let callCount = 0;
    evaluateDeepak2DecisionMock.mockImplementation(() => {
      callCount += 1;
      if ((callCount - 1) % SECTOR_WATCHLIST.length !== 0) {
        return null;
      }

      return {
        dateKey: "2026-06-09",
        decision: "BUY",
        activeScenario: null,
        scenarioTrail: [],
        signals: [makeSignal("10:15", "BUY")],
        reasons: [],
        snapshot: {} as never,
      };
    });

    const payload = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 4,
      cache,
    });

    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0]?.strategy).toBe("deepak-2");
    expect(payload.entries[0]?.side).toBe("BUY");
  });

  it("evaluates only Deeppro1 when variant=deeppro1", async () => {
    let callCount = 0;
    evaluateDeeppro1DecisionMock.mockImplementation(() => {
      callCount += 1;
      if ((callCount - 1) % SECTOR_WATCHLIST.length !== 0) {
        return null;
      }

      return {
        dateKey: "2026-06-09",
        decision: "SELL",
        activeScenario: null,
        scenarioTrail: [],
        signals: [
          {
            ...makeSignal("10:15"),
            scenarioKey: "deeppro1 sell SMI down-cross",
            profitTarget: 0.45,
            exit: {
              timeIst: "10:45",
              price: 99.8,
              targetHit: true,
              profit: 0.5,
              profitTarget: 0.45,
            },
          },
        ],
        reasons: [],
        snapshot: {} as never,
      };
    });

    const payload = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 6,
      cache,
      variant: "deeppro1",
    });

    expect(evaluateDeepakDecisionMock).not.toHaveBeenCalled();
    expect(evaluateDeepak2DecisionMock).not.toHaveBeenCalled();
    expect(evaluateDeepakWatchPartyDecisionMock).not.toHaveBeenCalled();
    expect(evaluateDeeppro1DecisionMock).toHaveBeenCalled();
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0]?.strategy).toBe("deeppro1");
    expect(payload.exits).toHaveLength(1);
    expect(payload.exits[0]?.strategy).toBe("deeppro1");
    expect(cache.getFrame("2026-06-09", "deeppro1", 6)).toBeDefined();
  });

  it("reveals exits only when simulated time reaches exit time", async () => {
    let callCount = 0;
    evaluateDeepakDecisionMock.mockImplementation(() => {
      callCount += 1;
      if ((callCount - 1) % SECTOR_WATCHLIST.length !== 0) {
        return null;
      }

      return {
        dateKey: "2026-06-09",
        decision: "SELL",
        activeScenario: null,
        scenarioTrail: [],
        signals: [
          {
            ...makeSignal("10:15"),
            exit: {
              timeIst: "10:45",
              price: 99.8,
              targetHit: true,
              profit: 0.7,
              profitTarget: 0.7,
            },
          },
        ],
        reasons: [],
        snapshot: {} as never,
      };
    });

    const beforeExit = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 5,
      cache,
    });
    const afterExit = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 6,
      cache,
    });

    expect(beforeExit.simulation.simulatedTimeIst).toBe("10:30");
    expect(beforeExit.entries).toHaveLength(1);
    expect(beforeExit.exits).toHaveLength(0);

    expect(afterExit.simulation.simulatedTimeIst).toBe("10:45");
    expect(afterExit.exits).toHaveLength(1);
    expect(afterExit.exits[0]).toEqual(
      expect.objectContaining({
        entryTimeIst: "10:15",
        entryPrice: 100.5,
        exitTimeIst: "10:45",
        exitPrice: 99.8,
        exitReason: "target",
        stopLossHit: false,
      }),
    );
  });

  it("throws when sessionIndex is out of range", async () => {
    await expect(
      buildDayScanSimulationPayload({
        date: "2026-06-09",
        sessionIndex: 99,
        cache,
      }),
    ).rejects.toThrow(/out of range/);
  });

  it("surfaces fetch failures instead of a generic no-session-candles message", async () => {
    fetchPnbCandlesMock.mockRejectedValue(
      new Error("Kite not connected. Click Connect Kite to log in, or set KITE_ACCESS_TOKEN in .env."),
    );

    await expect(
      buildDayScanSimulationPayload({
        date: "2026-06-09",
        sessionIndex: 0,
        cache,
      }),
    ).rejects.toThrow(/Kite not connected/);
  });

  it("retries prefetch after a failed attempt for the same date", async () => {
    fetchPnbCandlesMock.mockRejectedValue(new Error("temporary failure"));

    await expect(
      buildDayScanSimulationPayload({
        date: "2026-06-09",
        sessionIndex: 0,
        cache,
      }),
    ).rejects.toThrow(/temporary failure/);

    fetchPnbCandlesMock.mockReset();
    fetchPnbCandlesMock.mockImplementation(async () =>
      makeCandlesWithWarmup("2026-06-09", 24),
    );
    evaluateDeepakDecisionMock.mockReturnValue(null);
    evaluateDeepak2DecisionMock.mockReturnValue(null);
    evaluateDeepakWatchPartyDecisionMock.mockReturnValue(null);

    const payload = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 0,
      cache,
    });

    expect(payload.simulation.sessionCandleCount).toBe(24);
  }, 30_000);

  it("returns cached frame without re-evaluating on repeat request", async () => {
    await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 0,
      cache,
    });

    const callsAfterFirst = evaluateDeepakDecisionMock.mock.calls.length;

    await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 0,
      cache,
    });

    expect(evaluateDeepakDecisionMock.mock.calls.length).toBe(callsAfterFirst);
    expect(cache.getFrame("2026-06-09", "all", 0)).toBeDefined();
  });

  it("precomputes the next session frame in the background", async () => {
    await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 0,
      cache,
    });

    await vi.waitFor(
      () => {
        expect(cache.getFrame("2026-06-09", "all", 1)).toBeDefined();
      },
      { timeout: 10_000 },
    );

    const callsBeforeSecond = evaluateDeepakDecisionMock.mock.calls.length;

    await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 1,
      cache,
    });

    const callsAdded = evaluateDeepakDecisionMock.mock.calls.length - callsBeforeSecond;
    expect(callsAdded).toBeLessThanOrEqual(SECTOR_WATCHLIST.length);
    expect(cache.getFrame("2026-06-09", "all", 1)).toBeDefined();
  }, 30_000);

  it("refresh:true re-fetches candles so the session can grow mid-day", async () => {
    fetchPnbCandlesMock.mockImplementation(async () =>
      makeCandlesWithWarmup("2026-06-09", 18),
    );

    const first = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 0,
      cache,
    });
    expect(first.simulation.sessionCandleCount).toBe(18);
    expect(fetchPnbCandlesMock).toHaveBeenCalled();

    const callsAfterFirst = fetchPnbCandlesMock.mock.calls.length;

    // Without refresh, cache stays at 18 even if the feed would return more.
    fetchPnbCandlesMock.mockImplementation(async () =>
      makeCandlesWithWarmup("2026-06-09", 19),
    );
    const cached = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 0,
      cache,
    });
    expect(cached.simulation.sessionCandleCount).toBe(18);
    expect(fetchPnbCandlesMock.mock.calls.length).toBe(callsAfterFirst);

    const refreshed = await buildDayScanSimulationPayload({
      date: "2026-06-09",
      sessionIndex: 0,
      cache,
      refresh: true,
    });
    expect(refreshed.simulation.sessionCandleCount).toBe(19);
    expect(fetchPnbCandlesMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  }, 60_000);
});
