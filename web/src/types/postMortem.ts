import type { Decision, DeepakBbMatchType } from "./dashboard";

export type PostMortemGrade = "RIGHT" | "MIXED" | "WRONG";

export type PostMortemVariant = "deepak" | "deepak2" | "deeppro";

export type EnhancementPriority = "P0" | "P1" | "P2" | "P3";

export interface PostMortemMidPoint {
  timeIst: string;
  mid: number;
  high: number;
  low: number;
  close: number;
  open: number;
  rsi: number | null;
}

export interface GradedPostMortemSignal {
  id: string;
  side: "BUY" | "SELL";
  scenarioKey: string;
  scenarioNumber: number;
  timeIst: string;
  entry: number;
  bbMatchType: DeepakBbMatchType;
  profitTarget: number;
  targetHit: boolean;
  grade: PostMortemGrade;
  mfe: number;
  mae: number;
  eodPnl: number;
  mfeLabel: string;
  maeLabel: string;
  why: string;
  nextPath: string;
  entryCandleColor: "green" | "red";
}

export interface LiveBiasStep {
  fromTimeIst: string;
  bias: Decision;
  why: string;
  marketAgree: string;
  tone: "success" | "danger" | "warning" | "neutral";
}

export interface EnhancementTip {
  priority: EnhancementPriority;
  title: string;
  body: string;
  effect: string;
}

export interface DeepakPostMortemReport {
  variant: PostMortemVariant;
  variantLabel: string;
  dateKey: string;
  decision: Decision;
  activeScenario: string | null;
  midPath: PostMortemMidPoint[];
  signals: GradedPostMortemSignal[];
  rightCount: number;
  mixedCount: number;
  wrongCount: number;
  headline: GradedPostMortemSignal | null;
  timeline: LiveBiasStep[];
  tips: EnhancementTip[];
  /** Closing summary for the symbol-day (canvas "Net read"). */
  netRead: string;
  sessionClose: number | null;
  sessionRsi: number | null;
}
