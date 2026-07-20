import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDeepak3DayScanPayload } from "../../src/api/buildDeepak3DayScanPayload.js";
import { SECTOR_WATCHLIST } from "../../src/symbols/sectorWatchlist.js";
import type { Candle } from "../../src/types.js";

const { fetchPnbCandlesMock, scanDeepak3DecisionsMock } = vi.hoisted(() => ({
  fetchPnbCandlesMock: vi.fn(),
  scanDeepak3DecisionsMock: vi.fn(),
}));

vi.mock("../../src/data/pnbFeed.js", () => ({
  fetchPnbCandles: fetchPnbCandlesMock,
}));

vi.mock("../../src/rules/deepak3Decision.js", () => ({
  scanDeepak3Decisions: scanDeepak3DecisionsMock,
}));

function makeCandles(sessionDate: string, closes: number[]): Candle[] {
  return closes.map((close, index) => {
    const totalMinutes = 9 * 60 + 15 + index * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

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

describe("buildDeepak3DayScanPayload", () => {
  beforeEach(() => {
    fetchPnbCandlesMock.mockReset();
    scanDeepak3DecisionsMock.mockReset();
  });

  it(
    "aggregates Deepak-3 trades with confidence factors and symbol metadata",
    async () => {
      fetchPnbCandlesMock.mockResolvedValue(makeCandles("2026-06-09", [100, 100, 100, 100, 99]));

      scanDeepak3DecisionsMock.mockReturnValue({
        dateKey: "2026-06-09",
        sessionStart: "09:15",
        sessionEnd: "15:30",
        tradingSymbols: ["TCS", "MARUTI"],
        sectors: ["IT", "Automobile"],
        results: [
          {
            dateKey: "2026-06-09",
            decision: "SELL",
            activeScenario: null,
            scenarioTrail: [],
            reasons: [],
            snapshot: {} as never,
            confidenceFactors: ["G1: crossed anchor"],
            signals: [
              {
                side: "SELL",
                scenarioNumber: 4,
                scenarioKey: "deepak-3 continue downward direction - 2",
                timeIst: "10:15",
                price: 99.2,
                bbMatchType: "crossed",
                profitTarget: 0.7,
                confidenceFactors: [
                  "G1: crossed anchor",
                  "G2: continue direction - 2 only",
                  "G3: entry candle range >= profit target",
                  "G4: sector breadth (3 in IT)",
                ],
                exit: {
                  timeIst: "10:30",
                  price: 98.4,
                  targetHit: true,
                  profit: 0.8,
                  profitTarget: 0.7,
                },
              },
            ],
          },
          {
            dateKey: "2026-06-09",
            decision: "HOLD",
            activeScenario: null,
            scenarioTrail: [],
            reasons: [],
            snapshot: {} as never,
            confidenceFactors: [],
            signals: [],
          },
        ],
      });

      const payload = await buildDeepak3DayScanPayload({ date: "2026-06-09" });

      expect(payload.date).toBe("2026-06-09");
      expect(payload.summary.stocksScanned).toBe(SECTOR_WATCHLIST.length);
      expect(payload.trades).toHaveLength(1);
      expect(payload.trades[0]).toEqual(
        expect.objectContaining({
          tradingSymbol: "TCS",
          sector: "IT",
          side: "SELL",
          targetHit: true,
          confidenceFactors: expect.arrayContaining([
            "G1: crossed anchor",
            "G4: sector breadth (3 in IT)",
          ]),
        }),
      );
      expect(scanDeepak3DecisionsMock).toHaveBeenCalledOnce();
    },
    20_000,
  );

  it(
    "records per-symbol errors without aborting the scan",
    async () => {
      fetchPnbCandlesMock.mockRejectedValue(new Error("Kite token expired"));
      scanDeepak3DecisionsMock.mockReturnValue({
        dateKey: "2026-06-09",
        sessionStart: "09:15",
        sessionEnd: "15:30",
        tradingSymbols: [],
        sectors: [],
        results: [],
      });

      const payload = await buildDeepak3DayScanPayload({ date: "2026-06-09" });

      expect(payload.errors).toHaveLength(SECTOR_WATCHLIST.length);
      expect(payload.summary.errorCount).toBe(SECTOR_WATCHLIST.length);
      expect(payload.trades).toHaveLength(0);
    },
    20_000,
  );

  it("throws on invalid date", async () => {
    await expect(buildDeepak3DayScanPayload({ date: "bad-date" })).rejects.toThrow(
      /Invalid date format/,
    );
  });

  it(
    "passes only successfully fetched symbols into scanDeepak3Decisions",
    async () => {
      fetchPnbCandlesMock.mockImplementation(async (options: { symbol: string }) => {
        if (options.symbol === "TCS") {
          return makeCandles("2026-06-09", [100, 100, 100, 100, 99]);
        }
        throw new Error("fetch failed");
      });

      scanDeepak3DecisionsMock.mockReturnValue({
        dateKey: "2026-06-09",
        sessionStart: "09:15",
        sessionEnd: "15:30",
        tradingSymbols: [],
        sectors: [],
        results: [],
      });

      await buildDeepak3DayScanPayload({ date: "2026-06-09" });

      const scanArgs = scanDeepak3DecisionsMock.mock.calls[0]?.[0] as Array<{
        tradingSymbol: string;
      }>;
      expect(scanArgs.every((entry) => entry.tradingSymbol === "TCS")).toBe(true);
      expect(scanArgs.length).toBeLessThan(SECTOR_WATCHLIST.length);
    },
    20_000,
  );
});
