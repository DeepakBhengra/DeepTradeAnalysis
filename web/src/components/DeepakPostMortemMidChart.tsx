import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";

import { useTheme } from "../hooks/useTheme";
import type { DashboardSeriesPoint } from "../types/dashboard";
import type { GradedPostMortemSignal } from "../types/postMortem";
import { candleMid } from "../utils/buildDeepakPostMortemReport";
import { getChartPalette, getChartTheme, observeResize } from "../utils/chartTheme";

interface DeepakPostMortemMidChartProps {
  series: DashboardSeriesPoint[];
  signals: GradedPostMortemSignal[];
}

export function DeepakPostMortemMidChart({
  series,
  signals,
}: DeepakPostMortemMidChartProps) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || series.length === 0) {
      return;
    }

    const palette = getChartPalette(isDark);
    const chart = createChart(container, {
      ...getChartTheme(isDark),
      layout: {
        background: { type: ColorType.Solid, color: palette.background },
        textColor: palette.text,
      },
      height: 260,
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
      },
    });

    const midSeries = chart.addLineSeries({
      color: "#42A5F5",
      lineWidth: 2,
      title: "Candle mid",
      priceLineVisible: false,
    });

    const midData: LineData[] = series.map((point) => ({
      time: point.time as UTCTimestamp,
      value: candleMid(point),
    }));
    midSeries.setData(midData);

    const priceLines = signals.map((signal) => {
      const color = signal.side === "BUY" ? "#4CAF50" : "#DF514C";
      return midSeries.createPriceLine({
        price: signal.entry,
        color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `${signal.side} ${signal.timeIst}`,
      });
    });

    chart.timeScale().fitContent();
    const cleanupResize = observeResize(container, (width, height) => {
      chart.applyOptions({ width, height: Math.max(height, 220) });
    });

    return () => {
      for (const line of priceLines) {
        midSeries.removePriceLine(line);
      }
      cleanupResize();
      chart.remove();
    };
  }, [series, signals, isDark]);

  if (series.length === 0) {
    return (
      <p className="m-0 text-xs text-kite-muted">No session candles to chart.</p>
    );
  }

  return (
    <div>
      <p className="m-0 mb-1 text-[10px] uppercase tracking-wide text-kite-muted">
        Session mid path · signal entry levels
      </p>
      <div ref={containerRef} className="w-full" />
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-3 p-0 text-[10px] text-kite-muted">
        {signals.map((signal) => (
          <li key={`${signal.id}-${signal.timeIst}-${signal.scenarioNumber}`}>
            <span
              className={
                signal.side === "BUY" ? "text-kite-green" : "text-kite-red"
              }
            >
              {signal.id} {signal.side}
            </span>{" "}
            @ {signal.timeIst} · {signal.entry.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}
