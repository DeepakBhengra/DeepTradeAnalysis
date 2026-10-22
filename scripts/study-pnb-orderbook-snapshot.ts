#!/usr/bin/env node
/**
 * Live PNB order-book snapshot from Kite quotes (NSE + BSE).
 *
 * Usage:
 *   npx tsx scripts/study-pnb-orderbook-snapshot.ts
 */
import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchKiteQuotes } from "../src/data/quoteFeed.js";
import { getKiteAuthStatus } from "../src/kite/kiteAuth.js";
import { hasValidKiteAccessToken } from "../src/kite/kiteTokenStore.js";
import {
  buildOrderBookSnapshot,
  formatOrderBookMarkdown,
  type OrderBookSnapshot,
} from "../src/studies/pnbOrderBookSnapshot.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SYMBOLS = ["NSE:PNB", "BSE:PNB"] as const;

function buildMarkdown(
  snapshots: OrderBookSnapshot[],
  generatedAt: string,
): string {
  const sections = snapshots.map((snapshot) => {
    return `## ${snapshot.symbol}

- **LTP:** ₹${snapshot.lastPrice.toFixed(2)}
- **Buy total qty:** ${snapshot.buyQuantity.toLocaleString("en-IN")} (${snapshot.bidOrders} orders on shown levels)
- **Sell total qty:** ${snapshot.sellQuantity.toLocaleString("en-IN")} (${snapshot.offerOrders} orders on shown levels)

${formatOrderBookMarkdown(snapshot)}
`;
  });

  return `# PNB order book · bid / offer depth

- **Fields:** bid/offer price, number of orders, and quantity on both sides
- **Source:** Kite Connect \`getQuote\` live market depth (not historical)
- **Generated (UTC):** ${generatedAt}

${sections.join("\n")}
`;
}

async function main(): Promise<void> {
  const status = getKiteAuthStatus();
  if (!hasValidKiteAccessToken()) {
    throw new Error(
      `Kite not connected (status.connected=${status.connected}). Set KITE_ACCESS_TOKEN in .env or Connect Kite, then re-run.`,
    );
  }

  const quotes = await fetchKiteQuotes([...SYMBOLS]);
  const snapshots = SYMBOLS.map((symbol) => {
    const quote = quotes[symbol];
    if (!quote) {
      throw new Error(`Kite returned no quote for ${symbol}`);
    }
    return buildOrderBookSnapshot(symbol, quote);
  });

  mkdirSync(REPORTS_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const mdPath = resolve(REPORTS_DIR, "pnb-orderbook-snapshot.md");
  const jsonPath = resolve(REPORTS_DIR, "pnb-orderbook-snapshot.json");
  writeFileSync(mdPath, buildMarkdown(snapshots, generatedAt));
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        source: "Kite Connect getQuote live depth",
        symbols: [...SYMBOLS],
        generatedAt,
        snapshots,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        wrote: [mdPath, jsonPath],
        kiteConnected: true,
        books: snapshots.map((snapshot) => ({
          symbol: snapshot.symbol,
          lastPrice: snapshot.lastPrice,
          buyQuantity: snapshot.buyQuantity,
          sellQuantity: snapshot.sellQuantity,
          levels: snapshot.rows.length,
        })),
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
