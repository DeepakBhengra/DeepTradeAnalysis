import { useEffect, useState } from "react";

import { KiteConnectButton } from "./components/KiteConnectButton";
import { ThemeToggle } from "./components/ThemeToggle";
import { WidgetTabs, type AppWidget } from "./components/WidgetTabs";
import { DayScanSimulationProvider } from "./context/DayScanSimulationContext";
import { Deepak2BacktestWidget } from "./widgets/Deepak2BacktestWidget";
import { Deepak2DayScanWidget } from "./widgets/Deepak2DayScanWidget";
import { Deepak3DayScanWidget } from "./widgets/Deepak3DayScanWidget";
import { DeepakBacktestWidget } from "./widgets/DeepakBacktestWidget";
import { DeepakDayScanWidget } from "./widgets/DeepakDayScanWidget";
import { DayOrderSimulatorWidget } from "./widgets/DayOrderSimulatorWidget";
import { DayScanSimulatorWidget } from "./widgets/DayScanSimulatorWidget";
import { DeepakPostMortemWidget } from "./widgets/DeepakPostMortemWidget";
import { DeepakWatchPartyDayScanWidget } from "./widgets/DeepakWatchPartyDayScanWidget";
import { SamcoTradingWidget } from "./widgets/SamcoTradingWidget";
import { StockDashboardWidget } from "./widgets/StockDashboardWidget";
import { StockSimulatorWidget } from "./widgets/StockSimulatorWidget";
import { readLocalStorage, writeLocalStorage } from "./utils/safeStorage";

const TAB_STORAGE_KEY = "trading-active-widget";
const LEGACY_TAB_STORAGE_KEY = "pnb-active-widget";

const subtitles: Record<AppWidget, string> = {
  stockDashboard: "15m signals and charts for any NSE equity.",
  stockSimulator: "Replay a past session candle-by-candle as if live (10s per 15m bar).",
  deepakBacktest: "Backtest Deepak BUY/SELL scenarios over a date range for any NSE equity.",
  deepakDayScan: "Run Deepak BUY/SELL rules on 20 sector large-caps for a single session date.",
  deepak2Backtest:
    "Backtest Deepak-2 BUY/SELL scenarios (10:15 IST session) over a date range for any NSE equity.",
  deepak2DayScan:
    "Run Deepak-2 BUY/SELL rules on 20 sector large-caps for a single session date (10:15 IST).",
  deepak3DayScan:
    "Run Deepak-3 sure-shot filters on 20 sector large-caps for a single session date (09:15 IST).",
  deepakWatchPartyDayScan:
    "Run Deepak @ 10:15 entries with Deepak-2 watch-party stop-loss across 20 sector large-caps.",
  deepakPostMortem:
    "Grade Deepak / Deepak-2 signals vs the session path for any NSE symbol and date.",
  dayScanSimulator:
    "Replay Deepak, Deepak-2, and Watch Party sector signals candle-by-candle from 09:15–15:00 IST.",
  dayOrderSimulator:
    "Auto paper-trade Day Scan entry/exit signals with ₹3,00,000 capital (100 qty, max ₹1,900).",
  samcoTrading:
    "Samco MIS execution: Deepak + Deepak-2 day scan (50 stocks), entry price range, logs.",
};

function readStoredTab(): AppWidget {
  const stored =
    readLocalStorage(TAB_STORAGE_KEY) ?? readLocalStorage(LEGACY_TAB_STORAGE_KEY);

  if (stored === "stockDashboard") {
    return "stockDashboard";
  }
  if (stored === "bbTrendBacktest" || stored === "deepakBacktest") {
    return "deepakBacktest";
  }
  if (stored === "deepakDayScan") {
    return "deepakDayScan";
  }
  if (stored === "deepak2Backtest") {
    return "deepak2Backtest";
  }
  if (stored === "deepak2DayScan") {
    return "deepak2DayScan";
  }
  if (stored === "deepak3DayScan") {
    return "deepak3DayScan";
  }
  if (stored === "deepakWatchPartyDayScan") {
    return "deepakWatchPartyDayScan";
  }
  if (stored === "deepakPostMortem") {
    return "deepakPostMortem";
  }
  if (stored === "dayScanSimulator") {
    return "dayScanSimulator";
  }
  if (stored === "dayOrderSimulator") {
    return "dayOrderSimulator";
  }
  if (stored === "samcoTrading") {
    return "samcoTrading";
  }
  if (stored === "stockSimulator") {
    return "stockSimulator";
  }
  return "stockDashboard";
}

export function App() {
  const [activeWidget, setActiveWidget] = useState<AppWidget>(readStoredTab);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    writeLocalStorage(TAB_STORAGE_KEY, activeWidget);
  }, [activeWidget]);

  const handleKiteConnected = () => {
    setRefreshTrigger((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-kite-bg text-kite-text">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-kite-orange px-3 py-2">
        <div>
          <h1 className="m-0 text-base font-semibold text-kite-text">
            Trading Tools
          </h1>
          <p className="mt-1 text-xs text-kite-muted">{subtitles[activeWidget]}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ThemeToggle />
          <KiteConnectButton onConnected={handleKiteConnected} />
        </div>
      </header>

      <WidgetTabs active={activeWidget} onChange={setActiveWidget} />

      <StockDashboardWidget
        isActive={activeWidget === "stockDashboard"}
        refreshTrigger={refreshTrigger}
      />
      <StockSimulatorWidget isActive={activeWidget === "stockSimulator"} />
      <DeepakBacktestWidget
        isActive={activeWidget === "deepakBacktest"}
        refreshTrigger={refreshTrigger}
      />
      <DeepakDayScanWidget
        isActive={activeWidget === "deepakDayScan"}
        refreshTrigger={refreshTrigger}
      />
      <Deepak2BacktestWidget
        isActive={activeWidget === "deepak2Backtest"}
        refreshTrigger={refreshTrigger}
      />
      <Deepak2DayScanWidget
        isActive={activeWidget === "deepak2DayScan"}
        refreshTrigger={refreshTrigger}
      />
      <Deepak3DayScanWidget
        isActive={activeWidget === "deepak3DayScan"}
        refreshTrigger={refreshTrigger}
      />
      <DeepakWatchPartyDayScanWidget
        isActive={activeWidget === "deepakWatchPartyDayScan"}
        refreshTrigger={refreshTrigger}
      />
      <DeepakPostMortemWidget
        isActive={activeWidget === "deepakPostMortem"}
        refreshTrigger={refreshTrigger}
      />
      <DayScanSimulationProvider>
        <DayScanSimulatorWidget isActive={activeWidget === "dayScanSimulator"} />
        <DayOrderSimulatorWidget isActive={activeWidget === "dayOrderSimulator"} />
      </DayScanSimulationProvider>
      <SamcoTradingWidget isActive={activeWidget === "samcoTrading"} />
    </div>
  );
}
