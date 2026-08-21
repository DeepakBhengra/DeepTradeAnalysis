#!/usr/bin/env node
/**
 * Find RuleICICIGI "falling-knife" BUY-quality scenarios over ~60 trading days.
 *
 * Compares level-only BUY quality vs buyGuards (SMI/MACD turn + next-bar confirm
 * + open-drawdown cap), and ranks days like 2026-07-29 (setup that loses).
 *
 * Usage:
 *   npx tsx scripts/study-icicigi-falling-knife-60d.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { computeStochasticMomentum } from "../src/indicators/stochasticMomentum.js";
import { config } from "../src/config.js";
import {
  bbMatchGapPct,
  classifyBbBottomMatch,
  pctDistance,
} from "../src/rules/bollingerUtils.js";
import {
  evaluateBuyGuards,
  evaluateFavourableSymbolDay,
  getFavourableSymbolRuleConfig,
} from "../src/rules/favourableSymbolRule.js";
import { formatIstTime, getIstTimeParts } from "../src/utils/marketTime.js";
import type { Candle, IndicatorSnapshot } from "../src/types.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const YAHOO_SYMBOL = "ICICIGI.NS";
const SESSION_START = "09:15";
const SESSION_END = "15:30";
const SQUARE_OFF = "15:15";
const ENTRY_DEADLINE = "14:00";
const TARGET_TRADE_DAYS = 60;

type DayRow = {
  dateKey: string;
  dayLabel: string;
  weekday: string;
  /** First level-only BUY quality (ignores buyGuards). */
  levelSetup: {
    timeIst: string;
    price: number;
    rsi: number;
    smi: number;
    prevSmi: number | null;
    macdHist: number;
    prevMacdHist: number | null;
    bbLowerGapPct: number;
    dropFromOpenPct: number;
    nextMid: number | null;
    nextTimeIst: string | null;
    smiRising: boolean;
    macdRising: boolean;
    nextConfirmed: boolean;
    openDrawdownOk: boolean;
    guardOk: boolean;
    guardFailReasons: string[];
    bestSqPct: number | null;
    bestSqTimeIst: string | null;
    eodPct: number | null;
    losingLike29Jul: boolean;
  } | null;
  /** Actual RuleICICIGI day scan with buyGuards enabled. */
  guardedBuy: {
    timeIst: string;
    price: number;
    scenarioKey: string;
    bestSqPct: number | null;
    eodPct: number | null;
  } | null;
  guardedBlockedLevelBuy: boolean;
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mid(s: IndicatorSnapshot): number {
  return (s.high + s.low) / 2;
}

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

function weekdayName(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Asia/Kolkata",
  });
}

async function fetchYahoo15m(): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(YAHOO_SYMBOL)}?range=60d&interval=15m`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const payload = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: Array<number | null>;
            high?: Array<number | null>;
            low?: Array<number | null>;
            close?: Array<number | null>;
            volume?: Array<number | null>;
          }>;
        };
      }>;
    };
  };
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp?.length || !quote) {
    throw new Error("Yahoo returned no 15m bars for ICICIGI");
  }
  const candles: Candle[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }
    candles.push({
      timestamp: new Date(result.timestamp[i] * 1000),
      open,
      high,
      low,
      close,
      volume: quote.volume?.[i] ?? 0,
    });
  }
  return candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function bestSquareOff(
  snapshots: IndicatorSnapshot[],
  dateKey: string,
  entryTimeIst: string,
  entryPrice: number,
): { bestPct: number | null; bestTime: string | null; eodPct: number | null } {
  let bestPct: number | null = null;
  let bestTime: string | null = null;
  let eodPct: number | null = null;
  for (const s of snapshots) {
    const p = getIstTimeParts(s.timestamp);
    if (p.dateKey !== dateKey) continue;
    const t = formatIstTime(s.timestamp);
    if (!(t > entryTimeIst && t <= SQUARE_OFF)) continue;
    const pct = ((mid(s) - entryPrice) / entryPrice) * 100;
    if (bestPct == null || pct > bestPct) {
      bestPct = pct;
      bestTime = t;
    }
    eodPct = pct;
  }
  return { bestPct, bestTime, eodPct };
}

function nearLower(
  snapshot: IndicatorSnapshot,
  maxGap: number,
): { ok: boolean; gapPct: number } {
  const match = classifyBbBottomMatch(
    snapshot.bollinger.lower,
    snapshot.low,
    snapshot.close,
  );
  const gapPct = match
    ? bbMatchGapPct(match, "bottom", snapshot.bollinger.lower, snapshot.low, snapshot.close)
    : pctDistance(snapshot.bollinger.lower, snapshot.low, snapshot.close);
  return { ok: match != null || gapPct <= maxGap, gapPct };
}

async function main(): Promise<void> {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const rule = getFavourableSymbolRuleConfig("ruleIcicigi");
  const buyQ = rule.buyQuality;
  const guards = rule.buyGuards!;

  console.log(
    JSON.stringify({
      phase: "start",
      symbol: "ICICIGI",
      source: "yahoo-15m-60d",
      scenario: "falling-knife BUY quality vs buyGuards",
    }),
  );

  const candles = await fetchYahoo15m();
  const snapshots = buildIndicatorSnapshots(candles);
  const smiSeries = computeStochasticMomentum(
    snapshots.map((s) => s.high),
    snapshots.map((s) => s.low),
    snapshots.map((s) => s.close),
    rule.smi.lengthK,
    rule.smi.lengthD,
    rule.smi.lengthEma,
  );

  const allDates = [
    ...new Set(
      snapshots
        .filter((s) => {
          const t = formatIstTime(s.timestamp);
          return t >= SESSION_START && t <= SESSION_END;
        })
        .map((s) => getIstTimeParts(s.timestamp).dateKey),
    ),
  ].sort();

  const targetDates = allDates.slice(-TARGET_TRADE_DAYS);
  const rows: DayRow[] = [];

  for (const dateKey of targetDates) {
    const dayIndexes: number[] = [];
    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];
      if (
        !Number.isFinite(s.rsi) ||
        !Number.isFinite(s.bollinger.lower) ||
        !Number.isFinite(s.bollinger.upper)
      ) {
        continue;
      }
      const p = getIstTimeParts(s.timestamp);
      if (p.dateKey !== dateKey) continue;
      const t = formatIstTime(s.timestamp);
      if (t < SESSION_START || t > SESSION_END) continue;
      dayIndexes.push(i);
    }
    if (dayIndexes.length === 0) continue;

    const dayOpenMid = mid(snapshots[dayIndexes[0]]);
    let levelSetup: DayRow["levelSetup"] = null;

    for (const index of dayIndexes) {
      const s = snapshots[index];
      const timeIst = formatIstTime(s.timestamp);
      if (timeIst >= ENTRY_DEADLINE) break;
      const smi = smiSeries[index]?.smi;
      if (smi == null || !Number.isFinite(smi)) continue;
      if (s.rsi < buyQ.minRsi || s.rsi > buyQ.maxRsi) continue;
      if (smi > buyQ.maxSmi) continue;
      const bb = nearLower(s, buyQ.maxBbLowerGapPct);
      if (!bb.ok) continue;

      const prevSmi =
        index > 0 && smiSeries[index - 1]
          ? smiSeries[index - 1].smi
          : null;
      const prevMacd =
        index > 0 ? snapshots[index - 1].macd.histogram : null;
      const pos = dayIndexes.indexOf(index);
      const nextIndex = pos >= 0 && pos + 1 < dayIndexes.length ? dayIndexes[pos + 1] : null;
      const nextMid = nextIndex != null ? mid(snapshots[nextIndex]) : null;
      const nextTimeIst =
        nextIndex != null ? formatIstTime(snapshots[nextIndex].timestamp) : null;
      const setupMid = mid(s);
      const dropFromOpenPct = ((setupMid - dayOpenMid) / dayOpenMid) * 100;
      const smiRising = prevSmi != null && smi > prevSmi;
      const macdRising =
        prevMacd != null &&
        Number.isFinite(prevMacd) &&
        Number.isFinite(s.macd.histogram) &&
        s.macd.histogram > prevMacd;
      const nextConfirmed = nextMid != null && nextMid > setupMid;
      const openDrawdownOk =
        guards.maxOpenDrawdownPct == null ||
        !(dropFromOpenPct < -guards.maxOpenDrawdownPct);

      const guard = evaluateBuyGuards(
        { ...rule, buyGuards: guards },
        {
          smi,
          prevSmi: prevSmi != null && Number.isFinite(prevSmi) ? prevSmi : null,
          macdHist: s.macd.histogram,
          prevMacdHist:
            prevMacd != null && Number.isFinite(prevMacd) ? prevMacd : null,
          setupMid,
          dayOpenMid,
          nextMid,
        },
      );

      const failReasons: string[] = [];
      if (guards.requireSmiRising && !smiRising) failReasons.push("SMI not rising");
      if (guards.requireMacdHistRising && !macdRising) {
        failReasons.push("MACD hist not rising");
      }
      if (guards.requireNextBarConfirmation && !nextConfirmed) {
        failReasons.push("next bar not higher");
      }
      if (!openDrawdownOk) {
        failReasons.push(
          `open DD ${dropFromOpenPct.toFixed(2)}% < −${guards.maxOpenDrawdownPct}%`,
        );
      }

      const sq = bestSquareOff(snapshots, dateKey, timeIst, setupMid);
      const bestSqPct = sq.bestPct == null ? null : round(sq.bestPct);
      const eodPct = sq.eodPct == null ? null : round(sq.eodPct);
      const losingLike29Jul =
        (bestSqPct == null || bestSqPct <= 0) &&
        (eodPct == null || eodPct < 0);

      levelSetup = {
        timeIst,
        price: round(setupMid),
        rsi: round(s.rsi, 1),
        smi: round(smi, 1),
        prevSmi: prevSmi == null ? null : round(prevSmi, 1),
        macdHist: round(s.macd.histogram, 2),
        prevMacdHist: prevMacd == null ? null : round(prevMacd, 2),
        bbLowerGapPct: round(bb.gapPct, 3),
        dropFromOpenPct: round(dropFromOpenPct, 2),
        nextMid: nextMid == null ? null : round(nextMid),
        nextTimeIst,
        smiRising,
        macdRising,
        nextConfirmed,
        openDrawdownOk,
        guardOk: guard.ok,
        guardFailReasons: failReasons,
        bestSqPct,
        bestSqTimeIst: sq.bestTime,
        eodPct,
        losingLike29Jul,
      };
      break;
    }

    const guardedDay = evaluateFavourableSymbolDay(
      "ruleIcicigi",
      snapshots,
      dateKey,
    );
    const buy = guardedDay.signals.find((s) => s.side === "BUY") ?? null;
    let guardedBuy: DayRow["guardedBuy"] = null;
    if (buy) {
      const sq = bestSquareOff(snapshots, dateKey, buy.timeIst, buy.price);
      guardedBuy = {
        timeIst: buy.timeIst,
        price: round(buy.price),
        scenarioKey: buy.scenarioKey,
        bestSqPct: sq.bestPct == null ? null : round(sq.bestPct),
        eodPct: sq.eodPct == null ? null : round(sq.eodPct),
      };
    }

    rows.push({
      dateKey,
      dayLabel: formatDayLabel(dateKey),
      weekday: weekdayName(dateKey),
      levelSetup,
      guardedBuy,
      guardedBlockedLevelBuy: Boolean(levelSetup && !levelSetup.guardOk && !buy),
    });
  }

  const withLevel = rows.filter((r) => r.levelSetup);
  const losingKnives = withLevel.filter((r) => r.levelSetup!.losingLike29Jul);
  const blockedByGuards = withLevel.filter((r) => !r.levelSetup!.guardOk);
  const blockedLosers = losingKnives.filter((r) => !r.levelSetup!.guardOk);
  const passedGuards = withLevel.filter((r) => r.levelSetup!.guardOk);
  const guardedBuys = rows.filter((r) => r.guardedBuy);

  const md = [
    `# ICICIGI — falling-knife BUY quality scan (last ${targetDates.length} trade days)`,
    ``,
    `- **Window:** ${targetDates[0]} → ${targetDates[targetDates.length - 1]}`,
    `- **Source:** Yahoo Finance 15m (\`ICICIGI.NS\`, range=60d)`,
    `- **Level setup:** first RuleICICIGI BUY quality (RSI 30–50, SMI ≤ −40, BB lower ≤ 0.7%) before 14:00`,
    `- **Guards:** SMI rising + MACD hist rising + next-bar mid confirm + open DD ≤ 0.8%`,
    `- **“Like 29 Jul”:** level BUY where best same-day square-off ≤ 0% and EOD &lt; 0%`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `|---|---:|`,
    `| Trading days scanned | ${rows.length} |`,
    `| Days with level-only BUY quality | ${withLevel.length} |`,
    `| Level BUYs blocked by guards | ${blockedByGuards.length} |`,
    `| **Losing knives (like 29 Jul)** | **${losingKnives.length}** |`,
    `| Losing knives blocked by guards | ${blockedLosers.length} |`,
    `| Level setups that pass guards | ${passedGuards.length} |`,
    `| Days with guarded RuleICICIGI BUY (quality or extended) | ${guardedBuys.length} |`,
    ``,
    `## Losing knives (29 Jul–style)`,
    ``,
  ];

  if (losingKnives.length === 0) {
    md.push(`_None in this window._`, ``);
  } else {
    md.push(
      `| Date | Setup | Mid | RSI | SMI | Open DD | Next bar | Best SQ | EOD | Guards |`,
      `|---|---|---:|---:|---:|---:|---|---:|---:|---|`,
    );
    for (const r of losingKnives) {
      const s = r.levelSetup!;
      md.push(
        `| ${r.dayLabel} (${r.weekday}) | ${s.timeIst} | ${s.price.toFixed(2)} | ${s.rsi} | ${s.smi} | ${s.dropFromOpenPct}% | ${s.nextConfirmed ? `↑ ${s.nextTimeIst}` : `↓/none ${s.nextTimeIst ?? "—"}`} | ${s.bestSqPct ?? "—"}% | ${s.eodPct ?? "—"}% | ${s.guardOk ? "PASS" : s.guardFailReasons.join("; ")} |`,
      );
    }
    md.push(``);
  }

  md.push(
    `## All level-only BUY quality days`,
    ``,
    `| Date | Setup | Mid | RSI | SMI | ΔSMI | ΔMACD | Open DD | Confirm | Best SQ | EOD | Guard |`,
    `|---|---|---:|---:|---:|---|---|---:|:---:|---:|---:|---|`,
  );

  for (const r of withLevel) {
    const s = r.levelSetup!;
    const dSmi =
      s.prevSmi == null ? "—" : `${s.prevSmi}→${s.smi}${s.smiRising ? " ↑" : " ↓"}`;
    const dMacd =
      s.prevMacdHist == null
        ? "—"
        : `${s.prevMacdHist}→${s.macdHist}${s.macdRising ? " ↑" : " ↓"}`;
    md.push(
      `| ${r.dayLabel} (${r.weekday}) | ${s.timeIst} | ${s.price.toFixed(2)} | ${s.rsi} | ${s.smi} | ${dSmi} | ${dMacd} | ${s.dropFromOpenPct}% | ${s.nextConfirmed ? "Y" : "N"} | ${s.bestSqPct ?? "—"}% | ${s.eodPct ?? "—"}% | ${s.guardOk ? "**PASS**" : s.guardFailReasons.join("; ")} |`,
    );
  }

  md.push(
    ``,
    `## Guarded RuleICICIGI BUY signals (after filters)`,
    ``,
  );
  if (guardedBuys.length === 0) {
    md.push(`_No guarded BUY signals in this window._`, ``);
  } else {
    md.push(
      `| Date | Entry | Scenario | Price | Best SQ | EOD |`,
      `|---|---|---|---:|---:|---:|`,
    );
    for (const r of guardedBuys) {
      const b = r.guardedBuy!;
      md.push(
        `| ${r.dayLabel} (${r.weekday}) | ${b.timeIst} | ${b.scenarioKey} | ${b.price.toFixed(2)} | ${b.bestSqPct ?? "—"}% | ${b.eodPct ?? "—"}% |`,
      );
    }
    md.push(``);
  }

  md.push(
    `## Notes`,
    ``,
    `- 29 Jul pattern = level BUY quality while momentum still falling / next bar lower / deep open drawdown, then no positive same-day square-off.`,
    `- Guards are designed to block that class; a blocked loser is a win for the filter.`,
    `- Yahoo 15m covers ~60 calendar days of sessions; bar count may be slightly under 60 trade days near holidays.`,
    ``,
  );

  const outMd = resolve(REPORTS_DIR, "icicigi-falling-knife-60d.md");
  const outJson = resolve(REPORTS_DIR, "icicigi-falling-knife-60d.json");
  writeFileSync(outMd, md.join("\n"));
  writeFileSync(
    outJson,
    JSON.stringify(
      {
        symbol: "ICICIGI",
        source: "yahoo-15m-60d",
        from: targetDates[0] ?? null,
        to: targetDates[targetDates.length - 1] ?? null,
        tradingDays: rows.length,
        summary: {
          levelBuyDays: withLevel.length,
          blockedByGuards: blockedByGuards.length,
          losingKnives: losingKnives.length,
          losingKnivesBlocked: blockedLosers.length,
          levelSetupsPassingGuards: passedGuards.length,
          guardedBuyDays: guardedBuys.length,
        },
        rows,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        phase: "done",
        tradingDays: rows.length,
        levelBuyDays: withLevel.length,
        losingKnives: losingKnives.length,
        losingKnivesBlocked: blockedLosers.length,
        blockedByGuards: blockedByGuards.length,
        guardedBuyDays: guardedBuys.length,
        report: outMd,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
