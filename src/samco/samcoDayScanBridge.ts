import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { DeepakDayScanTrade } from "../types.js";
import {
  getIstTimeParts,
  parseHmToMinutes,
} from "../utils/marketTime.js";
import {
  isSamcoRuleVariant,
  type SamcoRuleVariant,
} from "./samcoRuleVariant.js";
import type { SamcoStrategy } from "./signalKeys.js";

const SNAPSHOT_PATH = resolve(process.cwd(), "data/samco-day-scan-signals.json");

export interface SamcoDayScanTradeSignal {
  tradingSymbol: string;
  stockName: string;
  sector: string;
  side: "BUY" | "SELL";
  scenarioNumber: number;
  scenarioKey: string;
  entryTimeIst: string;
  entryPrice: number;
  exitTimeIst: string | null;
  exitPrice: number | null;
  targetHit: boolean;
  exitReason?: string | null;
  stopLossHit?: boolean;
}

export interface SamcoDayScanSignalSnapshot {
  date: string;
  variant: SamcoRuleVariant;
  strategy: SamcoStrategy;
  runAt: string;
  ingestedAt: string;
  trades: SamcoDayScanTradeSignal[];
}

export function dayScanVariantToSamcoStrategy(
  variant: string,
): SamcoStrategy | null {
  switch (variant) {
    case "deepak":
      return "deepak";
    case "deepak2":
      return "deepak2";
    case "deepak3":
      return "deepak3";
    case "watchParty":
      return "watchParty";
    case "deeppro":
      return "deeppro";
    case "deeppro1":
      return "deeppro1";
    default:
      return null;
  }
}

export function dayScanVariantToSamcoRuleVariant(
  variant: string,
): SamcoRuleVariant | null {
  if (isSamcoRuleVariant(variant)) {
    return variant;
  }
  return null;
}

function snapshotPath(): string {
  return SNAPSHOT_PATH;
}

export function loadSamcoDayScanSignalSnapshot(): SamcoDayScanSignalSnapshot | null {
  const filePath = snapshotPath();
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as SamcoDayScanSignalSnapshot;
    if (
      typeof parsed.date !== "string" ||
      !isSamcoRuleVariant(parsed.variant) ||
      !Array.isArray(parsed.trades)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSamcoDayScanSignalSnapshot(
  snapshot: SamcoDayScanSignalSnapshot,
): void {
  const filePath = snapshotPath();
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
}

/** Remove the ingested Day Scan feed so Samco panels stay empty until the next push. */
export function clearSamcoDayScanSignalSnapshot(): void {
  const filePath = snapshotPath();
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

export function ingestDayScanTrades(input: {
  date: string;
  variant: string;
  runAt?: string;
  trades: Array<Partial<DeepakDayScanTrade> & {
    tradingSymbol: string;
    side: "BUY" | "SELL";
    entryTimeIst: string;
    entryPrice: number;
  }>;
}): SamcoDayScanSignalSnapshot {
  const strategy = dayScanVariantToSamcoStrategy(input.variant);
  const ruleVariant = dayScanVariantToSamcoRuleVariant(input.variant);
  if (!strategy || !ruleVariant) {
    throw new Error(
      `Day Scan variant "${input.variant}" is not supported by Samco. Use deepak, deepak2, deepak3, watchParty, deeppro, or deeppro1.`,
    );
  }

  const trades: SamcoDayScanTradeSignal[] = input.trades.map((trade) => ({
    tradingSymbol: trade.tradingSymbol,
    stockName: trade.symbol ?? trade.tradingSymbol,
    sector: trade.sector ?? "",
    side: trade.side,
    scenarioNumber: trade.scenarioNumber ?? 1,
    scenarioKey: trade.scenarioKey ?? "",
    entryTimeIst: trade.entryTimeIst,
    entryPrice: trade.entryPrice,
    exitTimeIst: trade.exitTimeIst ?? null,
    exitPrice: trade.exitPrice ?? null,
    targetHit: trade.targetHit === true,
    exitReason: trade.exitReason ?? null,
    stopLossHit: trade.stopLossHit === true,
  }));

  const snapshot: SamcoDayScanSignalSnapshot = {
    date: input.date,
    variant: ruleVariant,
    strategy,
    runAt: input.runAt ?? new Date().toISOString(),
    ingestedAt: new Date().toISOString(),
    trades,
  };
  saveSamcoDayScanSignalSnapshot(snapshot);
  return snapshot;
}

/**
 * Latest fully closed NSE 15m candle open time (IST), e.g. at 10:22 → "10:00".
 */
export function latestClosedSessionCandleIst(now = new Date()): string | null {
  const { minutesOfDay } = getIstTimeParts(now);
  const sessionStart = parseHmToMinutes("09:15");
  const lastCandleOpen = parseHmToMinutes("14:45");

  // Candle labeled T closes at T+15. Need minutesOfDay >= sessionStart+15.
  if (minutesOfDay < sessionStart + 15) {
    return null;
  }

  const maxOpen = minutesOfDay - 15;
  let openMinutes = sessionStart + Math.floor((maxOpen - sessionStart) / 15) * 15;
  if (openMinutes > lastCandleOpen) {
    openMinutes = lastCandleOpen;
  }
  if (openMinutes < sessionStart) {
    return null;
  }

  const hour = Math.floor(openMinutes / 60);
  const minute = openMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function getDayScanSignalSourceSummary(now = new Date()): {
  date: string | null;
  variant: string | null;
  tradeCount: number;
  runAt: string | null;
  /** True when the ingested Day Scan date is today's IST session. */
  isToday: boolean;
} {
  const snapshot = loadSamcoDayScanSignalSnapshot();
  const today = getIstTimeParts(now).dateKey;
  if (!snapshot) {
    return { date: null, variant: null, tradeCount: 0, runAt: null, isToday: false };
  }
  return {
    date: snapshot.date,
    variant: snapshot.variant,
    tradeCount: snapshot.trades.length,
    runAt: snapshot.runAt,
    isToday: snapshot.date === today,
  };
}
