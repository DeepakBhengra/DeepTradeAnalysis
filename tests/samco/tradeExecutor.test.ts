import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DeepakDecisionResult, DeepakTradeSignal } from "../../src/types.js";

function buildSignal(
  overrides: Partial<DeepakTradeSignal> = {},
): DeepakTradeSignal {
  return {
    side: "BUY",
    scenarioKey: "bearish_continue_2",
    scenarioNumber: 2,
    timeIst: "10:30",
    price: 120,
    bbMatchType: "close_inside",
    profitTarget: 0.7,
    exit: null,
    ...overrides,
  };
}

function buildDecision(
  signals: DeepakTradeSignal[],
): DeepakDecisionResult {
  return {
    dateKey: "2026-06-29",
    decision: "BUY",
    activeScenario: null,
    scenarioTrail: [],
    signals,
    reasons: [],
    snapshot: {} as DeepakDecisionResult["snapshot"],
  };
}

async function loadTradeExecutorModules() {
  const client = await import("../../src/samco/samcoClient.js");
  const ledger = await import("../../src/samco/positionLedger.js");
  const liveTrading = await import("../../src/samco/samcoLiveTrading.js");
  const runtimeSettings = await import("../../src/samco/samcoRuntimeSettings.js");
  const tradeExecutor = await import("../../src/samco/tradeExecutor.js");
  return { ...client, ...ledger, ...liveTrading, ...runtimeSettings, ...tradeExecutor };
}

describe("tradeExecutor", () => {
  let tempDir = "";
  let originalCwd = "";

  beforeEach(() => {
    vi.resetModules();
    tempDir = mkdtempSync(join(tmpdir(), "samco-ledger-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    mkdirSync(join(tempDir, "data"), { recursive: true });
    process.env.SAMCO_LEDGER_PATH = join(tempDir, "ledger.json");
    process.env.SAMCO_DRY_RUN = "true";
    process.env.SAMCO_LIVE_TRADING_ENABLED = "false";
    process.env.SAMCO_API_KEY = "";
    process.env.SAMCO_API_SECRET = "";
    process.env.SAMCO_ENTRY_PRICE_MIN = "0";
    process.env.SAMCO_ENTRY_PRICE_MAX = "3900";
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("places a dry-run entry once for a new signal", async () => {
    const { resetPositionLedger, processDecisionResult } =
      await loadTradeExecutorModules();
    resetPositionLedger();

    const signal = buildSignal();
    const result = await processDecisionResult(
      "deepak",
      buildDecision([signal]),
      "10:30",
      { dryRun: true, liveTradingEnabled: false },
    );

    expect(result.entriesPlaced).toBe(1);
    expect(result.logs.some((log) => log.message.includes("Dry-run entry"))).toBe(
      true,
    );

    const secondPass = await processDecisionResult(
      "deepak",
      buildDecision([signal]),
      "10:30",
      { dryRun: true, liveTradingEnabled: false },
    );

    expect(secondPass.entriesPlaced).toBe(0);
  });

  it("dry-runs square-off when exit signal is present", async () => {
    const { resetPositionLedger, processDecisionResult } =
      await loadTradeExecutorModules();
    resetPositionLedger();

    const openSignal = buildSignal();
    await processDecisionResult(
      "deepak",
      buildDecision([openSignal]),
      "10:30",
      { dryRun: true, liveTradingEnabled: false },
    );

    const closedSignal = buildSignal({
      exit: {
        timeIst: "11:00",
        price: 120.7,
        targetHit: true,
        profit: 0.7,
        profitTarget: 0.7,
        exitReason: "target",
      },
    });

    const exitResult = await processDecisionResult(
      "deepak",
      buildDecision([closedSignal]),
      "11:00",
      { dryRun: true, liveTradingEnabled: false },
    );

    expect(exitResult.exitsPlaced).toBe(1);
    expect(exitResult.logs.some((log) => log.message.includes("Dry-run square-off"))).toBe(
      true,
    );
  });

  it("calls Samco place order API when live trading is enabled", async () => {
    process.env.SAMCO_API_KEY = "key";
    process.env.SAMCO_API_SECRET = "secret";
    process.env.SAMCO_DRY_RUN = "false";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/session/token")) {
        return new Response(
          JSON.stringify({
            status: "Success",
            sessionToken: "session-abc",
          }),
          { status: 200 },
        );
      }

      if (url.includes("/order/placeOrder")) {
        return new Response(
          JSON.stringify({
            status: "Success",
            orderNumber: "12345",
          }),
          { status: 200 },
        );
      }

      if (url.includes("/order/getOrderStatus")) {
        return new Response(
          JSON.stringify({
            status: "Success",
            orderStatus: "EXECUTED",
            orderDetails: {
              filledQuantity: "100",
              avgExecutionPrice: "120.5",
            },
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ status: "Success" }), { status: 200 });
    });

    const { setSamcoFetch, resetPositionLedger, processDecisionResult } =
      await loadTradeExecutorModules();
    setSamcoFetch(fetchMock as typeof fetch);
    resetPositionLedger();

    const signal = buildSignal();
    const result = await processDecisionResult(
      "deepak",
      buildDecision([signal]),
      "10:30",
      { dryRun: false, liveTradingEnabled: true },
    );

    expect(result.entriesPlaced).toBe(1);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/order/placeOrder")),
    ).toBe(true);
  });

  it("skips entries above configured max entry price", async () => {
    const { resetPositionLedger, processDecisionResult, setSamcoEntryPriceRange } =
      await loadTradeExecutorModules();
    setSamcoEntryPriceRange(0, 3900);
    resetPositionLedger();

    const signal = buildSignal({ price: 4000 });
    const result = await processDecisionResult(
      "deepak",
      buildDecision([signal]),
      "10:30",
      { dryRun: true, liveTradingEnabled: false, tradingSymbol: "HDFCBANK" },
    );

    expect(result.entriesPlaced).toBe(0);
    expect(result.logs.some((log) => log.message.includes("outside price range"))).toBe(
      true,
    );
  });

  it("skips entries below configured min entry price", async () => {
    const { resetPositionLedger, processDecisionResult, setSamcoEntryPriceRange } =
      await loadTradeExecutorModules();
    setSamcoEntryPriceRange(500, 3900);
    resetPositionLedger();

    const signal = buildSignal({ price: 120 });
    const result = await processDecisionResult(
      "deepak",
      buildDecision([signal]),
      "10:30",
      { dryRun: true, liveTradingEnabled: false, tradingSymbol: "PNB" },
    );

    expect(result.entriesPlaced).toBe(0);
    expect(result.logs.some((log) => log.message.includes("outside price range"))).toBe(
      true,
    );
  });

  it("allows entries within configured price range", async () => {
    const { resetPositionLedger, processDecisionResult, setSamcoEntryPriceRange } =
      await loadTradeExecutorModules();
    setSamcoEntryPriceRange(100, 3900);
    resetPositionLedger();

    const signal = buildSignal({ price: 3850 });
    const result = await processDecisionResult(
      "deepak",
      buildDecision([signal]),
      "10:30",
      { dryRun: true, liveTradingEnabled: false, tradingSymbol: "MARUTI" },
    );

    expect(result.entriesPlaced).toBe(1);
  });

  it("skips poll entry signals whose timing has already passed", async () => {
    const { resetPositionLedger, processDecisionResult } =
      await loadTradeExecutorModules();
    resetPositionLedger();

    const signal = buildSignal({ timeIst: "10:15" });
    const result = await processDecisionResult(
      "deepak",
      buildDecision([signal]),
      "10:30",
      { dryRun: true, liveTradingEnabled: false },
    );

    expect(result.entriesPlaced).toBe(0);
  });

  it("skips poll exit signals whose timing has already passed", async () => {
    const { resetPositionLedger, processDecisionResult } =
      await loadTradeExecutorModules();
    resetPositionLedger();

    await processDecisionResult(
      "deepak",
      buildDecision([buildSignal()]),
      "10:30",
      { dryRun: true, liveTradingEnabled: false },
    );

    const closedSignal = buildSignal({
      exit: {
        timeIst: "11:00",
        price: 120.7,
        targetHit: true,
        profit: 0.7,
        profitTarget: 0.7,
        exitReason: "target",
      },
    });

    const exitResult = await processDecisionResult(
      "deepak",
      buildDecision([closedSignal]),
      "11:15",
      { dryRun: true, liveTradingEnabled: false },
    );

    expect(exitResult.exitsPlaced).toBe(0);
  });

  it("Day Scan places entry only at the current candle timing", async () => {
    const { resetPositionLedger, processDayScanSignalSnapshot } =
      await loadTradeExecutorModules();
    resetPositionLedger();

    const result = await processDayScanSignalSnapshot(
      {
        strategy: "deepak",
        trades: [
          {
            tradingSymbol: "RELIANCE",
            stockName: "Reliance",
            side: "BUY",
            scenarioNumber: 2,
            entryTimeIst: "10:30",
            entryPrice: 120,
            exitTimeIst: null,
            exitPrice: null,
            targetHit: false,
          },
          {
            tradingSymbol: "TCS",
            stockName: "TCS",
            side: "BUY",
            scenarioNumber: 2,
            entryTimeIst: "10:15",
            entryPrice: 130,
            exitTimeIst: null,
            exitPrice: null,
            targetHit: false,
          },
        ],
      },
      "10:30",
    );

    expect(result.entriesPlaced).toBe(1);
    expect(
      result.logs.some(
        (log) =>
          log.message.includes("Dry-run entry") &&
          log.message.includes("RELIANCE"),
      ),
    ).toBe(true);
  });

  it("Day Scan places exit only at the current candle timing", async () => {
    const { resetPositionLedger, processDayScanSignalSnapshot } =
      await loadTradeExecutorModules();
    resetPositionLedger();

    await processDayScanSignalSnapshot(
      {
        strategy: "deepak",
        trades: [
          {
            tradingSymbol: "RELIANCE",
            stockName: "Reliance",
            side: "BUY",
            scenarioNumber: 2,
            entryTimeIst: "10:30",
            entryPrice: 120,
            exitTimeIst: null,
            exitPrice: null,
            targetHit: false,
          },
        ],
      },
      "10:30",
    );

    const pastExit = await processDayScanSignalSnapshot(
      {
        strategy: "deepak",
        trades: [
          {
            tradingSymbol: "RELIANCE",
            stockName: "Reliance",
            side: "BUY",
            scenarioNumber: 2,
            entryTimeIst: "10:30",
            entryPrice: 120,
            exitTimeIst: "11:00",
            exitPrice: 120.7,
            targetHit: true,
            exitReason: "target",
          },
        ],
      },
      "11:15",
    );
    expect(pastExit.exitsPlaced).toBe(0);

    const currentExit = await processDayScanSignalSnapshot(
      {
        strategy: "deepak",
        trades: [
          {
            tradingSymbol: "RELIANCE",
            stockName: "Reliance",
            side: "BUY",
            scenarioNumber: 2,
            entryTimeIst: "10:30",
            entryPrice: 120,
            exitTimeIst: "11:00",
            exitPrice: 120.7,
            targetHit: true,
            exitReason: "target",
          },
        ],
      },
      "11:00",
    );
    expect(currentExit.exitsPlaced).toBe(1);
  });
});
