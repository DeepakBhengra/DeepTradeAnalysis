export type ChartInterval = "15m" | "5m";

export function intervalMinutes(interval: ChartInterval): number {
  return interval === "5m" ? 5 : 15;
}

export function kiteHistoricalInterval(interval: ChartInterval): "5minute" | "15minute" {
  return interval === "5m" ? "5minute" : "15minute";
}

export function chartIntervalForDeepproCrossRule(
  ruleId: "deeppro1" | "deeppro2",
): ChartInterval {
  return ruleId === "deeppro2" ? "5m" : "15m";
}
