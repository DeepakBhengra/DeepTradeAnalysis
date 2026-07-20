import { useEffect, useRef } from "react";
import { ColorType, createChart, type LineData, type UTCTimestamp } from "lightweight-charts";
import type { DashboardSeriesPoint } from "../types/dashboard";
import { useTheme } from "../hooks/useTheme";
import { getChartPalette, getChartTheme, observeResize } from "../utils/chartTheme";

const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 20;

interface RsiPanelProps {
  series: DashboardSeriesPoint[];
}

export function RsiPanel({ series }: RsiPanelProps) {
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
      rightPriceScale: {
        borderColor: palette.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    });

    const rsiSeries = chart.addLineSeries({
      color: "#7E57C2",
      lineWidth: 2,
      title: "RSI(14)",
    });

    const overboughtSeries = chart.addLineSeries({
      color: "#DF514C",
      lineWidth: 1,
      lineStyle: 2,
      title: String(RSI_OVERBOUGHT),
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const oversoldSeries = chart.addLineSeries({
      color: "#4CAF50",
      lineWidth: 1,
      lineStyle: 2,
      title: "20",
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const rsiData: LineData[] = [];
    for (const point of series) {
      if (point.rsi != null) {
        rsiData.push({ time: point.time as UTCTimestamp, value: point.rsi });
      }
    }

    const guidePoints = rsiData.map((point) => ({
      time: point.time,
      value: RSI_OVERBOUGHT,
    }));
    const oversoldPoints = rsiData.map((point) => ({
      time: point.time,
      value: RSI_OVERSOLD,
    }));

    rsiSeries.setData(rsiData);
    overboughtSeries.setData(guidePoints);
    oversoldSeries.setData(oversoldPoints);
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
        RSI (14)
      </h2>
      <div ref={containerRef} className="min-h-[90px] w-full" />
    </section>
  );
}
