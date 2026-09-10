#!/usr/bin/env node
/**
 * Export all day-best BUY/SELL for PNB from the rule-free 60d study JSON.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPORTS_DIR = resolve(process.cwd(), "reports");
const SRC = resolve(REPORTS_DIR, "pnb-best-entry-times-60d.json");

type Opp = {
  entryTimeIst: string;
  entryPrice: number;
  squareOffTimeIst: string;
  squareOffPrice: number;
  profitPct: number;
};

type DayBest = {
  dateKey: string;
  dayLabel: string;
  weekday: string;
  buy: Opp | null;
  sell: Opp | null;
};

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

function main(): void {
  const src = JSON.parse(readFileSync(SRC, "utf8")) as {
    tradeDaysScanned: number;
    window: { from: string; to: string };
    dayBests: DayBest[];
  };

  const dayBests = src.dayBests;
  const buys = dayBests
    .filter((d) => d.buy && d.buy.profitPct > 0)
    .map((d) => ({ ...d.buy!, dateKey: d.dateKey, dayLabel: d.dayLabel, weekday: d.weekday }));
  const sells = dayBests
    .filter((d) => d.sell && d.sell.profitPct > 0)
    .map((d) => ({ ...d.sell!, dateKey: d.dateKey, dayLabel: d.dayLabel, weekday: d.weekday }));

  const buysByPct = [...buys].sort((a, b) => b.profitPct - a.profitPct);
  const sellsByPct = [...sells].sort((a, b) => b.profitPct - a.profitPct);
  const generatedAtUtc = new Date().toISOString();

  const lines = [
    `# PNB — all best BUY & SELL (last ${src.tradeDaysScanned}d, positive profit only)`,
    "",
    `- **Symbol:** PNB`,
    `- **Window:** ${src.tradeDaysScanned} trade days (${src.window.from} → ${src.window.to})`,
    `- **Rules:** none — best same-day opportunity from any 15m mid`,
    `- **Entry:** candle mid \`(high+low)/2\``,
    `- **Square-off:** best later same-day mid before \`15:15\` IST`,
    `- **Filter:** positive profit % only`,
    `- **Best BUY days:** ${buys.length}`,
    `- **Best SELL days:** ${sells.length}`,
    `- **Avg best BUY %:** ${avg(buys.map((b) => b.profitPct)).toFixed(2)}%`,
    `- **Avg best SELL %:** ${avg(sells.map((s) => s.profitPct)).toFixed(2)}%`,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## All best BUY (sorted by profit %)",
    "",
    "| Rank | Day | Weekday | Entry time | Buy price | SQ time | SQ price | Profit % |",
    "|------|-----|---------|------------|-----------|---------|----------|----------|",
  ];

  buysByPct.forEach((b, i) => {
    lines.push(
      `| ${i + 1} | ${b.dayLabel} | ${b.weekday} | ${b.entryTimeIst} | ${b.entryPrice.toFixed(2)} | ${b.squareOffTimeIst} | ${b.squareOffPrice.toFixed(2)} | **${b.profitPct.toFixed(2)}%** |`,
    );
  });

  lines.push(
    "",
    "## All best SELL (sorted by profit %)",
    "",
    "| Rank | Day | Weekday | Entry time | Sell price | SQ time | SQ price | Profit % |",
    "|------|-----|---------|------------|------------|---------|----------|----------|",
  );

  sellsByPct.forEach((s, i) => {
    lines.push(
      `| ${i + 1} | ${s.dayLabel} | ${s.weekday} | ${s.entryTimeIst} | ${s.entryPrice.toFixed(2)} | ${s.squareOffTimeIst} | ${s.squareOffPrice.toFixed(2)} | **${s.profitPct.toFixed(2)}%** |`,
    );
  });

  lines.push(
    "",
    "## Day-by-day (chronological)",
    "",
    "| Day | Weekday | BUY time | Buy price | BUY SQ | BUY % | SELL time | Sell price | SELL SQ | SELL % |",
    "|-----|---------|----------|-----------|--------|-------|-----------|------------|---------|--------|",
  );

  for (const d of [...dayBests].sort((a, b) => a.dateKey.localeCompare(b.dateKey))) {
    const b = d.buy && d.buy.profitPct > 0 ? d.buy : null;
    const s = d.sell && d.sell.profitPct > 0 ? d.sell : null;
    lines.push(
      `| ${d.dayLabel} | ${d.weekday} | ${b?.entryTimeIst ?? "—"} | ${b ? b.entryPrice.toFixed(2) : "—"} | ${b ? `${b.squareOffTimeIst} @ ${b.squareOffPrice.toFixed(2)}` : "—"} | ${b ? `**${b.profitPct.toFixed(2)}%**` : "—"} | ${s?.entryTimeIst ?? "—"} | ${s ? s.entryPrice.toFixed(2) : "—"} | ${s ? `${s.squareOffTimeIst} @ ${s.squareOffPrice.toFixed(2)}` : "—"} | ${s ? `**${s.profitPct.toFixed(2)}%**` : "—"} |`,
    );
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- One best BUY and one best SELL per trade day (highest positive same-day square-off %).",
    "- No Deepak / Deeppro rules — pure 15m mid hindsight.",
    "- Square-off is best later mid before 15:15 (not a live fill guarantee).",
    "",
  );

  mkdirSync(REPORTS_DIR, { recursive: true });
  const mdPath = resolve(REPORTS_DIR, "pnb-all-best-buy-sell-60d.md");
  const jsonPath = resolve(REPORTS_DIR, "pnb-all-best-buy-sell-60d.json");
  writeFileSync(mdPath, `${lines.join("\n")}\n`);
  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        symbol: "PNB",
        window: src.window,
        tradeDaysScanned: src.tradeDaysScanned,
        buyCount: buys.length,
        sellCount: sells.length,
        avgBestBuyPct: avg(buys.map((b) => b.profitPct)),
        avgBestSellPct: avg(sells.map((s) => s.profitPct)),
        buysByProfitPct: buysByPct,
        sellsByProfitPct: sellsByPct,
        dayByDay: dayBests,
        generatedAtUtc,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        buyCount: buys.length,
        sellCount: sells.length,
        topBuy: buysByPct[0] ?? null,
        topSell: sellsByPct[0] ?? null,
        markdown: mdPath,
        json: jsonPath,
      },
      null,
      2,
    ),
  );
}

main();
