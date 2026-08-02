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
import { loadPositionLedger } from "../samco/positionLedger.js";
import {
  getSamcoRuntimeSettings,
  setSamcoDayQuantity,
  setSamcoDryRun,
  setSamcoEntryPriceRange,
} from "../samco/samcoRuntimeSettings.js";
import {
  exportSamcoTradeLogsCsv,
  exportSamcoTradeLogsJson,
  getSamcoTradeLogs,
} from "../samco/samcoTradeLog.js";
import {
  loadPostMortemReport,
  loadSignalDaysIndex,
  savePostMortemReport,
  saveSignalDaysIndex,
} from "../postMortem/store.js";
import { getIstTimeParts } from "../utils/marketTime.js";
import { startSamcoTradingPoll } from "./samcoPoll.js";
import {
  assertKiteCredentials,
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
import { buildDeepproDayScanPayload } from "./buildDeepproDayScanPayload.js";
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

    res.json({
      ...getSamcoRuntimeSettings(),
      liveTradingEnabled: getSamcoLiveTradingEnabled(),
    });
  } catch (error) {
    const message = formatUnknownError(error);
    const status =
      message.includes("Quantity must") ||
      message.includes("Entry price")
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
