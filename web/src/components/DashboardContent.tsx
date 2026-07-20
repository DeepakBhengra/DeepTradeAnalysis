import type { ReactNode } from "react";

import { AnalysisDatePicker } from "./AnalysisDatePicker";
import { BbProximityCard } from "./BbProximityCard";
import { ConfidenceCard } from "./ConfidenceCard";
import { DeepakSignalCard } from "./DeepakSignalCard";
import { MacdPanel } from "./MacdPanel";
import { OrderBookCard } from "./OrderBookCard";
import { PriceChart } from "./PriceChart";
import { ReasonsList } from "./ReasonsList";
import { RsiPanel } from "./RsiPanel";
import { SignalCard } from "./SignalCard";
import { SidewaysTrendCard } from "./SidewaysTrendCard";
import { VolumePanel } from "./VolumePanel";
import type { DashboardPayload } from "../types/dashboard";
import { formatIstDateTime } from "../utils/istTime";

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(1)}K`;
  }
  return String(volume);
}

interface DashboardContentProps {
  data: DashboardPayload | null;
  loading: boolean;
  error: string | null;
  analysisDate: string | null;
  onAnalysisDateChange: (date: string | null) => void;
  onRefresh: () => void;
  headerExtra?: ReactNode;
  showDatePicker?: boolean;
  showRefresh?: boolean;
  modeOverride?: string;
}

export function DashboardContent({
  data,
  loading,
  error,
  analysisDate,
  onAnalysisDateChange,
  onRefresh,
  headerExtra,
  showDatePicker = true,
  showRefresh = true,
  modeOverride,
}: DashboardContentProps) {
  const effectiveMode =
    data?.mode === "simulation" || analysisDate ? "historical" : "live";
  const modeLabel =
    modeOverride ??
    (data?.mode === "simulation"
      ? `Simulation · ${data.simulation?.simulatedTimeIst ?? ""} IST`
      : analysisDate
        ? "historical"
        : "live");
  const latestCandle = data?.series[data.series.length - 1];

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-kite-border bg-kite-surface px-3 py-2">
        <div>
          {headerExtra}
          <p className="m-0 text-xs text-kite-muted">
            {data
              ? `${data.symbol} · ${data.interval} · ${modeLabel} · ${data.candleCount} candles`
              : "Loading market data..."}
          </p>
          {latestCandle && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
              <span>
                O{" "}
                <span className="font-medium text-kite-text">
                  {latestCandle.open.toFixed(2)}
                </span>
              </span>
              <span>
                H{" "}
                <span className="font-medium text-kite-green">
                  {latestCandle.high.toFixed(2)}
                </span>
              </span>
              <span>
                L{" "}
                <span className="font-medium text-kite-red">
                  {latestCandle.low.toFixed(2)}
                </span>
              </span>
              <span>
                C{" "}
                <span className="font-medium text-kite-text">
                  {latestCandle.close.toFixed(2)}
                </span>
              </span>
              <span>
                Vol{" "}
                <span className="font-medium text-kite-text">
                  {formatVolume(latestCandle.volume)}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {showDatePicker && (
            <AnalysisDatePicker analysisDate={analysisDate} onChange={onAnalysisDateChange} />
          )}
          <p className="m-0 text-[10px] uppercase tracking-wide text-kite-muted">Updated</p>
          <p className="m-0 text-xs tabular-nums">
            {data ? formatIstDateTime(data.updatedAt) : "—"}
          </p>
          {showRefresh && (
            <button
              type="button"
              className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2.5 py-1 text-xs text-kite-text hover:bg-kite-surface"
              onClick={onRefresh}
            >
              Refresh
            </button>
          )}
        </div>
      </header>

      <main className="p-2">
        {loading && !data && (
          <p className="mt-2 text-xs text-kite-muted">Loading dashboard...</p>
        )}
        {error && <p className="mt-2 text-xs text-kite-red">{error}</p>}

        {data && (
          <div className="flex flex-col gap-px bg-kite-border">
            <div className="grid grid-cols-1 gap-px bg-kite-border lg:grid-cols-[1fr_1fr]">
              <SignalCard
                decision={data.decision}
                close={data.close}
                latestClosedAt={data.latestClosedAt}
                confidence={data.confidence}
              />
              <ConfidenceCard confidence={data.confidence} />
            </div>

            <DeepakSignalCard
              deepakDecision={data.deepakDecision}
              decision={data.decision}
              title="Deepak"
            />

            <DeepakSignalCard
              deepakDecision={data.deepak2Decision}
              decision={data.deepak2Decision?.decision ?? "HOLD"}
              title="Deepak-2"
            />

            <SidewaysTrendCard
              sidewaysTrend={data.sidewaysTrend}
              sidewaysDebug={data.sidewaysDebug}
              candleCount={data.candleCount}
              analysisDate={analysisDate}
              mode={effectiveMode}
            />

            <BbProximityCard bbProximity={data.bbProximity} analysisDate={analysisDate} />

            <div className="border border-kite-border bg-kite-surface p-2">
              <div className="mb-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-kite-muted">
                <span className="rounded-sm bg-kite-surface px-1.5 py-0.5">15m</span>
                <span className="rounded-sm bg-kite-surface px-1.5 py-0.5">Candlestick</span>
                <span className="rounded-sm bg-kite-surface px-1.5 py-0.5">BB</span>
              </div>
              <PriceChart series={data.series} sidewaysTrend={data.sidewaysTrend} />
            </div>

            <RsiPanel series={data.series} />
            <MacdPanel series={data.series} />
            <VolumePanel series={data.series} />

            <OrderBookCard depth={data.depth} mode={effectiveMode} />

            <ReasonsList reasons={data.reasons} />
          </div>
        )}
      </main>
    </>
  );
}
