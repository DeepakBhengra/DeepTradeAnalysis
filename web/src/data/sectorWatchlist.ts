export const SECTOR_WATCHLIST_PREVIEW = [
  {
    sector: "Bank",
    symbols: [
      "HDFCBANK",
      "ICICIBANK",
      "SBIN",
      "KOTAKBANK",
      "AXISBANK",
      "INDUSINDBK",
      "BANKBARODA",
      "PNB",
      "CANBK",
    ],
  },
  {
    sector: "IT",
    symbols: [
      "TCS",
      "INFY",
      "HCLTECH",
      "WIPRO",
      "TECHM",
      "LTM",
      "PERSISTENT",
      "COFORGE",
      "KPITTECH",
    ],
  },
  {
    sector: "Metal",
    symbols: [
      "TATASTEEL",
      "JSWSTEEL",
      "HINDALCO",
      "SAIL",
      "JINDALSTEL",
      "NATIONALUM",
      "HINDZINC",
      "VEDL",
    ],
  },
  {
    sector: "Insurance",
    symbols: [
      "HDFCLIFE",
      "ICICIPRULI",
      "SBILIFE",
      "LICI",
      "ICICIGI",
      "GICRE",
      "STARHEALTH",
      "POLICYBZR",
    ],
  },
  {
    sector: "Automobile",
    symbols: [
      "MARUTI",
      "M&M",
      "TMPV",
      "BAJAJ-AUTO",
      "EICHERMOT",
      "HEROMOTOCO",
      "TVSMOTOR",
      "ASHOKLEY",
    ],
  },
  {
    sector: "Health",
    symbols: [
      "SUNPHARMA",
      "DRREDDY",
      "CIPLA",
      "DIVISLAB",
      "APOLLOHOSP",
      "AUROPHARMA",
      "LUPIN",
      "ALKEM",
    ],
  },
] as const;

export const SECTOR_WATCHLIST_SIZE = SECTOR_WATCHLIST_PREVIEW.reduce(
  (count, group) => count + group.symbols.length,
  0,
);
