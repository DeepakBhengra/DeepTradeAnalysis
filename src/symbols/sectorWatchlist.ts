export type SectorName =

  | "Bank"

  | "IT"

  | "Metal"

  | "Insurance"

  | "Automobile"

  | "Health";



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

];



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

  { sector: "IT", tradingSymbol: "TCS" },

  { sector: "IT", tradingSymbol: "INFY" },

  { sector: "IT", tradingSymbol: "HCLTECH" },

  { sector: "IT", tradingSymbol: "WIPRO" },

  { sector: "IT", tradingSymbol: "TECHM" },

  { sector: "IT", tradingSymbol: "LTM" },

  { sector: "IT", tradingSymbol: "PERSISTENT" },

  { sector: "IT", tradingSymbol: "COFORGE" },

  { sector: "IT", tradingSymbol: "KPITTECH" },

  { sector: "Metal", tradingSymbol: "TATASTEEL" },

  { sector: "Metal", tradingSymbol: "JSWSTEEL" },

  { sector: "Metal", tradingSymbol: "HINDALCO" },

  { sector: "Metal", tradingSymbol: "SAIL" },

  { sector: "Metal", tradingSymbol: "JINDALSTEL" },

  { sector: "Metal", tradingSymbol: "NATIONALUM" },

  { sector: "Metal", tradingSymbol: "HINDZINC" },

  { sector: "Metal", tradingSymbol: "VEDL" },

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

];



export function getSectorWatchlistSymbols(): string[] {

  return SECTOR_WATCHLIST.map((entry) => entry.tradingSymbol);

}



export function getSectorRank(sector: SectorName): number {

  return SECTOR_ORDER.indexOf(sector);

}


