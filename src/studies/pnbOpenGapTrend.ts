export type GapDirection = "lower" | "upper" | "unchanged";
export type DayTrend = "downtrend" | "uptrend" | "flat";

export interface SessionDayBars {
  dateKey: string;
  open0915: number;
  close: number;
}

export interface PnbOpenGapRow {
  date: string;
  stock: string;
  previousDayClose: number;
  nextDay0915Price: number;
  openedVsPreviousClose: GapDirection;
  dayTrend: DayTrend;
  sessionClose: number;
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
