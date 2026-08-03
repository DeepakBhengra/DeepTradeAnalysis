#!/usr/bin/env node
/**
 * Categorise day-best BUY/SELL into profit-range buckets.
 *
 * Usage:
 *   npx tsx scripts/export-best-buy-sell-by-range.ts \
 *     --src reports/sunpharma-all-best-buy-sell-60d.json \
 *     --out-suffix 60d
 *
 * Ranges (inclusive):
 *   High: ≥1.8% (labelled 3%–1.8%; includes >3% movers)
 *   Mid:  0.9% – 1.7%
 *   Low:  0.4% – 0.8%
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPORTS_DIR = resolve(process.cwd(), "reports");

function parseArgs(argv: string[]): { src: string; outSuffix: string } {
  let src = resolve(REPORTS_DIR, "sunpharma-all-best-buy-sell-60d.json");
  let outSuffix = "60d";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--src" && argv[i + 1]) {
      src = resolve(process.cwd(), argv[++i]);
      continue;
    }
    if (arg === "--out-suffix" && argv[i + 1]) {
      outSuffix = argv[++i];
      continue;
    }
  }
  return { src, outSuffix };
}

type Opp = {
  dateKey: string;
  dayLabel: string;
  weekday: string;
  entryTimeIst: string;
  entryPrice: number;
  squareOffTimeIst: string;
  squareOffPrice: number;
  profitPct: number;
};

type RangeDef = {
  id: string;
  label: string;
  minPct: number;
  maxPct: number;
};

const RANGES: RangeDef[] = [
  { id: "high", label: "3% – 1.8%", minPct: 1.8, maxPct: 100 },
  { id: "mid", label: "1.7% – 0.9%", minPct: 0.9, maxPct: 1.7 },
  { id: "low", label: "0.8% – 0.4%", minPct: 0.4, maxPct: 0.8 },
];

function inRange(pct: number, range: RangeDef): boolean {
  return pct >= range.minPct && pct <= range.maxPct;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

function writeSideTable(
  lines: string[],
  title: string,
  side: "BUY" | "SELL",
  rows: Opp[],
): void {
  const priceHeader = side === "BUY" ? "Buy price" : "Sell price";
  lines.push(
    "",
    `### ${title}`,
    "",
    `| Rank | Day | Weekday | Entry time | ${priceHeader} | SQ time | SQ price | Profit % |`,
    "|------|-----|---------|------------|-----------|---------|----------|----------|",
  );

  if (rows.length === 0) {
    lines.push("| — | — | — | — | — | — | — | *none* |");
    return;
  }

  rows.forEach((row, i) => {
    lines.push(
      `| ${i + 1} | ${row.dayLabel} | ${row.weekday} | ${row.entryTimeIst} | ${row.entryPrice.toFixed(2)} | ${row.squareOffTimeIst} | ${row.squareOffPrice.toFixed(2)} | **${row.profitPct.toFixed(2)}%** |`,
    );
  });
}

function main(): void {
  const { src: SRC, outSuffix } = parseArgs(process.argv.slice(2));
  const src = JSON.parse(readFileSync(SRC, "utf8")) as {
    symbol?: string;
    tradeDaysScanned: number;
    window: { from: string; to: string };
    buysByProfitPct: Opp[];
    sellsByProfitPct: Opp[];
  };

  const reportSymbol = (src.symbol ?? "SUNPHARMA").toUpperCase();
  const slug = reportSymbol.toLowerCase();
  const buys = src.buysByProfitPct;
  const sells = src.sellsByProfitPct;
  const generatedAtUtc = new Date().toISOString();

  const buckets = RANGES.map((range) => {
    const buyRows = buys
      .filter((b) => inRange(b.profitPct, range))
      .sort((a, b) => b.profitPct - a.profitPct);
    const sellRows = sells
      .filter((s) => inRange(s.profitPct, range))
      .sort((a, b) => b.profitPct - a.profitPct);
    return { range, buyRows, sellRows };
  });

  const outsideBuys = buys
    .filter((b) => !RANGES.some((r) => inRange(b.profitPct, r)))
    .sort((a, b) => b.profitPct - a.profitPct);
  const outsideSells = sells
    .filter((s) => !RANGES.some((r) => inRange(s.profitPct, r)))
    .sort((a, b) => b.profitPct - a.profitPct);

  const lines = [
    `# ${reportSymbol} — best BUY & SELL by profit range (last ${src.tradeDaysScanned}d)`,
    "",
    `- **Symbol:** ${reportSymbol}`,
    `- **Window:** ${src.tradeDaysScanned} trade days (${src.window.from} → ${src.window.to})`,
    `- **Rules:** none — day-best same-day square-off from any 15m mid`,
    `- **Entry:** candle mid \`(high+low)/2\``,
    `- **Square-off:** best later same-day mid before \`15:15\` IST`,
    `- **Categories (inclusive):** \`3%–1.8%\` · \`1.7%–0.9%\` · \`0.8%–0.4%\``,
    `- **Generated (UTC):** ${generatedAtUtc}`,
    "",
    "## Category counts",
    "",
    "| Profit range | BUY count | Avg BUY % | SELL count | Avg SELL % |",
    "|--------------|-----------|-----------|------------|------------|",
  ];

  for (const { range, buyRows, sellRows } of buckets) {
    lines.push(
      `| ${range.label} | ${buyRows.length} | ${avg(buyRows.map((r) => r.profitPct)).toFixed(2)}% | ${sellRows.length} | ${avg(sellRows.map((r) => r.profitPct)).toFixed(2)}% |`,
    );
  }
  lines.push(
    `| Outside ranges | ${outsideBuys.length} | ${avg(outsideBuys.map((r) => r.profitPct)).toFixed(2)}% | ${outsideSells.length} | ${avg(outsideSells.map((r) => r.profitPct)).toFixed(2)}% |`,
  );

  for (const { range, buyRows, sellRows } of buckets) {
    lines.push("", `## Category: ${range.label}`);
    writeSideTable(lines, `BUY (${buyRows.length})`, "BUY", buyRows);
    writeSideTable(lines, `SELL (${sellRows.length})`, "SELL", sellRows);
  }

  lines.push("", "## Outside the three ranges (< 0.4% or between gaps)");
  writeSideTable(lines, `BUY outside (${outsideBuys.length})`, "BUY", outsideBuys);
  writeSideTable(lines, `SELL outside (${outsideSells.length})`, "SELL", outsideSells);

  lines.push(
    "",
    "## Notes",
    "",
    "- One best BUY and one best SELL per trade day.",
    "- Range bounds are inclusive as written (e.g. 1.80% → high, 0.90% → mid, 0.40% → low).",
    "- Gaps (e.g. 1.71%–1.79%, 0.81%–0.89%) and sub-0.4% sit in **Outside**.",
    "- No Deepak / Deeppro rules — pure 15m mid hindsight.",
    "",
  );

  mkdirSync(REPORTS_DIR, { recursive: true });
  const mdPath = resolve(REPORTS_DIR, `${slug}-best-buy-sell-by-range-${outSuffix}.md`);
  const jsonPath = resolve(REPORTS_DIR, `${slug}-best-buy-sell-by-range-${outSuffix}.json`);

  const payload = {
    symbol: reportSymbol,
    window: src.window,
    tradeDaysScanned: src.tradeDaysScanned,
    ranges: RANGES,
    generatedAtUtc,
    categories: buckets.map(({ range, buyRows, sellRows }) => ({
      id: range.id,
      label: range.label,
      minPct: range.minPct,
      maxPct: range.maxPct,
      buyCount: buyRows.length,
      sellCount: sellRows.length,
      avgBuyPct: avg(buyRows.map((r) => r.profitPct)),
      avgSellPct: avg(sellRows.map((r) => r.profitPct)),
      buys: buyRows,
      sells: sellRows,
    })),
    outside: {
      buys: outsideBuys,
      sells: outsideSells,
    },
  };

  writeFileSync(mdPath, `${lines.join("\n")}\n`);
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        symbol: reportSymbol,
        categories: payload.categories.map((c) => ({
          label: c.label,
          buyCount: c.buyCount,
          sellCount: c.sellCount,
          avgBuyPct: c.avgBuyPct,
          avgSellPct: c.avgSellPct,
        })),
        outsideBuys: outsideBuys.length,
        outsideSells: outsideSells.length,
        markdown: mdPath,
        json: jsonPath,
      },
      null,
      2,
    ),
  );
}

main();
