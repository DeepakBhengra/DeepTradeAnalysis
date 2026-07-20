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

export async function fetchPnbQuote(symbol: string): Promise<KiteQuote | null> {
  const kite = createKiteClient();

  try {
    const quotes = await kite.getQuote(symbol);
    const quote = quotes[symbol];

    if (!quote) {
      return null;
    }

    return {
      lastPrice: quote.last_price,
      buyQuantity: quote.buy_quantity,
      sellQuantity: quote.sell_quantity,
      bids: quote.depth.buy.map((level) => ({
        price: level.price,
        orders: level.orders,
        quantity: level.quantity,
      })),
      asks: quote.depth.sell.map((level) => ({
        price: level.price,
        orders: level.orders,
        quantity: level.quantity,
      })),
    };
  } catch (error) {
    throw wrapKiteError(error);
  }
}
