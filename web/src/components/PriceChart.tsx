import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  type CandlestickData,
  type LineData,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import type { DashboardSeriesPoint, SidewaysTrendState } from "../types/dashboard";
import { useTheme } from "../hooks/useTheme";
import { getChartPalette, getChartTheme, observeResize } from "../utils/chartTheme";

interface PriceChartProps {
  series: DashboardSeriesPoint[];
  sidewaysTrend?: SidewaysTrendState | null;
}

export function PriceChart({ series, sidewaysTrend }: PriceChartProps) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const highRef = useRef<HTMLSpanElement>(null);
  const lowRef = useRef<HTMLSpanElement>(null);

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
      height: 300,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#4CAF50",
      downColor: "#DF514C",
      borderVisible: false,
      wickUpColor: "#4CAF50",
      wickDownColor: "#DF514C",
    });

    const upperSeries = chart.addLineSeries({
      color: "#90CAF9",
      lineWidth: 1,
      title: "BB Upper",
    });
    const middleSeries = chart.addLineSeries({
      color: isDark ? "#6e7681" : "#BDBDBD",
      lineWidth: 1,
      title: "BB Middle",
    });
    const lowerSeries = chart.addLineSeries({
      color: "#90CAF9",
      lineWidth: 1,
      title: "BB Lower",
    });

    const topRangeSeries = chart.addLineSeries({
      color: "#FF9800",
      lineWidth: 2,
      lineStyle: 2,
      title: "BB Top Range",
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const bottomRangeSeries = chart.addLineSeries({
      color: "#26A69A",
      lineWidth: 2,
      lineStyle: 2,
      title: "BB Bottom Range",
      priceLineVisible: false,
      lastValueVisible: true,
    });

    const candles: CandlestickData[] = series.map((point) => ({
      time: point.time as UTCTimestamp,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
    }));

    const upper: LineData[] = [];
    const middle: LineData[] = [];
    const lower: LineData[] = [];

    for (const point of series) {
      if (point.bbUpper != null) {
        upper.push({ time: point.time as UTCTimestamp, value: point.bbUpper });
      }
      if (point.bbMiddle != null) {
        middle.push({ time: point.time as UTCTimestamp, value: point.bbMiddle });
      }
      if (point.bbLower != null) {
        lower.push({ time: point.time as UTCTimestamp, value: point.bbLower });
      }
    }

    candleSeries.setData(candles);
    upperSeries.setData(upper);
    middleSeries.setData(middle);
    lowerSeries.setData(lower);

    if (
      sidewaysTrend?.bbTopRange != null &&
      sidewaysTrend?.bbBottomRange != null &&
      series.length > 0
    ) {
      const topRangePoints = series.map((point) => ({
        time: point.time as UTCTimestamp,
        value: sidewaysTrend.bbTopRange as number,
      }));
      const bottomRangePoints = series.map((point) => ({
        time: point.time as UTCTimestamp,
        value: sidewaysTrend.bbBottomRange as number,
      }));
      topRangeSeries.setData(topRangePoints);
      bottomRangeSeries.setData(bottomRangePoints);
    }

    chart.timeScale().fitContent();

    const handleCrosshairMove = (param: MouseEventParams) => {
      const tooltip = tooltipRef.current;
      const highEl = highRef.current;
      const lowEl = lowRef.current;
      if (!tooltip || !highEl || !lowEl) {
        return;
      }

      if (!param.time || param.point === undefined) {
        tooltip.style.display = "none";
        return;
      }

      const candleData = param.seriesData.get(candleSeries) as CandlestickData | undefined;
      if (candleData?.high == null || candleData.low == null) {
        tooltip.style.display = "none";
        return;
      }

      highEl.textContent = candleData.high.toFixed(2);
      lowEl.textContent = candleData.low.toFixed(2);
      tooltip.style.display = "block";

      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const padding = 12;

      let left = param.point.x + padding;
      let top = param.point.y - tooltipHeight - padding;

      if (left + tooltipWidth > container.clientWidth) {
        left = param.point.x - tooltipWidth - padding;
      }
      if (top < 0) {
        top = param.point.y + padding;
      }

      tooltip.style.left = `${Math.max(0, left)}px`;
      tooltip.style.top = `${Math.max(0, top)}px`;
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    const disconnect = observeResize(container, (width, height) => {
      chart.applyOptions({ width, height: Math.max(height, 240) });
    });

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      disconnect();
      chart.remove();
    };
  }, [series, sidewaysTrend, isDark]);

  return (
    <div className="relative min-h-[240px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 hidden rounded border border-kite-border bg-kite-surface/95 px-2 py-1 text-xs tabular-nums shadow-sm"
      >
        <div>
          H <span ref={highRef} className="font-medium text-kite-green" />
        </div>
        <div>
          L <span ref={lowRef} className="font-medium text-kite-red" />
        </div>
      </div>
    </div>
  );
}
