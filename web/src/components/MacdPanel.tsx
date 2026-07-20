import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { DashboardSeriesPoint } from "../types/dashboard";
import { useTheme } from "../hooks/useTheme";
import { getChartPalette, getChartTheme, observeResize } from "../utils/chartTheme";

interface MacdPanelProps {
  series: DashboardSeriesPoint[];
}

export function MacdPanel({ series }: MacdPanelProps) {
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
      height: 100,
    });

    const histogramSeries = chart.addHistogramSeries({
      title: "Histogram",
    });
    const macdSeries = chart.addLineSeries({
      color: "#2196F3",
      lineWidth: 2,
      title: "MACD",
    });
    const signalSeries = chart.addLineSeries({
      color: "#FF5722",
      lineWidth: 2,
      title: "Signal",
    });

    const histogram: HistogramData[] = [];
    const macdData: LineData[] = [];
    const signalData: LineData[] = [];

    for (const point of series) {
      if (point.histogram != null) {
        histogram.push({
          time: point.time as UTCTimestamp,
          value: point.histogram,
          color: point.histogram >= 0 ? "#4CAF50" : "#DF514C",
        });
      }
      if (point.macd != null) {
        macdData.push({ time: point.time as UTCTimestamp, value: point.macd });
      }
      if (point.signal != null) {
        signalData.push({ time: point.time as UTCTimestamp, value: point.signal });
      }
    }

    histogramSeries.setData(histogram);
    macdSeries.setData(macdData);
    signalSeries.setData(signalData);
    chart.timeScale().fitContent();

    const disconnect = observeResize(container, (width, height) => {
      chart.applyOptions({ width, height: Math.max(height, 90) });
    });

    return () => {
      disconnect();
      chart.remove();
    };
  }, [series, isDark]);

  return (
    <section className="border border-kite-border bg-kite-surface p-2">
      <h2 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-kite-muted">
        MACD (12, 26, 9)
      </h2>
      <div ref={containerRef} className="min-h-[90px] w-full" />
    </section>
  );
}
