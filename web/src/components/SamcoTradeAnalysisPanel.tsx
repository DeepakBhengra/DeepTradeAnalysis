import type { ReactNode } from "react";
import type { SamcoLedgerEntry } from "../api/samco";
import { formatDayScanStrategy, formatExitType } from "../utils/backtestFormat";
import { formatCurrency, formatPnL } from "../utils/paperTrading";
import {
  buildSamcoTradeAnalysis,
  type SamcoTradeAnalysisRow,
} from "../utils/samcoTradeAnalysis";

function pnlClass(value: number): string {
  if (value > 0) {
    return "text-kite-green";
  }
  if (value < 0) {
    return "text-kite-red";
  }
  return "text-kite-text";
}

function sideClass(side: "BUY" | "SELL" | null): string {
  if (side === "BUY") {
    return "text-kite-green";
  }
  if (side === "SELL") {
    return "text-kite-red";
  }
  return "text-kite-muted";
}

function DetailRow({
  label,
  children,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-kite-muted">{label}</span>
      <span
        className={`min-w-0 text-right font-medium ${valueClassName ?? "text-kite-text"}`}
      >
        {children}
      </span>
    </div>
  );
}

function EntryPanel({ row }: { row: SamcoTradeAnalysisRow }) {
  return (
    <div className="min-w-0 flex-1 space-y-2 border border-kite-border/70 bg-kite-bg p-3">
      <h4 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-kite-muted">
        Entry
      </h4>
      <DetailRow label="Stock name">
        <span className="block">
          <span className="block text-kite-text">{row.tradingSymbol}</span>
          <span className="block text-[10px] font-normal text-kite-muted">
            {row.stockName}
          </span>
        </span>
      </DetailRow>
      <DetailRow label="Timing">{row.entry.timing ?? "—"}</DetailRow>
      <DetailRow label="Type of signal">{row.entry.signalType}</DetailRow>
      <DetailRow
        label="Trade type"
        valueClassName={sideClass(row.entry.tradeType)}
      >
        {row.entry.tradeType ?? "—"}
      </DetailRow>
      <DetailRow label="Price">
        {row.entry.price == null ? "—" : formatCurrency(row.entry.price)}
      </DetailRow>
      <DetailRow label="Qty">
        <span className="tabular-nums">{row.quantity}</span>
      </DetailRow>
      <DetailRow label="Strategy">
        {formatDayScanStrategy(
          row.strategy as Parameters<typeof formatDayScanStrategy>[0],
        )}
      </DetailRow>
    </div>
  );
}

function ExitPanel({ row }: { row: SamcoTradeAnalysisRow }) {
  const pending = row.status === "open";
  const breakdown = row.chargesBreakdown;

  return (
    <div className="min-w-0 flex-1 space-y-2 border border-kite-border/70 bg-kite-bg p-3">
      <h4 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-kite-muted">
        Square-off (Exit)
      </h4>
      <DetailRow label="Timing">
        {row.exit.timing ?? (pending ? "Pending" : "—")}
      </DetailRow>
      <DetailRow label="Type of signal">{row.exit.signalType}</DetailRow>
      <DetailRow
        label="Trade type"
        valueClassName={sideClass(row.exit.tradeType)}
      >
        {row.exit.tradeType ?? "—"}
      </DetailRow>
      <DetailRow label="Price">
        {row.exit.price == null ? "—" : formatCurrency(row.exit.price)}
      </DetailRow>
      <DetailRow label="Exit type">
        {pending
          ? "—"
          : row.exitReason
            ? formatExitType({
                exitReason: row.exitReason as Parameters<
                  typeof formatExitType
                >[0]["exitReason"],
                exitTimeIst: row.exit.timing,
              })
            : "—"}
      </DetailRow>
      <DetailRow label="Gross P&L">
        {row.grossPnL == null ? (
          "—"
        ) : (
          <span className={pnlClass(row.grossPnL)}>{formatPnL(row.grossPnL)}</span>
        )}
      </DetailRow>
      <DetailRow label="Taxes / charges">
        {row.charges == null ? "—" : formatCurrency(row.charges)}
      </DetailRow>
      {breakdown && (
        <div className="space-y-1 border-t border-kite-border/60 pt-2 text-[10px] text-kite-muted">
          <div className="flex justify-between gap-2">
            <span>Brokerage</span>
            <span className="tabular-nums">{formatCurrency(breakdown.brokerage)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>STT</span>
            <span className="tabular-nums">{formatCurrency(breakdown.stt)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Exchange</span>
            <span className="tabular-nums">
              {formatCurrency(breakdown.exchangeTxnCharges)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>SEBI</span>
            <span className="tabular-nums">
              {formatCurrency(breakdown.sebiCharges)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Stamp</span>
            <span className="tabular-nums">{formatCurrency(breakdown.stampDuty)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>GST</span>
            <span className="tabular-nums">{formatCurrency(breakdown.gst)}</span>
          </div>
        </div>
      )}
      <DetailRow label="Net P&L (after tax)">
        {row.netPnL == null ? (
          pending ? (
            <span className="text-kite-muted">Pending square-off</span>
          ) : (
            "—"
          )
        ) : (
          <span className={`tabular-nums ${pnlClass(row.netPnL)}`}>
            {formatPnL(row.netPnL)}
          </span>
        )}
      </DetailRow>
    </div>
  );
}

interface SamcoTradeAnalysisPanelProps {
  entries: SamcoLedgerEntry[];
}

export function SamcoTradeAnalysisPanel({
  entries,
}: SamcoTradeAnalysisPanelProps) {
  const rows = buildSamcoTradeAnalysis(entries);
  const closedCount = rows.filter((row) => row.status === "closed").length;
  const openCount = rows.filter((row) => row.status === "open").length;

  return (
    <section className="border border-kite-border bg-kite-surface p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-kite-muted">
          Trade Analysis
        </h3>
        <p className="m-0 text-[11px] text-kite-muted">
          Entry vs square-off · net P&amp;L after brokerage-charges · {openCount}{" "}
          open · {closedCount} closed
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 mb-0 text-xs text-kite-muted">
          No trade signals to analyse yet. Closed round-trips show taxes on exit.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((row) => (
            <article
              key={row.signalKey}
              className="border border-kite-border/80 bg-kite-surface"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-kite-border/60 px-3 py-2">
                <div>
                  <p className="m-0 text-xs font-semibold text-kite-text">
                    {row.tradingSymbol}
                  </p>
                  <p className="m-0 text-[10px] text-kite-muted">{row.stockName}</p>
                </div>
                <span
                  className={`rounded-sm border px-2 py-0.5 text-[10px] font-medium ${
                    row.status === "closed"
                      ? "border-kite-border text-kite-text"
                      : "border-kite-orange text-kite-orange"
                  }`}
                >
                  {row.status === "closed" ? "Squared off" : "Open"}
                </span>
              </div>
              <div className="grid gap-0 sm:grid-cols-2">
                <EntryPanel row={row} />
                <ExitPanel row={row} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
