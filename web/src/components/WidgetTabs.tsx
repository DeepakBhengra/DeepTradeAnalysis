export type AppWidget =
  | "stockDashboard"
  | "deepakBacktest"
  | "deepakDayScan"
  | "deepak2Backtest"
  | "deepak2DayScan"
  | "deepak3DayScan"
  | "deepakWatchPartyDayScan"
  | "dayScanSimulator"
  | "dayOrderSimulator"
  | "samcoTrading"
  | "deepakPostMortem";

interface WidgetTabsProps {
  active: AppWidget;
  onChange: (widget: AppWidget) => void;
}

const tabs: Array<{ id: AppWidget; label: string }> = [
  { id: "stockDashboard", label: "Stock 15m Dashboard" },
  { id: "deepakBacktest", label: "Deepak Backtest" },
  { id: "deepakDayScan", label: "Deepak Day Scan" },
  { id: "deepak2Backtest", label: "Deepak-2 Backtest" },
  { id: "deepak2DayScan", label: "Deepak-2 Day Scan" },
  { id: "deepak3DayScan", label: "Deepak-3 Day Scan" },
  { id: "deepakWatchPartyDayScan", label: "Watch Party Day Scan" },
  { id: "deepakPostMortem", label: "Deepak Post-Mortem" },
  { id: "dayScanSimulator", label: "Day Scan Simulator" },
  { id: "dayOrderSimulator", label: "Day Order Simulator" },
  { id: "samcoTrading", label: "Samco Trading" },
];

export function WidgetTabs({ active, onChange }: WidgetTabsProps) {
  return (
    <nav className="flex gap-4 border-b border-kite-border bg-kite-surface px-3">
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`cursor-pointer border-b-2 px-1 py-2.5 text-xs font-medium transition-colors ${
              selected
                ? "border-kite-orange text-kite-orange"
                : "border-transparent text-kite-muted hover:text-kite-text"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
