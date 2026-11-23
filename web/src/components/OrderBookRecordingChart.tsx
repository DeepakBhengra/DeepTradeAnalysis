import { useEffect, useMemo, useRef } from "react";
import {
  ColorType,
  createChart,
  type LineData,
  type MouseEventParams,
  type SeriesMarker,
  type UTCTimestamp,
} from "lightweight-charts";

import { useTheme } from "../hooks/useTheme";
import type { OrderBookGraphPoint } from "../utils/orderBookGraph";
import { buildOrderBookGraphPoints } from "../utils/orderBookGraph";
import type { OrderBookRecordingSample } from "../types/orderBook";
import { getChartPalette, getChartTheme, observeResize } from "../utils/chartTheme";
import { formatIstCrosshairTime, IST_TIMEZONE } from "../utils/istTime";

interface OrderBookRecordingChartProps {
  samples: OrderBookRecordingSample[];
}

function formatQty(value: number): string {
  return value.toLocaleString("en-IN");
}

function formatCrosshairTimeWithSeconds(time: UTCTimestamp): string {
  const date = new Date(time * 1000);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function pointByTime(
  points: OrderBookGraphPoint[],
  time: UTCTimestamp,
): OrderBookGraphPoint | undefined {
  return points.find((point) => point.time === time);
}

export function OrderBookRecordingChart({ samples }: OrderBookRecordingChartProps) {
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const points = useMemo(() => buildOrderBookGraphPoints(samples), [samples]);
  const latest = points[points.length - 1] ?? null;
  const annotateMarkers = points.length <= 40;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || points.length === 0) {
      return;
    }

    const palette = getChartPalette(isDark);
    const chart = createChart(container, {
      ...getChartTheme(isDark),
      layout: {
        background: { type: ColorType.Solid, color: palette.background },
        textColor: palette.text,
        attributionLogo: false,
      },
      localization: {
        locale: "en-IN",
        timeFormatter: (time) =>
          `${formatIstCrosshairTime(time)} ${formatCrosshairTimeWithSeconds(time as UTCTimestamp)}`,
      },
      timeScale: {
        borderColor: palette.border,
        timeVisible: true,
        secondsVisible: true,
      },
      height: 260,
    });

    const stockSeries = chart.addLineSeries({
      color: "#2196F3",
      lineWidth: 2,
      title: "Stock price",
      priceLineVisible: false,
    });
    const bidSeries = chart.addLineSeries({
      color: "#4CAF50",
      lineWidth: 1,
      title: "Highest qty of 5 BIDs",
      priceLineVisible: false,
    });
    const offerSeries = chart.addLineSeries({
      color: "#DF514C",
      lineWidth: 1,
      title: "Highest qty of 5 OFFERs",
      priceLineVisible: false,
    });

    const stock: LineData[] = [];
    const bids: LineData[] = [];
    const offers: LineData[] = [];
    const bidMarkers: SeriesMarker<UTCTimestamp>[] = [];
    const offerMarkers: SeriesMarker<UTCTimestamp>[] = [];

    for (const point of points) {
      const time = point.time as UTCTimestamp;
      stock.push({ time, value: point.stockPrice });
      if (point.highestBidQty) {
        bids.push({ time, value: point.highestBidQty.price });
        bidMarkers.push({
          time,
          position: "inBar",
          shape: "circle",
          color: "#4CAF50",
          text: annotateMarkers
            ? `L${point.highestBidQty.level} ${point.highestBidQty.price.toFixed(2)} × ${formatQty(point.highestBidQty.quantity)}`
            : undefined,
        });
      }
      if (point.highestOfferQty) {
        offers.push({ time, value: point.highestOfferQty.price });
        offerMarkers.push({
          time,
          position: "inBar",
          shape: "circle",
          color: "#DF514C",
          text: annotateMarkers
            ? `L${point.highestOfferQty.level} ${point.highestOfferQty.price.toFixed(2)} × ${formatQty(point.highestOfferQty.quantity)}`
            : undefined,
        });
      }
    }

    stockSeries.setData(stock);
    bidSeries.setData(bids);
    offerSeries.setData(offers);
    bidSeries.setMarkers(bidMarkers);
    offerSeries.setMarkers(offerMarkers);
    chart.timeScale().fitContent();

    const handleCrosshairMove = (param: MouseEventParams) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) {
        return;
      }
      if (!param.time || param.point === undefined) {
        tooltip.style.display = "none";
        return;
      }

      const point = pointByTime(points, param.time as UTCTimestamp);
      if (!point) {
        tooltip.style.display = "none";
        return;
      }

      const bid = point.highestBidQty
        ? `L${point.highestBidQty.level} ${point.highestBidQty.price.toFixed(2)} × ${formatQty(point.highestBidQty.quantity)}`
        : "—";
      const offer = point.highestOfferQty
        ? `L${point.highestOfferQty.level} ${point.highestOfferQty.price.toFixed(2)} × ${formatQty(point.highestOfferQty.quantity)}`
        : "—";
      tooltip.innerHTML = `
        <div class="text-kite-muted">${point.recordedAtIst}</div>
        <div>Stock <span class="font-medium text-kite-blue">${point.stockPrice.toFixed(2)}</span></div>
        <div>Highest of 5 BIDs <span class="font-medium text-kite-green">${bid}</span></div>
        <div>Highest of 5 OFFERs <span class="font-medium text-kite-red">${offer}</span></div>
      `;
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
      chart.applyOptions({ width, height: Math.max(height, 220) });
    });

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      disconnect();
      chart.remove();
    };
  }, [points, isDark, annotateMarkers]);

  if (points.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-kite-border/60 pt-3">
      <p className="m-0 mb-1 text-[10px] uppercase tracking-wide text-kite-muted">
        Stock price vs time · highest qty of 5 bids / offers
      </p>
      <div className="relative min-h-[220px] w-full">
        <div ref={containerRef} className="h-[260px] w-full" />
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-10 hidden rounded border border-kite-border bg-kite-surface/95 px-2 py-1 text-[10px] tabular-nums shadow-sm"
        />
      </div>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[10px] tabular-nums text-kite-muted">
        <li>
          <span className="text-kite-blue">Stock</span>{" "}
          {latest ? latest.stockPrice.toFixed(2) : "—"}
        </li>
        <li>
          <span className="text-kite-green">Highest of 5 BIDs</span>{" "}
          {latest?.highestBidQty
            ? `L${latest.highestBidQty.level} ${latest.highestBidQty.price.toFixed(2)} × ${formatQty(latest.highestBidQty.quantity)}`
            : "—"}
        </li>
        <li>
          <span className="text-kite-red">Highest of 5 OFFERs</span>{" "}
          {latest?.highestOfferQty
            ? `L${latest.highestOfferQty.level} ${latest.highestOfferQty.price.toFixed(2)} × ${formatQty(latest.highestOfferQty.quantity)}`
            : "—"}
        </li>
      </ul>
    </div>
  );
}
