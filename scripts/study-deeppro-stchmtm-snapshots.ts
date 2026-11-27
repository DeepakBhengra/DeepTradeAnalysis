#!/usr/bin/env node
/**
 * Deeppro ≥0.75% hits for SUNPHARMA + LTM over 5 trade days,
 * exporting session Stch Mtm series for SMI↔signal cross snapshots.
 *
 * Uses current deeppro rules (`signalOnSmiCrossOnly` → eventKind smi_cross).
 */
import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { computeStochasticMomentum } from "../src/indicators/stochasticMomentum.js";
import { evaluateDeepproDay } from "../src/rules/deepproDecision.js";
import type { IndicatorSnapshot } from "../src/types.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";
import { formatUnknownError } from "../src/utils/formatError.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const ARTIFACTS_DIR = resolve("/opt/cursor/artifacts/deeppro-stchmtm-snapshots");
const SESSION_END = "15:15";

const SYMBOLS = ["SUNPHARMA", "LTM"];
/** Five NSE trade days with ≥0.75% hits for these symbols under cross-only deeppro. */
const TRADE_DAYS = [
  "2026-06-01",
  "2026-06-02",
  "2026-06-08",
  "2026-06-09",
  "2026-06-15",
];
/** Warmup start so SMI/BB/RSI/MACD are stable on the first trade day. */
const FETCH_FROM = "2026-04-20";
const MIN_PROFIT = 0.75;

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function midPrice(snapshot: IndicatorSnapshot): number {
  return (snapshot.high + snapshot.low) / 2;
}

function bestSquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  eventTimeIst: string,
  side: "BUY" | "SELL",
  entryPrice: number,
): { bestTimeIst: string | null; bestExitPrice: number | null; bestProfitPct: number | null } {
  let bestTimeIst: string | null = null;
  let bestExitPrice: number | null = null;
  let bestProfitPct: number | null = null;

  for (const snapshot of snapshots) {
    const parts = getIstTimeParts(snapshot.timestamp);
    if (parts.dateKey !== dateKey) continue;
    const timeIst = formatIstTime(snapshot.timestamp);
    if (timeIst <= eventTimeIst || timeIst > SESSION_END) continue;
    const exitPrice = midPrice(snapshot);
    const profitPct =
      side === "SELL"
        ? ((entryPrice - exitPrice) / entryPrice) * 100
        : ((exitPrice - entryPrice) / entryPrice) * 100;
    if (bestProfitPct == null || profitPct > bestProfitPct) {
      bestProfitPct = profitPct;
      bestExitPrice = exitPrice;
      bestTimeIst = timeIst;
    }
  }

  return {
    bestTimeIst,
    bestExitPrice: bestExitPrice == null ? null : round(bestExitPrice),
    bestProfitPct: bestProfitPct == null ? null : round(bestProfitPct),
  };
}

interface SessionBar {
  timeIst: string;
  open: number;
  high: number;
  low: number;
  close: number;
  smi: number | null;
  signal: number | null;
  rsi: number | null;
  bbUpper: number | null;
  bbLower: number | null;
}

interface HitSnapshot {
  symbol: string;
  dateKey: string;
  side: "BUY" | "SELL";
  crossTimeIst: string;
  eventTimeIst: string;
  eventKind: string;
  eventRsi: number;
  peakSmi: number;
  crossSmi: number;
  crossSignal: number;
  entryPrice: number;
  bestTimeIst: string | null;
  bestExitPrice: number | null;
  bestProfitPct: number | null;
  sessionBars: SessionBar[];
}

async function main(): Promise<void> {
  mkdirSync(REPORTS_DIR, { recursive: true });
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const toDate = TRADE_DAYS[TRADE_DAYS.length - 1];
  const hits: HitSnapshot[] = [];
  const errors: Array<{ symbol: string; error: string }> = [];

  console.log(
    JSON.stringify({
      phase: "start",
      symbols: SYMBOLS,
      tradeDays: TRADE_DAYS,
      minProfit: MIN_PROFIT,
      signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
    }),
  );

  for (const symbol of SYMBOLS) {
    try {
      const dash = resolveDashboardSymbol(symbol);
      const candles = await fetchPnbCandles({
        symbol: dash.tradingSymbol,
        exchange: dash.exchange,
        segment: dash.segment,
        fromDate: FETCH_FROM,
        toDate,
        kiteRetries: Math.max(config.dayScanKiteRetries, 3),
      });
      const snapshots = buildIndicatorSnapshots(candles);
      const highs = snapshots.map((s) => s.high);
      const lows = snapshots.map((s) => s.low);
      const closes = snapshots.map((s) => s.close);
      const smiSeries = computeStochasticMomentum(
        highs,
        lows,
        closes,
        config.deeppro.smi.lengthK,
        config.deeppro.smi.lengthD,
        config.deeppro.smi.lengthEma,
      );

      for (const dateKey of TRADE_DAYS) {
        const day = evaluateDeepproDay(snapshots, dateKey);
        for (const signal of day.signals) {
          const eventSnapshot = snapshots.find((snapshot) => {
            const parts = getIstTimeParts(snapshot.timestamp);
            return (
              parts.dateKey === signal.dateKey &&
              formatIstTime(snapshot.timestamp) === signal.eventTimeIst
            );
          });
          if (!eventSnapshot) continue;

          const entryPrice = round(midPrice(eventSnapshot));
          const sq = bestSquareOff(
            snapshots,
            signal.dateKey,
            signal.eventTimeIst,
            signal.side,
            entryPrice,
          );
          if (sq.bestProfitPct == null || sq.bestProfitPct < MIN_PROFIT) {
            continue;
          }

          const sessionBars: SessionBar[] = [];
          for (let i = 0; i < snapshots.length; i++) {
            const snapshot = snapshots[i];
            const parts = getIstTimeParts(snapshot.timestamp);
            if (parts.dateKey !== dateKey) continue;
            const smi = smiSeries[i];
            sessionBars.push({
              timeIst: formatIstTime(snapshot.timestamp),
              open: round(snapshot.open),
              high: round(snapshot.high),
              low: round(snapshot.low),
              close: round(snapshot.close),
              smi: Number.isFinite(smi.smi) ? round(smi.smi, 2) : null,
              signal: Number.isFinite(smi.signal) ? round(smi.signal, 2) : null,
              rsi: Number.isFinite(snapshot.rsi) ? round(snapshot.rsi, 2) : null,
              bbUpper: snapshot.bollinger
                ? round(snapshot.bollinger.upper, 2)
                : null,
              bbLower: snapshot.bollinger
                ? round(snapshot.bollinger.lower, 2)
                : null,
            });
          }

          hits.push({
            symbol,
            dateKey,
            side: signal.side,
            crossTimeIst: signal.timeIst,
            eventTimeIst: signal.eventTimeIst,
            eventKind: signal.eventKind,
            eventRsi: round(signal.eventRsi),
            peakSmi: round(signal.peakSmi, 2),
            crossSmi: round(signal.smi, 2),
            crossSignal: round(signal.smiSignal, 2),
            entryPrice,
            bestTimeIst: sq.bestTimeIst,
            bestExitPrice: sq.bestExitPrice,
            bestProfitPct: sq.bestProfitPct,
            sessionBars,
          });
        }
      }

      console.log(`[ok] ${symbol}`);
    } catch (error) {
      const message = formatUnknownError(error);
      console.log(`[error] ${symbol} ${message}`);
      errors.push({ symbol, error: message });
    }
  }

  hits.sort((a, b) => {
    const dateDiff = a.dateKey.localeCompare(b.dateKey);
    if (dateDiff !== 0) return dateDiff;
    const symDiff = a.symbol.localeCompare(b.symbol);
    if (symDiff !== 0) return symDiff;
    return (b.bestProfitPct ?? 0) - (a.bestProfitPct ?? 0);
  });

  const generatedAtUtc = new Date().toISOString();
  const payload = {
    rule: "deeppro",
    signalOnSmiCrossOnly: config.deeppro.signalOnSmiCrossOnly,
    symbols: SYMBOLS,
    tradeDays: TRADE_DAYS,
    minProfitPct: MIN_PROFIT,
    generatedAtUtc,
    hitCount: hits.length,
    errors,
    hits: hits.map(({ sessionBars, ...rest }) => ({
      ...rest,
      sessionBarCount: sessionBars.length,
    })),
    snapshots: hits,
  };

  const tag = `sunpharma-ltm-5days-gte${MIN_PROFIT}`;
  const jsonPath = resolve(REPORTS_DIR, `deeppro-stchmtm-${tag}.json`);
  const mdPath = resolve(REPORTS_DIR, `deeppro-stchmtm-${tag}.md`);
  const plotJsonPath = resolve(ARTIFACTS_DIR, `plot-data.json`);

  const lines = [
    `# Deeppro Stch Mtm snapshots — SUNPHARMA + LTM × 5 trade days (≥ ${MIN_PROFIT}%)`,
    "",
    `- **Stocks:** ${SYMBOLS.join(", ")}`,
    `- **Trade days:** ${TRADE_DAYS.join(", ")}`,
    `- **Rule:** deeppro SMI↔signal cross only (\`signalOnSmiCrossOnly\`)`,
    `- **Hit:** best same-day SQ mid before ${SESSION_END} IST ≥ ${MIN_PROFIT}%`,
    `- **Hits:** ${hits.length}`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Hits",
    "",
    "| Stock | Date | Side | Cross IST | Kind | Cross SMI / Signal | Peak/Trough | Entry | Best SQ | Profit % | Chart |",
    "|-------|------|------|-----------|------|--------------------|-------------|-------|---------|----------|-------|",
  ];

  for (const hit of hits) {
    const chartName = `${hit.symbol}_${hit.dateKey}_${hit.side}_${hit.crossTimeIst.replace(":", "")}.png`;
    lines.push(
      `| ${hit.symbol} | ${hit.dateKey} | ${hit.side} | ${hit.crossTimeIst} | ${hit.eventKind} | ${hit.crossSmi} / ${hit.crossSignal} | ${hit.peakSmi} | ${hit.entryPrice.toFixed(2)} | ${hit.bestTimeIst ?? "—"} | ${hit.bestProfitPct?.toFixed(2)}% | \`${chartName}\` |`,
    );
  }

  lines.push(
    "",
    "## How to read the Stch Mtm snapshot",
    "",
    "- Formula matches Zerodha **Stch Mtm (10, 3, 3)** (William Blau SMI)",
    "- **White** = SMI · **Red** = signal line",
    "- Vertical **gold** line + marker = exact SMI↔signal cross (the Deeppro entry)",
    "- Bottom panel zooms ±8 bars around the cross so the line intersection is clear",
    "- Shaded zone ≈ overbought (≥40) / oversold (≤-40)",
    "",
  );

  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(mdPath, `${lines.join("\n")}\n`);
  writeFileSync(plotJsonPath, `${JSON.stringify({ hits }, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        hitCount: hits.length,
        json: jsonPath,
        markdown: mdPath,
        plotData: plotJsonPath,
        errors,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
