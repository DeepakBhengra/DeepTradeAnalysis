import "../loadEnv.js";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  completeKiteLogin,
  getKiteAuthStatus,
  getKiteLoginUrl,
  setManualKiteAccessToken,
} from "../kite/kiteAuth.js";
import {
  getSamcoAuthStatus,
  initializeSamcoSession,
  refreshSamcoSession,
} from "../samco/samcoSession.js";
import { getSamcoPositions } from "../samco/samcoClient.js";
import {
  getSamcoLiveTradingEnabled,
  setSamcoLiveTradingEnabled,
} from "../samco/samcoLiveTrading.js";
import {
  loadPositionLedger,
  resetPositionLedger,
} from "../samco/positionLedger.js";
import {
  getSamcoDryRun,
  getSamcoRuntimeSettings,
  getSamcoRuleVariant,
  setSamcoDayQuantity,
  setSamcoDryRun,
  setSamcoEntryPriceRange,
  setSamcoRuleVariant,
  setSamcoStopLossPct,
} from "../samco/samcoRuntimeSettings.js";
import {
  clearSamcoDayScanSignalSnapshot,
  getDayScanSignalSourceSummary,
  ingestDayScanTrades,
  loadSamcoDayScanSignalSnapshot,
} from "../samco/samcoDayScanBridge.js";
import { buildSamcoOrdersFromLedger } from "../samco/samcoOrders.js";
import {
  appendSamcoTradeLogs,
  exportSamcoTradeLogsCsv,
  exportSamcoTradeLogsJson,
  getSamcoTradeLogs,
  resetSamcoTradeLogs,
} from "../samco/samcoTradeLog.js";
import {
  applyConfiguredStopLossAndReverse,
  processDayScanSignalSnapshot,
  squareOffLedgerBySignalKey,
} from "../samco/tradeExecutor.js";
import {
  loadPostMortemReport,
  loadSignalDaysIndex,
  savePostMortemReport,
  saveSignalDaysIndex,
} from "../postMortem/store.js";
import { getIstTimeParts } from "../utils/marketTime.js";
import { processLiveTradingCycle } from "../engine/liveTradingLoop.js";
import { startSamcoTradingPoll } from "./samcoPoll.js";
import {
  assertKiteCredentials,
  config,
  defaultDashboardSymbolId,
  resolveDashboardSymbol,
} from "../config.js";
import { formatUnknownError } from "../utils/formatError.js";
import { isValidAnalysisDate } from "../utils/marketTime.js";
import {
  clearKiteReturnToCookie,
  readKiteReturnToCookie,
  resolveKiteReturnTo,
  setKiteReturnToCookie,
} from "./kiteReturnTo.js";
import { SignalCache } from "./signalCache.js";
import { SimulationCache } from "./simulationCache.js";
import { buildDeepakBacktestPayload } from "./buildDeepakBacktestPayload.js";
import { buildDeepakDayScanPayload } from "./buildDeepakDayScanPayload.js";
import { buildDeepak2BacktestPayload } from "./buildDeepak2BacktestPayload.js";
import { buildDeepak2DayScanPayload } from "./buildDeepak2DayScanPayload.js";
import { buildDeepakWatchPartyBacktestPayload } from "./buildDeepakWatchPartyBacktestPayload.js";
import { buildDeepakWatchPartyDayScanPayload } from "./buildDeepakWatchPartyDayScanPayload.js";
import { buildDeepak3DayScanPayload } from "./buildDeepak3DayScanPayload.js";
import { buildDeepproBacktestPayload } from "./buildDeepproBacktestPayload.js";
import { buildDeepproDayScanPayload } from "./buildDeepproDayScanPayload.js";
import { buildDeeppro1BacktestPayload } from "./buildDeeppro1BacktestPayload.js";
import { buildDeeppro1DayScanPayload } from "./buildDeeppro1DayScanPayload.js";
import { buildRulePnbBacktestPayload } from "./buildRulePnbBacktestPayload.js";
import { buildRulePnbDayScanPayload } from "./buildRulePnbDayScanPayload.js";
import { buildRuleSunpharmaBacktestPayload } from "./buildRuleSunpharmaBacktestPayload.js";
import { buildRuleSunpharmaDayScanPayload } from "./buildRuleSunpharmaDayScanPayload.js";
import { buildRuleSunpharma1BacktestPayload } from "./buildRuleSunpharma1BacktestPayload.js";
import { buildRuleSunpharma1DayScanPayload } from "./buildRuleSunpharma1DayScanPayload.js";
import { buildFavourableSymbolBacktestPayload } from "./buildFavourableSymbolBacktestPayload.js";
import { buildFavourableSymbolDayScanPayload } from "./buildFavourableSymbolDayScanPayload.js";
import {
  getFavourableSymbolRuleConfig,
  isFavourableSymbolRuleId,
} from "../rules/favourableSymbolRule.js";
import {
  buildDayScanSimulationPayload,
} from "./buildDayScanSimulationPayload.js";
import { DayScanSimulationCache } from "./dayScanSimulationCache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDistPath = path.resolve(__dirname, "../../web/dist");
const port = Number(process.env.PORT ?? 3001);

const app = express();
const cache = new SignalCache();
const simulationCache = new SimulationCache();
const dayScanSimulationCache = new DayScanSimulationCache();

function disableSocketTimeout(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  req.socket?.setTimeout(0);
  res.setTimeout(0);
  next();
}

app.use(cors({
  origin: (origin, callback) => {
    if (
      origin == null ||
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
    ) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/api/kite/status", (_req, res) => {
  res.json(getKiteAuthStatus());
});

app.post("/api/kite/token", (req, res) => {
  try {
    const accessToken =
      typeof req.body?.accessToken === "string"
        ? req.body.accessToken
        : typeof req.body?.access_token === "string"
          ? req.body.access_token
          : "";

    const status = setManualKiteAccessToken(accessToken);
    cache.clear();
    simulationCache.clear();
    dayScanSimulationCache.clear();
    res.json(status);
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(400).json({ error: message });
  }
});

app.get("/api/kite/login", (req, res) => {
  try {
    const returnTo = resolveKiteReturnTo(
      typeof req.query.return_to === "string" ? req.query.return_to : undefined,
    );
    setKiteReturnToCookie(res, returnTo);
    res.redirect(getKiteLoginUrl());
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/kite/callback", async (req, res) => {
  try {
    const requestToken = req.query.request_token;
    if (typeof requestToken !== "string" || requestToken.length === 0) {
      res.status(400).send("Missing request_token from Kite callback.");
      return;
    }

    const session = await completeKiteLogin(requestToken);
    cache.clear();
    simulationCache.clear();
    dayScanSimulationCache.clear();

    const appUrl = resolveKiteReturnTo(readKiteReturnToCookie(req));
    clearKiteReturnToCookie(res);

    const redirectTarget = new URL(appUrl);
    redirectTarget.searchParams.set("kite", "connected");
    if (session.userName) {
      redirectTarget.searchParams.set("user", session.userName);
    }

    res.redirect(redirectTarget.toString());
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).send(`Kite login failed: ${message}`);
  }
});

app.get("/api/samco/status", async (_req, res) => {
  try {
    const status = await getSamcoAuthStatus();
    res.json(status);
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/samco/session/refresh", async (_req, res) => {
  try {
    const sessionToken = await refreshSamcoSession();
    res.json({
      connected: true,
      sessionTokenPresent: sessionToken.length > 0,
    });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

/**
 * Run one Samco trading cycle (Day Scan snapshot / poll), then return order buckets.
 * When clearPrevious=true (Refresh data), wipe ledger + trade logs + Day Scan feed
 * and return empty panels — do not rematerialize (that was making clear look broken).
 */
app.post("/api/samco/cycle", async (req, res) => {
  try {
    const clearPrevious = req.body?.clearPrevious === true;
    const logDate =
      typeof req.body?.logDate === "string" && req.body.logDate.trim().length > 0
        ? req.body.logDate.trim()
        : getIstTimeParts(new Date()).dateKey;

    if (clearPrevious) {
      resetPositionLedger();
      resetSamcoTradeLogs();
      clearSamcoDayScanSignalSnapshot();

      const ledger = loadPositionLedger();
      const buckets = buildSamcoOrdersFromLedger(ledger);
      res.json({
        ok: true,
        cleared: true,
        cycle: {
          processed: false,
          signalSource: "none",
          entriesPlaced: 0,
          exitsPlaced: 0,
          eodSquareOff: false,
          stocksScanned: 0,
          scanErrors: 0,
        },
        orders: {
          ...buckets,
          updatedAt: ledger.updatedAt,
          signalSource: getDayScanSignalSourceSummary(),
        },
        logs: {
          dateKey: logDate,
          records: [],
        },
        status: await getSamcoAuthStatus(),
      });
      return;
    }

    const today = getIstTimeParts(new Date()).dateKey;
    const snapshot = loadSamcoDayScanSignalSnapshot();
    const dryRun = getSamcoDryRun();
    const liveEnabled = getSamcoLiveTradingEnabled();
    let cycle = {
      processed: false,
      signalSource: "none" as "dayscan" | "poll" | "none",
      entriesPlaced: 0,
      exitsPlaced: 0,
      eodSquareOff: false,
      stocksScanned: 0,
      scanErrors: 0,
    };

    // Dry-run / historical / live-off: rematerialize the full Day Scan snapshot.
    // Live same-day: processLiveTradingCycle uses catch_up on the Day Scan feed.
    const shouldMaterializeFull =
      snapshot != null &&
      snapshot.variant === getSamcoRuleVariant() &&
      (snapshot.date !== today || dryRun || !liveEnabled);

    if (shouldMaterializeFull && snapshot) {
      const materialize = await processDayScanSignalSnapshot(snapshot, null, {
        mode: "full",
      });
      appendSamcoTradeLogs(materialize.logs, {
        dryRun: dryRun || !liveEnabled,
      });
      const stopLoss = await applyConfiguredStopLossAndReverse();
      if (stopLoss.logs.length > 0) {
        appendSamcoTradeLogs(stopLoss.logs, {
          dryRun: dryRun || !liveEnabled,
        });
      }
      cycle = {
        processed:
          materialize.entriesPlaced > 0 ||
          materialize.exitsPlaced > 0 ||
          stopLoss.entriesPlaced > 0 ||
          stopLoss.exitsPlaced > 0,
        signalSource: "dayscan",
        entriesPlaced: materialize.entriesPlaced + stopLoss.entriesPlaced,
        exitsPlaced: materialize.exitsPlaced + stopLoss.exitsPlaced,
        eodSquareOff: false,
        stocksScanned: new Set(
          snapshot.trades.map((trade) => trade.tradingSymbol),
        ).size,
        scanErrors: 0,
      };
    } else {
      const live = await processLiveTradingCycle();
      cycle = {
        processed: live.processed,
        signalSource: live.signalSource,
        entriesPlaced: live.entriesPlaced,
        exitsPlaced: live.exitsPlaced,
        eodSquareOff: live.eodSquareOff,
        stocksScanned: live.stocksScanned,
        scanErrors: live.scanErrors,
      };
    }

    const ledger = loadPositionLedger();
    const buckets = buildSamcoOrdersFromLedger(ledger);
    res.json({
      ok: true,
      cleared: false,
      cycle,
      orders: {
        ...buckets,
        updatedAt: ledger.updatedAt,
        signalSource: getDayScanSignalSourceSummary(),
      },
      logs: {
        dateKey: logDate,
        records: getSamcoTradeLogs(logDate),
      },
      status: await getSamcoAuthStatus(),
    });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/samco/positions", async (_req, res) => {
  try {
    const positions = await getSamcoPositions("DAY");
    res.json(positions);
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/samco/ledger", (_req, res) => {
  res.json(loadPositionLedger());
});

app.post("/api/samco/ledger/:signalKey/square-off", async (req, res) => {
  try {
    const signalKey = decodeURIComponent(req.params.signalKey ?? "").trim();
    if (!signalKey) {
      res.status(400).json({ error: "signalKey is required." });
      return;
    }

    const result = await squareOffLedgerBySignalKey(signalKey);
    const dryRun = getSamcoDryRun();
    const liveEnabled = getSamcoLiveTradingEnabled();
    if (result.logs.length > 0) {
      appendSamcoTradeLogs(result.logs, { dryRun: dryRun || !liveEnabled });
    }

    const ledger = loadPositionLedger();
    const buckets = buildSamcoOrdersFromLedger(ledger);
    res.json({
      ok: true,
      exitsPlaced: result.exitsPlaced,
      logs: result.logs,
      ledger,
      orders: {
        ...buckets,
        updatedAt: ledger.updatedAt,
        signalSource: getDayScanSignalSourceSummary(),
      },
      status: await getSamcoAuthStatus(),
    });
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("No ledger entry") ||
      message.includes("only open/closing")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/samco/orders", (_req, res) => {
  try {
    const ledger = loadPositionLedger();
    const buckets = buildSamcoOrdersFromLedger(ledger);
    res.json({
      ...buckets,
      updatedAt: ledger.updatedAt,
      signalSource: getDayScanSignalSourceSummary(),
    });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/samco/day-scan-signals", (_req, res) => {
  try {
    const snapshot = loadSamcoDayScanSignalSnapshot();
    res.json({
      snapshot,
      summary: getDayScanSignalSourceSummary(),
    });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/samco/day-scan-signals", async (req, res) => {
  try {
    const date = typeof req.body?.date === "string" ? req.body.date : "";
    const variant = typeof req.body?.variant === "string" ? req.body.variant : "";
    const runAt = typeof req.body?.runAt === "string" ? req.body.runAt : undefined;
    const trades = Array.isArray(req.body?.trades) ? req.body.trades : null;

    if (!date || !variant || trades == null) {
      res.status(400).json({
        error: "Body must include date, variant, and trades[].",
      });
      return;
    }

    const snapshot = ingestDayScanTrades({ date, variant, runAt, trades });
    // Keep Samco rule variant aligned with the Day Scan run that feeds it.
    setSamcoRuleVariant(snapshot.variant);

    const dryRun = getSamcoDryRun();
    const liveEnabled = getSamcoLiveTradingEnabled();
    // Explicit Day Scan Run always full-applies the pushed trades into the ledger
    // (and placeOrder when LIVE). Re-runs are idempotent by signal key.
    // Live poll uses catch-up for incremental same-day updates between scans.
    const applied = await processDayScanSignalSnapshot(snapshot, null, {
      mode: "full",
    });
    // Rescans that only skip already-applied keys produce no new trade-log rows.
    if (applied.logs.length > 0) {
      appendSamcoTradeLogs(applied.logs, { dryRun: dryRun || !liveEnabled });
    }

    const stopLoss = await applyConfiguredStopLossAndReverse();
    if (stopLoss.logs.length > 0) {
      appendSamcoTradeLogs(stopLoss.logs, { dryRun: dryRun || !liveEnabled });
    }

    res.json({
      ok: true,
      snapshot,
      materialize: {
        mode: "full",
        entriesPlaced: applied.entriesPlaced + stopLoss.entriesPlaced,
        exitsPlaced: applied.exitsPlaced + stopLoss.exitsPlaced,
        entriesSkipped: applied.entriesSkipped,
      },
      settings: {
        ...getSamcoRuntimeSettings(),
        liveTradingEnabled: getSamcoLiveTradingEnabled(),
      },
    });
  } catch (error) {
    const message = formatUnknownError(error);
    const status = message.includes("not supported by Samco") ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/samco/settings", (_req, res) => {
  try {
    res.json({
      ...getSamcoRuntimeSettings(),
      liveTradingEnabled: getSamcoLiveTradingEnabled(),
    });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.patch("/api/samco/settings", (req, res) => {
  try {
    const dryRun = req.body?.dryRun;
    const quantity = req.body?.quantity;
    const entryPriceMin = req.body?.entryPriceMin;
    const entryPriceMax = req.body?.entryPriceMax;
    const ruleVariant = req.body?.ruleVariant;
    const stopLossPct = req.body?.stopLossPct;
    const confirmLive = req.body?.confirmLive === true;

    if (dryRun !== undefined && typeof dryRun !== "boolean") {
      res.status(400).json({ error: "dryRun must be a boolean when provided." });
      return;
    }

    if (quantity !== undefined && typeof quantity !== "number") {
      res.status(400).json({ error: "quantity must be a number when provided." });
      return;
    }

    if (entryPriceMin !== undefined && typeof entryPriceMin !== "number") {
      res.status(400).json({ error: "entryPriceMin must be a number when provided." });
      return;
    }

    if (entryPriceMax !== undefined && typeof entryPriceMax !== "number") {
      res.status(400).json({ error: "entryPriceMax must be a number when provided." });
      return;
    }

    if (ruleVariant !== undefined && typeof ruleVariant !== "string") {
      res.status(400).json({ error: "ruleVariant must be a string when provided." });
      return;
    }

    if (
      stopLossPct !== undefined &&
      stopLossPct !== null &&
      typeof stopLossPct !== "number"
    ) {
      res.status(400).json({
        error: "stopLossPct must be a number or null when provided.",
      });
      return;
    }

    if (
      (entryPriceMin !== undefined && entryPriceMax === undefined) ||
      (entryPriceMin === undefined && entryPriceMax !== undefined)
    ) {
      res.status(400).json({
        error: "entryPriceMin and entryPriceMax must be provided together.",
      });
      return;
    }

    const enablingLiveRisk =
      dryRun === false && getSamcoLiveTradingEnabled();

    if (enablingLiveRisk && !confirmLive) {
      res.status(400).json({
        error:
          "Disabling dry-run while live trading is enabled requires confirmLive: true.",
      });
      return;
    }

    if (typeof dryRun === "boolean") {
      setSamcoDryRun(dryRun);
    }

    if (typeof quantity === "number") {
      setSamcoDayQuantity(quantity);
    }

    if (typeof entryPriceMin === "number" && typeof entryPriceMax === "number") {
      setSamcoEntryPriceRange(entryPriceMin, entryPriceMax);
    }

    if (typeof ruleVariant === "string") {
      setSamcoRuleVariant(ruleVariant);
    }

    if (stopLossPct === null || typeof stopLossPct === "number") {
      setSamcoStopLossPct(stopLossPct);
    }

    res.json({
      ...getSamcoRuntimeSettings(),
      liveTradingEnabled: getSamcoLiveTradingEnabled(),
    });
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("Quantity must") ||
      message.includes("Entry price") ||
      message.includes("Stop-loss") ||
      message.includes("Invalid ruleVariant")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/samco/logs", (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
    const dateKey = dateParam ?? getIstTimeParts(new Date()).dateKey;

    if (!isValidAnalysisDate(dateKey)) {
      res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
      return;
    }

    res.json({
      dateKey,
      records: getSamcoTradeLogs(dateKey),
    });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/samco/logs/download", (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
    const formatParam =
      typeof req.query.format === "string" ? req.query.format : "csv";
    const dateKey = dateParam ?? getIstTimeParts(new Date()).dateKey;

    if (!isValidAnalysisDate(dateKey)) {
      res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
      return;
    }

    if (formatParam === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="samco-logs-${dateKey}.json"`,
      );
      res.send(exportSamcoTradeLogsJson(dateKey));
      return;
    }

    if (formatParam !== "csv") {
      res.status(400).json({ error: "format must be csv or json." });
      return;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="samco-logs-${dateKey}.csv"`,
    );
    res.send(exportSamcoTradeLogsCsv(dateKey));
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.post("/api/samco/live-trading", (req, res) => {
  try {
    const enabled = req.body?.enabled;
    const confirmLive = req.body?.confirmLive === true;

    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "Body must include boolean enabled." });
      return;
    }

    if (enabled && !getSamcoRuntimeSettings().dryRun && !confirmLive) {
      res.status(400).json({
        error:
          "Enabling live trading while dry-run is off requires confirmLive: true.",
      });
      return;
    }

    setSamcoLiveTradingEnabled(enabled);
    res.json({ liveTradingEnabled: enabled });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;

    if (dateParam && !isValidAnalysisDate(dateParam)) {
      res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
      return;
    }

    let dashboardSymbol;
    try {
      dashboardSymbol = resolveDashboardSymbol(symbolParam ?? defaultDashboardSymbolId);
    } catch (error) {
      const message = formatUnknownError(error);
      res.status(400).json({ error: message });
      return;
    }

    const payload = await cache.get(dashboardSymbol, dateParam);
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/dashboard/simulate", async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const sessionIndexParam =
      typeof req.query.sessionIndex === "string" ? req.query.sessionIndex : undefined;

    if (!dateParam || !isValidAnalysisDate(dateParam)) {
      res.status(400).json({ error: "Invalid or missing date. Use YYYY-MM-DD." });
      return;
    }

    if (sessionIndexParam == null || !/^\d+$/.test(sessionIndexParam)) {
      res.status(400).json({ error: "Missing or invalid sessionIndex (non-negative integer)." });
      return;
    }

    const sessionIndex = Number(sessionIndexParam);

    let dashboardSymbol;
    try {
      dashboardSymbol = resolveDashboardSymbol(symbolParam ?? defaultDashboardSymbolId);
    } catch (error) {
      const message = formatUnknownError(error);
      res.status(400).json({ error: message });
      return;
    }

    try {
      const payload = await simulationCache.getPayload(
        dashboardSymbol,
        dateParam,
        sessionIndex,
      );
      res.json(payload);
    } catch (error) {
      if (error instanceof RangeError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/backtest/deepak-2/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeepak2DayScanPayload({ date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/deepak-watch-party/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeepakWatchPartyDayScanPayload({ date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/deepak-3/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeepak3DayScanPayload({ date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/deeppro/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeepproDayScanPayload({ date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/deeppro1/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeeppro1DayScanPayload({ date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/rule-pnb/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildRulePnbDayScanPayload({ date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/rule-pnb", async (req, res) => {
  try {
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
    const toParam = typeof req.query.to === "string" ? req.query.to : undefined;

    if (!fromParam || !toParam) {
      res.status(400).json({ error: "Missing from or to date. Use YYYY-MM-DD." });
      return;
    }

    // RulePNB is PNB-only — never accept/mix other symbols.
    const payload = await buildRulePnbBacktestPayload({
      symbol: symbolParam ?? config.rulePnb.tradingSymbol,
      fromDate: fromParam,
      toDate: toParam,
    });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid") ||
      message.includes("symbol") ||
      message.includes("PNB-only")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/rule-sunpharma/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildRuleSunpharmaDayScanPayload({ date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/rule-sunpharma", async (req, res) => {
  try {
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
    const toParam = typeof req.query.to === "string" ? req.query.to : undefined;

    if (!fromParam || !toParam) {
      res.status(400).json({ error: "Missing from or to date. Use YYYY-MM-DD." });
      return;
    }

    // RuleSUNPHARMA is SUNPHARMA-only — never accept/mix other symbols.
    const payload = await buildRuleSunpharmaBacktestPayload({
      symbol: symbolParam ?? config.ruleSunpharma.tradingSymbol,
      fromDate: fromParam,
      toDate: toParam,
    });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid") ||
      message.includes("symbol") ||
      message.includes("SUNPHARMA-only")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

/** RuleSUNPHARMA1 — API only; not wired to Day Scan / Post-Mortem widgets. */
app.get("/api/backtest/rule-sunpharma1/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildRuleSunpharma1DayScanPayload({ date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/rule-sunpharma1", async (req, res) => {
  try {
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
    const toParam = typeof req.query.to === "string" ? req.query.to : undefined;

    if (!fromParam || !toParam) {
      res.status(400).json({ error: "Missing from or to date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildRuleSunpharma1BacktestPayload({
      symbol: symbolParam ?? config.ruleSunpharma1.tradingSymbol,
      fromDate: fromParam,
      toDate: toParam,
    });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid") ||
      message.includes("symbol") ||
      message.includes("SUNPHARMA-only")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});


app.get("/api/backtest/symbol-rule/:ruleId/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const ruleIdRaw = typeof req.params.ruleId === "string" ? req.params.ruleId : "";
    // Accept slug (ltm) or camel id (ruleLtm)
    const normalized =
      ruleIdRaw === "ltm" ? "ruleLtm"
      : ruleIdRaw === "icicigi" ? "ruleIcicigi"
      : ruleIdRaw === "techm" ? "ruleTechm"
      : ruleIdRaw === "tvsmotor" ? "ruleTvsmotor"
      : ruleIdRaw === "policybzr" ? "rulePolicybzr"
      : ruleIdRaw;
    if (!isFavourableSymbolRuleId(normalized)) {
      res.status(400).json({ error: "Unknown symbol rule. Use ltm, icicigi, techm, tvsmotor, or policybzr." });
      return;
    }
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }
    const payload = await buildFavourableSymbolDayScanPayload({ ruleId: normalized, date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status = message.includes("date") || message.includes("Invalid") ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/symbol-rule/:ruleId", async (req, res) => {
  try {
    const ruleIdRaw = typeof req.params.ruleId === "string" ? req.params.ruleId : "";
    const normalized =
      ruleIdRaw === "ltm" ? "ruleLtm"
      : ruleIdRaw === "icicigi" ? "ruleIcicigi"
      : ruleIdRaw === "techm" ? "ruleTechm"
      : ruleIdRaw === "tvsmotor" ? "ruleTvsmotor"
      : ruleIdRaw === "policybzr" ? "rulePolicybzr"
      : ruleIdRaw;
    if (!isFavourableSymbolRuleId(normalized)) {
      res.status(400).json({ error: "Unknown symbol rule. Use ltm, icicigi, techm, tvsmotor, or policybzr." });
      return;
    }
    const rule = getFavourableSymbolRuleConfig(normalized);
    const symbolParam = typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
    const toParam = typeof req.query.to === "string" ? req.query.to : undefined;
    if (!fromParam || !toParam) {
      res.status(400).json({ error: "Missing from or to date. Use YYYY-MM-DD." });
      return;
    }
    const payload = await buildFavourableSymbolBacktestPayload({
      ruleId: normalized,
      symbol: symbolParam ?? rule.tradingSymbol,
      fromDate: fromParam,
      toDate: toParam,
    });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid") ||
      message.includes("symbol") ||
      message.includes("-only")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});


app.get("/api/backtest/deeppro", async (req, res) => {
  try {
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
    const toParam = typeof req.query.to === "string" ? req.query.to : undefined;

    if (!fromParam || !toParam) {
      res.status(400).json({ error: "Missing from or to date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeepproBacktestPayload({
      symbol: symbolParam ?? defaultDashboardSymbolId,
      fromDate: fromParam,
      toDate: toParam,
    });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("symbol") ||
      message.includes("Invalid") ||
      message.includes("Enter a valid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/deeppro1", async (req, res) => {
  try {
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
    const toParam = typeof req.query.to === "string" ? req.query.to : undefined;

    if (!fromParam || !toParam) {
      res.status(400).json({ error: "Missing from or to date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeeppro1BacktestPayload({
      symbol: symbolParam ?? defaultDashboardSymbolId,
      fromDate: fromParam,
      toDate: toParam,
    });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("symbol") ||
      message.includes("Invalid") ||
      message.includes("Enter a valid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/deepak-2", async (req, res) => {
  try {
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
    const toParam = typeof req.query.to === "string" ? req.query.to : undefined;

    if (!fromParam || !toParam) {
      res.status(400).json({ error: "Missing from or to date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeepak2BacktestPayload({
      symbol: symbolParam ?? defaultDashboardSymbolId,
      fromDate: fromParam,
      toDate: toParam,
    });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("symbol") ||
      message.includes("Invalid") ||
      message.includes("Enter a valid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/deepak-watch-party", async (req, res) => {
  try {
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
    const toParam = typeof req.query.to === "string" ? req.query.to : undefined;

    if (!fromParam || !toParam) {
      res.status(400).json({ error: "Missing from or to date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeepakWatchPartyBacktestPayload({
      symbol: symbolParam ?? defaultDashboardSymbolId,
      fromDate: fromParam,
      toDate: toParam,
    });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("symbol") ||
      message.includes("Invalid") ||
      message.includes("Enter a valid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/deepak/day-scan", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!dateParam) {
      res.status(400).json({ error: "Missing date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeepakDayScanPayload({ date: dateParam });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("Invalid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/backtest/day-scan/simulate", disableSocketTimeout, async (req, res) => {
  try {
    const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
    const sessionIndexParam =
      typeof req.query.sessionIndex === "string" ? req.query.sessionIndex : undefined;
    const variantParam =
      typeof req.query.variant === "string" ? req.query.variant : undefined;

    if (!dateParam || !isValidAnalysisDate(dateParam)) {
      res.status(400).json({ error: "Invalid or missing date. Use YYYY-MM-DD." });
      return;
    }

    if (sessionIndexParam == null || !/^\d+$/.test(sessionIndexParam)) {
      res.status(400).json({ error: "Missing or invalid sessionIndex (non-negative integer)." });
      return;
    }

    const sessionIndex = Number(sessionIndexParam);

    try {
      const payload = await buildDayScanSimulationPayload({
        date: dateParam,
        sessionIndex,
        cache: dayScanSimulationCache,
        variant: variantParam,
      });
      res.json(payload);
    } catch (error) {
      if (error instanceof RangeError) {
        res.status(400).json({ error: error.message });
        return;
      }
      throw error;
    }
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(500).json({ error: message });
  }
});

app.get("/api/backtest/deepak", async (req, res) => {
  try {
    const symbolParam =
      typeof req.query.symbol === "string" ? req.query.symbol : undefined;
    const fromParam = typeof req.query.from === "string" ? req.query.from : undefined;
    const toParam = typeof req.query.to === "string" ? req.query.to : undefined;

    if (!fromParam || !toParam) {
      res.status(400).json({ error: "Missing from or to date. Use YYYY-MM-DD." });
      return;
    }

    const payload = await buildDeepakBacktestPayload({
      symbol: symbolParam ?? defaultDashboardSymbolId,
      fromDate: fromParam,
      toDate: toParam,
    });
    res.json(payload);
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("date") ||
      message.includes("symbol") ||
      message.includes("Invalid") ||
      message.includes("Enter a valid")
        ? 400
        : 500;
    res.status(status).json({ error: message });
  }
});

app.get("/api/post-mortem/signal-days", (req, res) => {
  try {
    const symbol = typeof req.query.symbol === "string" ? req.query.symbol : "";
    const fromDate = typeof req.query.from === "string" ? req.query.from : "";
    const toDate = typeof req.query.to === "string" ? req.query.to : "";
    const variant = typeof req.query.variant === "string" ? req.query.variant : "deepak";

    if (!symbol || !fromDate || !toDate) {
      res.status(400).json({ error: "Missing symbol, from, or to." });
      return;
    }

    const stored = loadSignalDaysIndex(symbol, variant, fromDate, toDate);
    if (!stored) {
      res.status(404).json({ error: "No cached signal-days index." });
      return;
    }
    res.json({ source: "cache" as const, ...stored });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(message.includes("Invalid") ? 400 : 500).json({ error: message });
  }
});

app.put("/api/post-mortem/signal-days", (req, res) => {
  try {
    const body = req.body as {
      symbol?: string;
      variant?: string;
      fromDate?: string;
      toDate?: string;
      days?: unknown;
      tradingDaysScanned?: number;
      totalSignals?: number;
    };

    if (
      !body.symbol ||
      !body.variant ||
      !body.fromDate ||
      !body.toDate ||
      !Array.isArray(body.days)
    ) {
      res.status(400).json({ error: "Missing symbol, variant, fromDate, toDate, or days." });
      return;
    }

    const saved = saveSignalDaysIndex({
      symbol: body.symbol,
      variant: body.variant,
      fromDate: body.fromDate,
      toDate: body.toDate,
      days: body.days as never,
      tradingDaysScanned: Number(body.tradingDaysScanned ?? 0),
      totalSignals: Number(body.totalSignals ?? 0),
    });
    res.json({ source: "saved" as const, ...saved });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(message.includes("Invalid") ? 400 : 500).json({ error: message });
  }
});

app.get("/api/post-mortem/report", (req, res) => {
  try {
    const symbol = typeof req.query.symbol === "string" ? req.query.symbol : "";
    const date = typeof req.query.date === "string" ? req.query.date : "";
    const variant = typeof req.query.variant === "string" ? req.query.variant : "deepak";

    if (!symbol || !date) {
      res.status(400).json({ error: "Missing symbol or date." });
      return;
    }

    const stored = loadPostMortemReport(symbol, date, variant);
    if (!stored) {
      res.status(404).json({ error: "No cached post-mortem report." });
      return;
    }
    res.json({ source: "cache" as const, ...stored });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(message.includes("Invalid") ? 400 : 500).json({ error: message });
  }
});

app.put("/api/post-mortem/report", (req, res) => {
  try {
    const body = req.body as {
      symbol?: string;
      date?: string;
      variant?: string;
      mode?: string;
      report?: unknown;
      series?: unknown[];
    };

    if (!body.symbol || !body.date || !body.variant || body.report == null) {
      res.status(400).json({ error: "Missing symbol, date, variant, or report." });
      return;
    }

    const saved = savePostMortemReport({
      symbol: body.symbol,
      date: body.date,
      variant: body.variant,
      mode: body.mode ?? "historical",
      report: body.report,
      series: Array.isArray(body.series) ? body.series : [],
    });
    res.json({ source: "saved" as const, savedAt: saved.savedAt, symbol: saved.symbol, date: saved.date, variant: saved.variant });
  } catch (error) {
    const message = formatUnknownError(error);
    res.status(message.includes("Invalid") || message.includes("Missing") ? 400 : 500).json({
      error: message,
    });
  }
});

app.use(express.static(webDistPath));

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found. Restart the API server." });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(webDistPath, "index.html"), (error) => {
    if (error) {
      next(error);
    }
  });
});

cache.startAutoRefresh();
startSamcoTradingPoll();

void initializeSamcoSession();

app.listen(port, () => {
  console.log(`Market analysis API running on http://localhost:${port}`);
  console.log(`Kite callback URL: ${getKiteAuthStatus().redirectUrl}`);
}).on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Stop the old API server (taskkill /F /PID <pid>) and run npm run dev:api again.`,
    );
    process.exit(1);
  }
  throw error;
});
