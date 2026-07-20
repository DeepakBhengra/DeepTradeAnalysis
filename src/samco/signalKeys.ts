export type SamcoStrategy = "deepak" | "deepak2";

export function buildSignalKey(params: {
  strategy: SamcoStrategy;
  tradingSymbol: string;
  entryTimeIst: string;
  scenarioNumber: number;
}): string {
  return `${params.strategy}-${params.tradingSymbol}-${params.entryTimeIst}-${params.scenarioNumber}`;
}

export function oppositeTransactionType(
  side: "BUY" | "SELL",
): "BUY" | "SELL" {
  return side === "BUY" ? "SELL" : "BUY";
}
