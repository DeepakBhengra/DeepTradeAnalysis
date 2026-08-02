import "../src/loadEnv.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectTradingDates } from "../src/backtest/runDeepakBacktest.js";
import { config, resolveDashboardSymbol } from "../src/config.js";
import { fetchPnbCandles } from "../src/data/pnbFeed.js";
import { buildIndicatorSnapshots } from "../src/indicators/compute.js";
import { evaluateDeepproAcrossDays } from "../src/rules/deepproDecision.js";
import type { DeepproSignal, IndicatorSnapshot } from "../src/types.js";
import {
  formatIstTime,
  getIstTimeParts,
  isWithinIstSessionWindow,
} from "../src/utils/marketTime.js";

const REPORTS_DIR = resolve(process.cwd(), "reports");

function parseArgs(argv: string[]): {
  tradeDays: number;
  symbol: string;
  tag: string;
} {
  let tradeDays = 60;
  let symbol = "SUNPHARMA";
  let tag: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--trade-days" && argv[i + 1]) {
      tradeDays = Math.max(1, Number(argv[++i]));
      continue;
    }
    if (arg === "--symbol" && argv[i + 1]) {
      symbol = argv[++i];
      continue;
    }
    if (arg === "--tag" && argv[i + 1]) {
      tag = argv[++i];
      continue;
    }
    if (/^\d+$/.test(arg)) {
      tradeDays = Math.max(1, Number(arg));
    }
  }

  return {
    tradeDays,
    symbol,
    tag: tag ?? `${tradeDays}d`,
  };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function forwardDropPct(
  snapshots: IndicatorSnapshot[],
  eventTimeIst: string,
  dateKey: string,
): number {
  const eventIndex = snapshots.findIndex((snapshot) => {
    const parts = getIstTimeParts(snapshot.timestamp);
    return (
      parts.dateKey === dateKey && formatIstTime(snapshot.timestamp) === eventTimeIst
    );
  });
  if (eventIndex < 0) {
    return NaN;
  }

  const window = snapshots.slice(eventIndex, eventIndex + 4).filter((snapshot) => {
    const parts = getIstTimeParts(snapshot.timestamp);
    return (
      parts.dateKey === dateKey &&
      isWithinIstSessionWindow(snapshot.timestamp, "09:15", "15:30")
    );
  });
  if (window.length === 0) {
    return NaN;
  }

  const peak = window[0].close;
  const trough = Math.min(...window.map((snapshot) => snapshot.low));
  return ((peak - trough) / peak) * 100;
}

function toReportRow(signal: DeepproSignal, snapshots: IndicatorSnapshot[]) {
  return {
    date: signal.dateKey,
    crossTimeIst: signal.timeIst,
    eventTimeIst: signal.eventTimeIst,
    eventKind: signal.eventKind,
    side: signal.side,
    rule: signal.rule,
    close: round(signal.price),
    peakSmi: round(signal.peakSmi),
    smi: round(signal.smi),
    smiSignal: round(signal.smiSignal),
    rsi: round(signal.rsi),
    eventRsi: round(signal.eventRsi),
    bbUpperProximity: {
      gapPct: round(signal.bbUpperProximity.gapPct, 4),
      signedGapPct: round(signal.bbUpperProximity.signedGapPct, 4),
      matchType: signal.bbUpperProximity.matchType,
      price: round(signal.bbUpperProximity.price),
      bbLevel: round(signal.bbUpperProximity.bbLevel),
    },
    bbLowerProximity: {
      gapPct: round(signal.bbLowerProximity.gapPct, 4),
      signedGapPct: round(signal.bbLowerProximity.signedGapPct, 4),
      matchType: signal.bbLowerProximity.matchType,
      price: round(signal.bbLowerProximity.price),
      bbLevel: round(signal.bbLowerProximity.bbLevel),
    },
    macdHistogram: round(signal.macdHistogram, 4),
    forwardDropPct: round(
      forwardDropPct(snapshots, signal.eventTimeIst, signal.dateKey),
    ),
    chartMatch: signal.dateKey === "2026-07-31" && signal.eventTimeIst === "14:00",
    reasons: signal.reasons,
  };
}

function writeMarkdown(payload: ReportPayload, path: string): void {
  const matches = payload.matches;
  const days = payload.tradeDaysScanned;
  const lines: string[] = [
    `# ${payload.symbol} deeppro Scan Report`,
    "",
    `- **Symbol:** ${payload.symbol}`,
    `- **Interval:** ${payload.interval}`,
    `- **Rule:** ${payload.rule}`,
    `- **Generated (UTC):** ${payload.generatedAtUtc}`,
    `- **Trade days scanned:** ${payload.tradeDayCount} (${days[0] ?? "—"} → ${days[days.length - 1] ?? "—"})`,
    `- **Requested trade days:** ${payload.requestedTradeDays}`,
    `- **Data source:** ${payload.dataRange.source}`,
    `- **Candle range:** ${payload.dataRange.from} → ${payload.dataRange.to}`,
    `- **Matches:** ${payload.matchCount}`,
    "",
    "## Rule definition",
    "",
    `- SMI: \`${payload.definition.smi}\``,
    `- Overbought level: \`${payload.definition.overboughtLevel}\``,
    `- Min peak SMI: \`${payload.definition.minPeakSmi}\``,
    `- Lookback bars: \`${payload.definition.lookbackBars}\``,
    "",
    "Requires:",
    "",
  ];

  for (const req of payload.definition.requires) {
    lines.push(`- ${req}`);
  }

  lines.push(
    "",
    "## Chart pink-circle reference",
    "",
    `- **Date:** ${payload.chartPinkCircle.date}`,
    `- **Annotated time:** ${payload.chartPinkCircle.annotatedTimeIst} IST`,
    `- ${payload.chartPinkCircle.description}`,
    "",
    "## Matches",
    "",
    "| Date | Cross | Event | Kind | Event RSI | BB upper % | Upper match | BB lower % | Lower match | Peak SMI | Fwd drop % |",
    "|------|-------|-------|------|-----------|------------|-------------|------------|-------------|----------|------------|",
  );

  if (matches.length === 0) {
    lines.push("| — | — | — | — | — | — | — | — | — | — | — |");
  } else {
    for (const row of matches) {
      const mark = row.chartMatch ? " **(chart pink)**" : "";
      lines.push(
        `| ${row.date}${mark} | ${row.crossTimeIst} | ${row.eventTimeIst} | ${row.eventKind} | ${row.eventRsi.toFixed(2)} | ${row.bbUpperProximity.gapPct.toFixed(3)} | ${row.bbUpperProximity.matchType ?? "-"} | ${row.bbLowerProximity.gapPct.toFixed(3)} | ${row.bbLowerProximity.matchType ?? "-"} | ${row.peakSmi.toFixed(1)} | ${row.forwardDropPct.toFixed(2)} |`,
      );
    }
  }

  lines.push("", "## Match detail", "");
  matches.forEach((row, index) => {
    lines.push(
      `### ${index + 1}. ${row.date} ${row.eventTimeIst} IST (${row.eventKind})`,
      "",
      `- Cross time: \`${row.crossTimeIst}\` IST`,
      `- Side: \`${row.side}\``,
      `- Cross close: \`${row.close}\``,
      `- Peak SMI: \`${row.peakSmi}\` · Cross SMI/signal: \`${row.smi}\` / \`${row.smiSignal}\``,
      `- Cross RSI: \`${row.rsi}\` · **Event RSI: \`${row.eventRsi}\`**`,
      `- **BB upper proximity:** high \`${row.bbUpperProximity.price}\` vs \`${row.bbUpperProximity.bbLevel}\` · gap \`${row.bbUpperProximity.gapPct}%\` · signed \`${row.bbUpperProximity.signedGapPct}%\` · match \`${row.bbUpperProximity.matchType ?? "none"}\``,
      `- **BB lower proximity:** low \`${row.bbLowerProximity.price}\` vs \`${row.bbLowerProximity.bbLevel}\` · gap \`${row.bbLowerProximity.gapPct}%\` · signed \`${row.bbLowerProximity.signedGapPct}%\` · match \`${row.bbLowerProximity.matchType ?? "none"}\``,
      `- MACD histogram at cross: \`${row.macdHistogram}\``,
      `- Forward drop (next ~3 bars): \`${row.forwardDropPct}%\``,
      "",
    );
  });

  if (payload.notes.length > 0) {
    lines.push("## Notes", "");
    for (const note of payload.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

interface ReportPayload {
  symbol: string;
  interval: string;
  rule: string;
  generatedAtUtc: string;
  requestedTradeDays: number;
  tradeDaysScanned: string[];
  tradeDayCount: number;
  dataRange: {
    from: string;
    to: string;
    source: string;
  };
  definition: {
    smi: string;
    overboughtLevel: number;
    minPeakSmi: number;
    lookbackBars: number;
    requires: string[];
  };
  chartPinkCircle: {
    date: string;
    annotatedTimeIst: string;
    description: string;
  };
  matches: ReturnType<typeof toReportRow>[];
  matchCount: number;
  notes: string[];
  artifacts: {
    json: string;
    markdown: string;
  };
}

async function main(): Promise<void> {
  const { tradeDays: requested, symbol, tag } = parseArgs(process.argv.slice(2));
  const dashboardSymbol = resolveDashboardSymbol(symbol);
  const jsonRel = `reports/deeppro-${dashboardSymbol.tradingSymbol.toLowerCase()}-${tag}.json`;
  const mdRel = `reports/deeppro-${dashboardSymbol.tradingSymbol.toLowerCase()}-${tag}.md`;
  const jsonPath = resolve(process.cwd(), jsonRel);
  const mdPath = resolve(process.cwd(), mdRel);

  console.log(
    `deeppro scan · ${dashboardSymbol.symbol} · Kite 15m · last ${requested} trade days\n`,
  );

  // Fetch enough history for 60 trade days + indicator warmup.
  const candles = await fetchPnbCandles({
    symbol: dashboardSymbol.tradingSymbol,
    exchange: dashboardSymbol.exchange,
    segment: dashboardSymbol.segment,
    range: "3mo",
  });

  const snapshots = buildIndicatorSnapshots(candles);
  const allDates = collectTradingDates(snapshots, {
    id: "deeppro",
    namePrefix: "deeppro",
    config: {
      sessionStart: "09:15",
      sessionEnd: "15:30",
      initialRunSize: 4,
      profitTarget: 0.7,
      adaptiveTarget: { enabled: false, lookback: 20 },
    },
  });
  const targetDates = allDates.slice(-requested);
  const notes: string[] = [];

  if (allDates.length < requested) {
    notes.push(
      `Requested ${requested} trade days, but Kite returned ${allDates.length} trade days in the fetched window (${allDates[0] ?? "—"} → ${allDates[allDates.length - 1] ?? "—"}).`,
    );
  }

  const signals = evaluateDeepproAcrossDays(snapshots, targetDates);
  const matches = signals.map((signal) => toReportRow(signal, snapshots));

  const first = candles[0];
  const last = candles[candles.length - 1];
  const payload: ReportPayload = {
    symbol: dashboardSymbol.tradingSymbol,
    interval: "15m",
    rule: "deeppro",
    generatedAtUtc: new Date().toISOString(),
    requestedTradeDays: requested,
    tradeDaysScanned: targetDates,
    tradeDayCount: targetDates.length,
    dataRange: {
      from: first ? first.timestamp.toISOString() : "",
      to: last ? last.timestamp.toISOString() : "",
      source: `Kite Connect historical (${dashboardSymbol.exchange}:${dashboardSymbol.tradingSymbol}, 15minute)`,
    },
    definition: {
      smi: `Stch Mtm(${config.deeppro.smi.lengthK},${config.deeppro.smi.lengthD},${config.deeppro.smi.lengthEma}) William Blau SMI`,
      overboughtLevel: config.deeppro.overboughtLevel,
      minPeakSmi: config.deeppro.minPeakSmi,
      lookbackBars: config.deeppro.lookbackBars,
      requires: [
        "SMI bearish cross from overbought",
        `Peak SMI >= ${config.deeppro.minPeakSmi} in lookback`,
        "Upper Bollinger Band tagged in lookback",
        "MACD histogram declining on cross candle",
      ],
    },
    chartPinkCircle: {
      date: "2026-07-31",
      annotatedTimeIst: "14:00",
      description:
        "Pink-circle Stch Mtm exhaustion: SMI bearish cross from deep overbought at 13:30, stall/doji at highs at 14:00, then dump with SMI exiting overbought and MACD bearish cross at 14:15.",
    },
    matches,
    matchCount: matches.length,
    notes,
    artifacts: {
      json: jsonRel,
      markdown: mdRel,
    },
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeMarkdown(payload, mdPath);

  console.log(
    `Scanned ${targetDates.length} trade days: ${targetDates[0] ?? "—"} → ${targetDates[targetDates.length - 1] ?? "—"}`,
  );
  console.log(`Data source: ${payload.dataRange.source}\n`);
  console.log(
    `${"Date".padEnd(12)} ${"Event".padEnd(7)} ${"RSI".padStart(7)} ${"BBup%".padStart(8)} ${"BBlo%".padStart(8)} ${"Drop%".padStart(7)}`,
  );
  console.log("-".repeat(56));
  for (const row of matches) {
    const mark = row.chartMatch ? "  <-- chart pink" : "";
    console.log(
      `${row.date.padEnd(12)} ${row.eventTimeIst.padEnd(7)} ${row.eventRsi.toFixed(2).padStart(7)} ${row.bbUpperProximity.gapPct.toFixed(3).padStart(8)} ${row.bbLowerProximity.gapPct.toFixed(3).padStart(8)} ${row.forwardDropPct.toFixed(2).padStart(7)}${mark}`,
    );
  }
  console.log(`\nMatches: ${matches.length}`);
  console.log(`Wrote ${jsonRel}`);
  console.log(`Wrote ${mdRel}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`deeppro scan failed: ${message}`);
  process.exit(1);
});
