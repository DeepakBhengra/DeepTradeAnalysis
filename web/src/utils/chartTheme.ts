import type { DeepPartial, ChartOptions } from "lightweight-charts";
import { formatIstCrosshairTime, formatIstTickMark } from "./istTime";

export interface ChartPalette {
  background: string;
  text: string;
  grid: string;
  border: string;
}

const lightPalette: ChartPalette = {
  background: "#ffffff",
  text: "#666666",
  grid: "#f0f0f0",
  border: "#eeeeee",
};

const darkPalette: ChartPalette = {
  background: "#161b22",
  text: "#8b949e",
  grid: "#21262d",
  border: "#30363d",
};

export function getChartPalette(isDark: boolean): ChartPalette {
  return isDark ? darkPalette : lightPalette;
}

export function getChartTheme(isDark: boolean): DeepPartial<ChartOptions> {
  const palette = getChartPalette(isDark);

  return {
    grid: {
      vertLines: { color: palette.grid },
      horzLines: { color: palette.grid },
    },
    rightPriceScale: {
      borderColor: palette.border,
    },
    localization: {
      locale: "en-IN",
      timeFormatter: formatIstCrosshairTime,
      dateFormat: "dd MMM 'yy",
    },
    timeScale: {
      borderColor: palette.border,
      timeVisible: true,
      secondsVisible: false,
      tickMarkFormatter: (time, tickMarkType) => formatIstTickMark(time, tickMarkType),
    },
  };
}

/** @deprecated Use getChartTheme(isDark) instead */
export const chartTheme = getChartTheme(false);

export function observeResize(
  container: HTMLElement,
  onResize: (width: number, height: number) => void,
): () => void {
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }
    onResize(entry.contentRect.width, entry.contentRect.height);
  });

  observer.observe(container);
  onResize(container.clientWidth, container.clientHeight);

  return () => observer.disconnect();
}
