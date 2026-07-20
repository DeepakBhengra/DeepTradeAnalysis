import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getIstTimeParts } from "../../src/utils/marketTime.js";

const mockGetHistoricalData = vi.fn();
const mockGetInstruments = vi.fn();
const mockSetAccessToken = vi.fn();

vi.mock("kiteconnect", () => ({
  KiteConnect: vi.fn().mockImplementation(() => ({
    setAccessToken: mockSetAccessToken,
    getInstruments: mockGetInstruments,
    getHistoricalData: mockGetHistoricalData,
  })),
}));

describe("pnbFeed", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("KITE_API_KEY", "test_key");
    vi.stubEnv("KITE_API_SECRET", "test_secret");
    vi.stubEnv("KITE_ACCESS_TOKEN", "test_token");
    mockGetHistoricalData.mockReset();
    mockGetInstruments.mockReset();
    mockSetAccessToken.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("parses timezone-ambiguous Kite date strings as IST", async () => {
    const { parseKiteDateAsIst } = await import("../../src/data/pnbFeed.js");
    const parsed = parseKiteDateAsIst("2026-06-18 09:15:00");
    const parts = getIstTimeParts(parsed);

    expect(parts.dateKey).toBe("2026-06-18");
    expect(parts.hour).toBe(9);
    expect(parts.minute).toBe(15);
  });

  it("parses Kite historical data into candles", async () => {
    mockGetInstruments.mockResolvedValue([
      {
        tradingsymbol: "PNB",
        instrument_type: "EQ",
        segment: "NSE",
        instrument_token: "12345",
      },
    ]);
    mockGetHistoricalData.mockResolvedValue([
      {
        date: new Date("2026-06-18T09:15:00+05:30"),
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
      },
      {
        date: new Date("2026-06-18T09:30:00+05:30"),
        open: 101,
        high: 103,
        low: 100,
        close: 102,
        volume: 1100,
      },
    ]);

    const { fetchPnbCandles } = await import("../../src/data/pnbFeed.js");
    const candles = await fetchPnbCandles({ symbol: "PNB" });

    expect(candles).toHaveLength(2);
    expect(candles[0].close).toBe(101);
    expect(candles[1].close).toBe(102);
    expect(mockSetAccessToken).toHaveBeenCalledWith("test_token");
    expect(mockGetHistoricalData).toHaveBeenCalledWith(
      12345,
      "15minute",
      expect.any(String),
      expect.any(String),
      false,
      false,
    );
  });

  it("accepts legacy Yahoo-style symbol aliases", async () => {
    mockGetInstruments.mockResolvedValue([
      {
        tradingsymbol: "PNB",
        instrument_type: "EQ",
        segment: "NSE",
        instrument_token: "12345",
      },
    ]);
    mockGetHistoricalData.mockResolvedValue([
      {
        date: new Date("2026-06-18T09:15:00+05:30"),
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
      },
    ]);

    const { fetchPnbCandles } = await import("../../src/data/pnbFeed.js");
    const candles = await fetchPnbCandles({ symbol: "PNB.NS" });

    expect(candles).toHaveLength(1);
    expect(mockGetInstruments).toHaveBeenCalledWith("NSE");
  });

  it("maps SBI alias to SBIN when fetching candles", async () => {
    mockGetInstruments.mockResolvedValue([
      {
        tradingsymbol: "SBIN",
        instrument_type: "EQ",
        segment: "NSE",
        instrument_token: "779521",
      },
    ]);
    mockGetHistoricalData.mockResolvedValue([
      {
        date: new Date("2026-06-18T09:15:00+05:30"),
        open: 800,
        high: 805,
        low: 798,
        close: 803,
        volume: 5000,
      },
    ]);

    const { fetchPnbCandles } = await import("../../src/data/pnbFeed.js");
    const candles = await fetchPnbCandles({ symbol: "SBI" });

    expect(candles).toHaveLength(1);
    expect(candles[0].close).toBe(803);
    expect(mockGetHistoricalData).toHaveBeenCalledWith(
      779521,
      "15minute",
      expect.any(String),
      expect.any(String),
      false,
      false,
    );
  });

  it("throws when credentials are missing", async () => {
    vi.unstubAllEnvs();
    vi.resetModules();

    const { fetchPnbCandles } = await import("../../src/data/pnbFeed.js");

    await expect(fetchPnbCandles()).rejects.toThrow(/Missing Kite API keys/);
  });

  it("retries transient Kite network failures before succeeding", async () => {
    vi.stubEnv("KITE_RETRY_DELAY_MS", "0");
    mockGetInstruments.mockResolvedValue([
      {
        tradingsymbol: "PNB",
        instrument_type: "EQ",
        segment: "NSE",
        instrument_token: "12345",
      },
    ]);
    mockGetHistoricalData
      .mockRejectedValueOnce({
        error_type: "NetworkException",
        message: "No response from server with error code: ECONNABORTED",
      })
      .mockResolvedValueOnce([
        {
          date: new Date("2026-06-18T09:15:00+05:30"),
          open: 100,
          high: 102,
          low: 99,
          close: 101,
          volume: 1000,
        },
      ]);

    const { fetchPnbCandles } = await import("../../src/data/pnbFeed.js");
    const candles = await fetchPnbCandles({ symbol: "PNB" });

    expect(candles).toHaveLength(1);
    expect(mockGetHistoricalData).toHaveBeenCalledTimes(2);
  });

  it("does not retry auth failures", async () => {
    vi.stubEnv("KITE_RETRY_DELAY_MS", "0");
    mockGetInstruments.mockResolvedValue([
      {
        tradingsymbol: "PNB",
        instrument_type: "EQ",
        segment: "NSE",
        instrument_token: "12345",
      },
    ]);
    mockGetHistoricalData.mockRejectedValue({
      status: 401,
      error_type: "TokenException",
      message: "Invalid access token",
    });

    const { fetchPnbCandles } = await import("../../src/data/pnbFeed.js");

    await expect(fetchPnbCandles()).rejects.toThrow(
      /Kite access_token expired or invalid/,
    );
    expect(mockGetHistoricalData).toHaveBeenCalledTimes(1);
  });

  it("preserves Kite error message for non-auth failures", async () => {
    mockGetInstruments.mockResolvedValue([
      {
        tradingsymbol: "PNB",
        instrument_type: "EQ",
        segment: "NSE",
        instrument_token: "12345",
      },
    ]);
    mockGetHistoricalData.mockRejectedValue({
      status: 429,
      error_type: "TooManyRequests",
      message: "Rate limit exceeded",
    });

    const { fetchPnbCandles } = await import("../../src/data/pnbFeed.js");

    await expect(fetchPnbCandles()).rejects.toThrow(/TooManyRequests: Rate limit exceeded/);
  });

  it("resolves NIFTY BANK index instruments and fetches candles", async () => {
    mockGetInstruments.mockResolvedValue([
      {
        tradingsymbol: "NIFTY BANK",
        instrument_type: "EQ",
        segment: "INDICES",
        instrument_token: "260105",
      },
    ]);
    mockGetHistoricalData.mockResolvedValue([
      {
        date: new Date("2026-06-18T09:15:00+05:30"),
        open: 52000,
        high: 52100,
        low: 51950,
        close: 52050,
        volume: 0,
      },
    ]);

    const { fetchPnbCandles } = await import("../../src/data/pnbFeed.js");
    const candles = await fetchPnbCandles({
      symbol: "NIFTY BANK",
      exchange: "NSE",
      segment: "INDICES",
    });

    expect(candles).toHaveLength(1);
    expect(candles[0].close).toBe(52050);
    expect(mockGetHistoricalData).toHaveBeenCalledWith(
      260105,
      "15minute",
      expect.any(String),
      expect.any(String),
      false,
      false,
    );
  });
});
