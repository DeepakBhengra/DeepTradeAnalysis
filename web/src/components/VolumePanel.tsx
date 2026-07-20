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

interface VolumePanelProps {
  series: DashboardSeriesPoint[];
}

export function VolumePanel({ series }: VolumePanelProps) {
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
      height: 120,
      rightPriceScale: {
        borderColor: palette.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      leftPriceScale: {
        visible: true,
        borderColor: palette.border,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      color: "#42A5F5",
      priceFormat: { type: "volume" },
      priceScaleId: "right",
    });

    const rvolSeries = chart.addLineSeries({
      color: "#FF9800",
      lineWidth: 2,
      title: "RVOL",
      priceScaleId: "left",
    });

    const volumeData: HistogramData[] = series.map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.volume,
      color: point.close >= point.open ? "#4CAF5080" : "#DF514C80",
    }));

    const rvolData: LineData[] = [];
    for (const point of series) {
      if (point.relVolume != null) {
        rvolData.push({ time: point.time as UTCTimestamp, value: point.relVolume });
      }
    }

    volumeSeries.setData(volumeData);
    rvolSeries.setData(rvolData);
    chart.timeScale().fitContent();

    const disconnect = observeResize(container, (width, height) => {
      chart.applyOptions({ width, height: Math.max(height, 100) });
    });

    return () => {
      disconnect();
      chart.remove();
    };
  }, [series, isDark]);

  return (
    <section className="border border-kite-border bg-kite-surface p-2">
      <h2 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-kite-muted">
        Volume + Relative Volume (RVOL)
      </h2>
      <div ref={containerRef} className="min-h-[100px] w-full" />
    </section>
  );
}
