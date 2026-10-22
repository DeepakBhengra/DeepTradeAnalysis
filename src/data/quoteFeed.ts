import { createKiteClient } from "./pnbFeed.js";
import type { DepthLevel } from "../types.js";

export interface KiteQuote {
  lastPrice: number;
  buyQuantity: number;
  sellQuantity: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
}

function isKiteAuthError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const kiteError = error as {
    status?: number;
    error_type?: string;
    message?: string;
  };

  if (kiteError.status === 401 || kiteError.error_type === "TokenException") {
    return true;
  }

  const message = kiteError.message?.toLowerCase() ?? "";
  return (
    message.includes("token") ||
    message.includes("unauthorized") ||
    message.includes("access denied")
  );
}

function wrapKiteError(error: unknown): Error {
  if (isKiteAuthError(error)) {
    return new Error(
      "Kite access_token expired or invalid. Generate a new token and update KITE_ACCESS_TOKEN in .env.",
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function toKiteQuote(quote: {
  last_price: number;
  buy_quantity: number;
  sell_quantity: number;
  depth?: {
    buy?: Array<{ price: number; orders: number; quantity: number }>;
    sell?: Array<{ price: number; orders: number; quantity: number }>;
  };
}): KiteQuote {
  return {
    lastPrice: quote.last_price,
    buyQuantity: quote.buy_quantity,
    sellQuantity: quote.sell_quantity,
    bids: (quote.depth?.buy ?? []).map((level) => ({
      price: level.price,
      orders: level.orders,
      quantity: level.quantity,
    })),
    asks: (quote.depth?.sell ?? []).map((level) => ({
      price: level.price,
      orders: level.orders,
      quantity: level.quantity,
    })),
  };
}

export async function fetchKiteQuotes(
  symbols: string[],
): Promise<Record<string, KiteQuote>> {
  const kite = createKiteClient();
  try {
    const quotes = await kite.getQuote(symbols);
    const mapped: Record<string, KiteQuote> = {};
    for (const symbol of symbols) {
      const quote = quotes[symbol];
      if (quote) {
        mapped[symbol] = toKiteQuote(quote);
      }
    }
    return mapped;
  } catch (error) {
    throw wrapKiteError(error);
  }
}

export async function fetchPnbQuote(symbol: string): Promise<KiteQuote | null> {
  const quotes = await fetchKiteQuotes([symbol]);
  return quotes[symbol] ?? null;
}
