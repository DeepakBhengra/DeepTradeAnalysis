export type GapDirection = "lower" | "upper" | "unchanged";
export type DayTrend = "downtrend" | "uptrend" | "flat";
export type CandleColor = "green" | "red" | "doji";

export interface SessionDayBars {
  dateKey: string;
  open0915: number;
  close0915: number;
  high0915: number;
  low0915: number;
  close: number;
  high: number;
  highTimeIst: string;
  low: number;
  lowTimeIst: string;
}

export interface SessionBar {
  timeIst: string;
  high: number;
  low: number;
}

export interface PnbOpenGapRow {
  date: string;
  stock: string;
  previousDayClose: number;
  nextDay0915Price: number;
  openedVsPreviousClose: GapDirection;
  dayTrend: DayTrend;
  sessionClose: number;
  nextDayHigh: number;
  nextDayHighTimeIst: string;
  nextDayLow: number;
  nextDayLowTimeIst: string;
  candle0915Color: CandleColor;
  candle0915High: number;
  candle0915Low: number;
  candle0915Close: number;
  candle0915HighCrossedPrevCloseUp: boolean;
  candle0915LowCrossedPrevCloseDown: boolean;
  gapPct: number;
  trendPct: number;
  matchesGapDownAndDowntrend: boolean;
  matchesGapUpAndUptrend: boolean;
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

/**
 * Intraday trend from the 09:15 print to that session's close.
 * Downtrend = closed below 09:15; uptrend = closed above 09:15.
 */
/** First 15m bar that printed the session high / low. */
export function sessionHighLow(bars: SessionBar[]): {
  high: number;
  highTimeIst: string;
  low: number;
  lowTimeIst: string;
} | null {
  if (bars.length === 0) {
    return null;
  }
  let high = bars[0].high;
  let highTimeIst = bars[0].timeIst;
  let low = bars[0].low;
  let lowTimeIst = bars[0].timeIst;
  for (const bar of bars) {
    if (bar.high > high) {
      high = bar.high;
      highTimeIst = bar.timeIst;
    }
    if (bar.low < low) {
      low = bar.low;
      lowTimeIst = bar.timeIst;
    }
  }
  return { high, highTimeIst, low, lowTimeIst };
}

/** 09:15 candle body color: green if close > open, red if close < open. */
export function classifyCandleColor(open: number, close: number): CandleColor {
  if (close > open) {
    return "green";
  }
  if (close < open) {
    return "red";
  }
  return "doji";
}

export function classifyDayTrend(
  sessionClose: number,
  open0915: number,
): DayTrend {
  if (sessionClose < open0915) {
    return "downtrend";
  }
  if (sessionClose > open0915) {
    return "uptrend";
  }
  return "flat";
}

export function buildPnbOpenGapRows(
  days: SessionDayBars[],
  stock = "PNB",
): PnbOpenGapRow[] {
  const rows: PnbOpenGapRow[] = [];
  for (let i = 1; i < days.length; i++) {
    const previous = days[i - 1];
    const current = days[i];
    const openedVsPreviousClose = classifyGap(
      current.open0915,
      previous.close,
    );
    const dayTrend = classifyDayTrend(current.close, current.open0915);
    const gapPct =
      ((current.open0915 - previous.close) / previous.close) * 100;
    const trendPct = ((current.close - current.open0915) / current.open0915) * 100;
    rows.push({
      date: current.dateKey,
      stock,
      previousDayClose: previous.close,
      nextDay0915Price: current.open0915,
      openedVsPreviousClose,
      dayTrend,
      sessionClose: current.close,
      nextDayHigh: current.high,
      nextDayHighTimeIst: current.highTimeIst,
      nextDayLow: current.low,
      nextDayLowTimeIst: current.lowTimeIst,
      candle0915Color: classifyCandleColor(current.open0915, current.close0915),
      candle0915High: current.high0915,
      candle0915Low: current.low0915,
      candle0915Close: current.close0915,
      candle0915HighCrossedPrevCloseUp: current.high0915 > previous.close,
      candle0915LowCrossedPrevCloseDown: current.low0915 < previous.close,
      gapPct,
      trendPct,
      matchesGapDownAndDowntrend:
        openedVsPreviousClose === "lower" && dayTrend === "downtrend",
      matchesGapUpAndUptrend:
        openedVsPreviousClose === "upper" && dayTrend === "uptrend",
    });
  }
  return rows;
}
