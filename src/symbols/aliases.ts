const symbolAliases: Record<string, string> = {
  SBI: "SBIN",
  HDFC: "HDFCBANK",
  ICICI: "ICICIBANK",
  INFOSYS: "INFY",
  TATAMOTORS: "TMPV",
  LTIM: "LTM",
};

export function applySymbolAlias(tradingSymbol: string): string {
  const normalized = tradingSymbol.trim().toUpperCase();
  return symbolAliases[normalized] ?? normalized;
}

export function getSymbolAliasHint(tradingSymbol: string): string | null {
  const alias = symbolAliases[tradingSymbol.trim().toUpperCase()];
  return alias ?? null;
}
