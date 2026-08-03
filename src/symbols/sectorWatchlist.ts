export type SectorName =
  | "Bank"
  | "IT"
  | "Metal"
  | "Insurance"
  | "Automobile"
  | "Health"
  | "Energy"
  | "FMCG"
  | "Finance"
  | "Infra"
  | "Consumer"
  | "Telecom"
  | "Defence";

export interface SectorWatchlistEntry {
  sector: SectorName;
  tradingSymbol: string;
}

export const SECTOR_ORDER: SectorName[] = [
  "Bank",
  "IT",
  "Metal",
  "Insurance",
  "Automobile",
  "Health",
  "Energy",
  "FMCG",
  "Finance",
  "Infra",
  "Consumer",
  "Telecom",
  "Defence",
];

/**
 * Day Scan / Day Scan Post-Mortem universe — 100 liquid NSE names.
 * First 50 match the original sector large-cap set; next 50 add Energy,
 * FMCG, Finance, Infra, Consumer, Telecom, Defence, and extra Bank/IT/Health/Metal.
 */
export const SECTOR_WATCHLIST: SectorWatchlistEntry[] = [
  { sector: "Bank", tradingSymbol: "HDFCBANK" },
  { sector: "Bank", tradingSymbol: "ICICIBANK" },
  { sector: "Bank", tradingSymbol: "SBIN" },
  { sector: "Bank", tradingSymbol: "KOTAKBANK" },
  { sector: "Bank", tradingSymbol: "AXISBANK" },
  { sector: "Bank", tradingSymbol: "INDUSINDBK" },
  { sector: "Bank", tradingSymbol: "BANKBARODA" },
  { sector: "Bank", tradingSymbol: "PNB" },
  { sector: "Bank", tradingSymbol: "CANBK" },
  { sector: "Bank", tradingSymbol: "FEDERALBNK" },
  { sector: "Bank", tradingSymbol: "IDFCFIRSTB" },
  { sector: "Bank", tradingSymbol: "AUBANK" },
  { sector: "Bank", tradingSymbol: "YESBANK" },
  { sector: "IT", tradingSymbol: "TCS" },
  { sector: "IT", tradingSymbol: "INFY" },
  { sector: "IT", tradingSymbol: "HCLTECH" },
  { sector: "IT", tradingSymbol: "WIPRO" },
  { sector: "IT", tradingSymbol: "TECHM" },
  { sector: "IT", tradingSymbol: "LTM" },
  { sector: "IT", tradingSymbol: "PERSISTENT" },
  { sector: "IT", tradingSymbol: "COFORGE" },
  { sector: "IT", tradingSymbol: "KPITTECH" },
  { sector: "IT", tradingSymbol: "MPHASIS" },
  { sector: "IT", tradingSymbol: "OFSS" },
  { sector: "IT", tradingSymbol: "DIXON" },
  { sector: "Metal", tradingSymbol: "TATASTEEL" },
  { sector: "Metal", tradingSymbol: "JSWSTEEL" },
  { sector: "Metal", tradingSymbol: "HINDALCO" },
  { sector: "Metal", tradingSymbol: "SAIL" },
  { sector: "Metal", tradingSymbol: "JINDALSTEL" },
  { sector: "Metal", tradingSymbol: "NATIONALUM" },
  { sector: "Metal", tradingSymbol: "HINDZINC" },
  { sector: "Metal", tradingSymbol: "VEDL" },
  { sector: "Metal", tradingSymbol: "NMDC" },
  { sector: "Insurance", tradingSymbol: "HDFCLIFE" },
  { sector: "Insurance", tradingSymbol: "ICICIPRULI" },
  { sector: "Insurance", tradingSymbol: "SBILIFE" },
  { sector: "Insurance", tradingSymbol: "LICI" },
  { sector: "Insurance", tradingSymbol: "ICICIGI" },
  { sector: "Insurance", tradingSymbol: "GICRE" },
  { sector: "Insurance", tradingSymbol: "STARHEALTH" },
  { sector: "Insurance", tradingSymbol: "POLICYBZR" },
  { sector: "Automobile", tradingSymbol: "MARUTI" },
  { sector: "Automobile", tradingSymbol: "M&M" },
  { sector: "Automobile", tradingSymbol: "TMPV" },
  { sector: "Automobile", tradingSymbol: "BAJAJ-AUTO" },
  { sector: "Automobile", tradingSymbol: "EICHERMOT" },
  { sector: "Automobile", tradingSymbol: "HEROMOTOCO" },
  { sector: "Automobile", tradingSymbol: "TVSMOTOR" },
  { sector: "Automobile", tradingSymbol: "ASHOKLEY" },
  { sector: "Health", tradingSymbol: "SUNPHARMA" },
  { sector: "Health", tradingSymbol: "DRREDDY" },
  { sector: "Health", tradingSymbol: "CIPLA" },
  { sector: "Health", tradingSymbol: "DIVISLAB" },
  { sector: "Health", tradingSymbol: "APOLLOHOSP" },
  { sector: "Health", tradingSymbol: "AUROPHARMA" },
  { sector: "Health", tradingSymbol: "LUPIN" },
  { sector: "Health", tradingSymbol: "ALKEM" },
  { sector: "Health", tradingSymbol: "TORNTPHARM" },
  { sector: "Health", tradingSymbol: "BIOCON" },
  { sector: "Energy", tradingSymbol: "RELIANCE" },
  { sector: "Energy", tradingSymbol: "ONGC" },
  { sector: "Energy", tradingSymbol: "BPCL" },
  { sector: "Energy", tradingSymbol: "IOC" },
  { sector: "Energy", tradingSymbol: "GAIL" },
  { sector: "Energy", tradingSymbol: "POWERGRID" },
  { sector: "Energy", tradingSymbol: "NTPC" },
  { sector: "Energy", tradingSymbol: "TATAPOWER" },
  { sector: "FMCG", tradingSymbol: "HINDUNILVR" },
  { sector: "FMCG", tradingSymbol: "ITC" },
  { sector: "FMCG", tradingSymbol: "NESTLEIND" },
  { sector: "FMCG", tradingSymbol: "BRITANNIA" },
  { sector: "FMCG", tradingSymbol: "TATACONSUM" },
  { sector: "FMCG", tradingSymbol: "DABUR" },
  { sector: "FMCG", tradingSymbol: "MARICO" },
  { sector: "FMCG", tradingSymbol: "GODREJCP" },
  { sector: "Finance", tradingSymbol: "BAJFINANCE" },
  { sector: "Finance", tradingSymbol: "BAJAJFINSV" },
  { sector: "Finance", tradingSymbol: "HDFCAMC" },
  { sector: "Finance", tradingSymbol: "SBICARD" },
  { sector: "Finance", tradingSymbol: "CHOLAFIN" },
  { sector: "Finance", tradingSymbol: "PFC" },
  { sector: "Finance", tradingSymbol: "RECLTD" },
  { sector: "Finance", tradingSymbol: "SHRIRAMFIN" },
  { sector: "Infra", tradingSymbol: "LT" },
  { sector: "Infra", tradingSymbol: "ADANIENT" },
  { sector: "Infra", tradingSymbol: "ADANIPORTS" },
  { sector: "Infra", tradingSymbol: "ULTRACEMCO" },
  { sector: "Infra", tradingSymbol: "AMBUJACEM" },
  { sector: "Infra", tradingSymbol: "SHREECEM" },
  { sector: "Infra", tradingSymbol: "GRASIM" },
  { sector: "Infra", tradingSymbol: "SIEMENS" },
  { sector: "Consumer", tradingSymbol: "TITAN" },
  { sector: "Consumer", tradingSymbol: "ASIANPAINT" },
  { sector: "Consumer", tradingSymbol: "PIDILITIND" },
  { sector: "Consumer", tradingSymbol: "HAVELLS" },
  { sector: "Consumer", tradingSymbol: "VOLTAS" },
  { sector: "Consumer", tradingSymbol: "TRENT" },
  { sector: "Telecom", tradingSymbol: "BHARTIARTL" },
  { sector: "Defence", tradingSymbol: "BEL" },
];

export function getSectorWatchlistSymbols(): string[] {
  return SECTOR_WATCHLIST.map((entry) => entry.tradingSymbol);
}

export function getSectorRank(sector: SectorName): number {
  return SECTOR_ORDER.indexOf(sector);
}
