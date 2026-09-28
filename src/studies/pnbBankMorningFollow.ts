import { getIstTimeParts } from "../utils/marketTime.js";

export const MORNING_TIMES = [
  "09:15",
  "09:30",
  "09:45",
  "10:00",
  "10:15",
  "10:30",
] as const;

export type MorningTime = (typeof MORNING_TIMES)[number];
export type MorningTrend = "up" | "down" | "flat";
export type CandleColor = "green" | "red" | "doji";
export type GapDirection = "lower" | "upper" | "unchanged";

export interface TimedOhlcBar {
  dateKey: string;
  timeIst: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MorningBar {
  timeIst: MorningTime;
  open: number;
  high: number;
  low: number;
  close: number;
  color: CandleColor;
}

export interface SymbolMorningDay {
  date: string;
  stock: string;
  previousDayClose: number;
  openedVsPreviousClose: GapDirection;
  morningTrend: MorningTrend;
  bars: MorningBar[];
}

export interface FollowScore {
  peer: string;
  score: number;
  maxScore: number;
  gapMatch: boolean;
  colorMatches: number;
  colorSlots: number;
  morningTrendMatch: boolean;
}

export const PEER_STOCKS = [
  "HDFCBANK",
  "KOTAKBANK",
  "INDUSINDBK",
  "NIFTY BANK",
  "ICICIBANK",
] as const;

export type PeerStock = (typeof PEER_STOCKS)[number];

export function isMorningTime(timeIst: string): timeIst is MorningTime {
  return (MORNING_TIMES as readonly string[]).includes(timeIst);
}

export function classifyCandleColor(open: number, close: number): CandleColor {
  if (close > open) {
    return "green";
  }
  if (close < open) {
    return "red";
  }
  return "doji";
}

export function classifyGap(
  nextDay0915Price: number,
  previousDayClose: number,
): GapDirection {
  if (nextDay0915Price < previousDayClose) {
    return "lower";
  }
  if (nextDay0915Price > previousDayClose) {
    return "upper";
  }
  return "unchanged";
}

export function classifyMorningTrend(
  open0915: number,
  close1030: number,
): MorningTrend {
  if (close1030 > open0915) {
    return "up";
  }
  if (close1030 < open0915) {
    return "down";
  }
  return "flat";
}

export function barsByTime(
  day: SymbolMorningDay,
): Record<string, MorningBar | undefined> {
  return Object.fromEntries(day.bars.map((bar) => [bar.timeIst, bar]));
}

export function scoreFollow(
  pnb: SymbolMorningDay,
  peer: SymbolMorningDay,
): FollowScore {
  const pnbBars = barsByTime(pnb);
  const peerBars = barsByTime(peer);
  let score = 0;
  let maxScore = 0;
  let colorMatches = 0;
  let colorSlots = 0;

  maxScore += 3;
  const gapMatch = pnb.openedVsPreviousClose === peer.openedVsPreviousClose;
  if (gapMatch) {
    score += 3;
  }

  for (const time of MORNING_TIMES) {
    const left = pnbBars[time];
    const right = peerBars[time];
    if (!left || !right) {
      continue;
    }
    colorSlots += 1;
    maxScore += 1;
    if (left.color === right.color) {
      colorMatches += 1;
      score += 1;
    }
  }

  maxScore += 3;
  const morningTrendMatch = pnb.morningTrend === peer.morningTrend;
  if (morningTrendMatch) {
    score += 3;
  }

  return {
    peer: peer.stock,
    score,
    maxScore,
    gapMatch,
    colorMatches,
    colorSlots,
    morningTrendMatch,
  };
}

export function pickBestFollow(scores: FollowScore[]): FollowScore[] {
  if (scores.length === 0) {
    return [];
  }
  const best = Math.max(...scores.map((row) => row.score));
  return scores.filter((row) => row.score === best);
}

export function buildSymbolMorningDays(
  bars: TimedOhlcBar[],
  stock: string,
): SymbolMorningDay[] {
  const byDay = new Map<string, TimedOhlcBar[]>();
  for (const bar of bars) {
    if (bar.timeIst < "09:15" || bar.timeIst > "15:15") {
      continue;
    }
    const list = byDay.get(bar.dateKey) ?? [];
    list.push(bar);
    byDay.set(bar.dateKey, list);
  }

  const dateKeys = [...byDay.keys()].sort();
  const days: SymbolMorningDay[] = [];
  for (let i = 1; i < dateKeys.length; i++) {
    const previousBars = byDay.get(dateKeys[i - 1]) ?? [];
    const currentBars = byDay.get(dateKeys[i]) ?? [];
    const previousClose = previousBars[previousBars.length - 1]?.close;
    const openBar = currentBars.find((bar) => bar.timeIst === "09:15");
    if (previousClose == null || !openBar) {
      continue;
    }
    const morningBars: MorningBar[] = [];
    for (const time of MORNING_TIMES) {
      const bar = currentBars.find((candidate) => candidate.timeIst === time);
      if (!bar) {
        continue;
      }
      morningBars.push({
        timeIst: time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        color: classifyCandleColor(bar.open, bar.close),
      });
    }
    if (morningBars.length === 0) {
      continue;
    }
    const lastMorning = morningBars[morningBars.length - 1];
    days.push({
      date: dateKeys[i],
      stock,
      previousDayClose: previousClose,
      openedVsPreviousClose: classifyGap(openBar.open, previousClose),
      morningTrend: classifyMorningTrend(openBar.open, lastMorning.close),
      bars: morningBars,
    });
  }
  return days;
}

export function timedBarsFromCandles(
  candles: Array<{ timestamp: Date; open: number; high: number; low: number; close: number }>,
): TimedOhlcBar[] {
  return candles.map((candle) => {
    const parts = getIstTimeParts(candle.timestamp);
    return {
      dateKey: parts.dateKey,
      timeIst: `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    };
  });
}

export interface DayFollowRow {
  date: string;
  pnb: SymbolMorningDay;
  peers: SymbolMorningDay[];
  scores: FollowScore[];
  followed: string[];
}

export function buildDayFollowRows(
  byStock: Record<string, SymbolMorningDay[]>,
  pnbStock = "PNB",
  peers: readonly string[] = PEER_STOCKS,
): DayFollowRow[] {
  const pnbDays = byStock[pnbStock] ?? [];
  const peerMaps = Object.fromEntries(
    peers.map((peer) => [
      peer,
      new Map((byStock[peer] ?? []).map((day) => [day.date, day])),
    ]),
  ) as Record<string, Map<string, SymbolMorningDay>>;

  const rows: DayFollowRow[] = [];
  for (const pnb of pnbDays) {
    const peerDays: SymbolMorningDay[] = [];
    for (const peer of peers) {
      const day = peerMaps[peer]?.get(pnb.date);
      if (day) {
        peerDays.push(day);
      }
    }
    if (peerDays.length === 0) {
      continue;
    }
    const scores = peerDays.map((peer) => scoreFollow(pnb, peer));
    rows.push({
      date: pnb.date,
      pnb,
      peers: peerDays,
      scores,
      followed: pickBestFollow(scores).map((row) => row.peer),
    });
  }
  return rows;
}

export function barAtTime(
  day: SymbolMorningDay,
  time: string,
): MorningBar | undefined {
  return day.bars.find((bar) => bar.timeIst === time);
}

export function followsPeer(row: DayFollowRow, peer: string): boolean {
  return row.followed.includes(peer);
}

export function filterRowsFollowingPeer(
  rows: DayFollowRow[],
  peer: string,
): DayFollowRow[] {
  return rows.filter((row) => followsPeer(row, peer));
}

export function countFollowWins(rows: DayFollowRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const peer of PEER_STOCKS) {
    counts[peer] = 0;
  }
  for (const row of rows) {
    if (row.followed.length !== 1) {
      continue;
    }
    counts[row.followed[0]] = (counts[row.followed[0]] ?? 0) + 1;
  }
  return counts;
}

/** Counts days a peer is among the best match, including ties. */
export function countFollowAppearances(
  rows: DayFollowRow[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const peer of PEER_STOCKS) {
    counts[peer] = 0;
  }
  for (const row of rows) {
    for (const peer of row.followed) {
      counts[peer] = (counts[peer] ?? 0) + 1;
    }
  }
  return counts;
}
