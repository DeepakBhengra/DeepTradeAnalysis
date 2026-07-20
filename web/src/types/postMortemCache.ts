import type { DashboardSeriesPoint } from "./dashboard";
import type { DeepakPostMortemReport, PostMortemVariant } from "./postMortem";
import type { SignalDayOption } from "../utils/signalDaysFromTrades";

export interface PostMortemSignalDaysCache {
  source: "cache" | "saved";
  savedAt: string;
  symbol: string;
  fromDate: string;
  toDate: string;
  variant: PostMortemVariant;
  days: SignalDayOption[];
  tradingDaysScanned: number;
  totalSignals: number;
}

export interface PostMortemReportCache {
  source: "cache" | "saved";
  savedAt: string;
  symbol: string;
  date: string;
  variant: PostMortemVariant;
  mode: string;
  report: DeepakPostMortemReport;
  series: DashboardSeriesPoint[];
}
