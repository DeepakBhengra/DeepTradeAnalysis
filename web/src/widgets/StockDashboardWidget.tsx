import { useEffect, useState } from "react";

import { DashboardContent } from "../components/DashboardContent";
import { StockSymbolInput } from "../components/StockSymbolInput";
import { useDashboardData } from "../hooks/useDashboardData";

const DEFAULT_SYMBOL = "RELIANCE";
const SYMBOL_STORAGE_KEY = "stock-dashboard-symbol";
const DEFAULT_ANALYSIS_DATE = "2026-06-19";

function readStoredSymbol(): string {
  const stored = localStorage.getItem(SYMBOL_STORAGE_KEY)?.trim().toUpperCase();
  return stored || DEFAULT_SYMBOL;
}

interface StockDashboardWidgetProps {
  isActive: boolean;
  refreshTrigger?: number;
}

export function StockDashboardWidget({
  isActive,
  refreshTrigger = 0,
}: StockDashboardWidgetProps) {
  const [symbolInput, setSymbolInput] = useState(readStoredSymbol);
  const [activeSymbol, setActiveSymbol] = useState(readStoredSymbol);
  const [analysisDate, setAnalysisDate] = useState<string | null>(DEFAULT_ANALYSIS_DATE);
  const { data, loading, error, refresh } = useDashboardData(activeSymbol, analysisDate);

  const handleLoad = () => {
    const normalized = symbolInput.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    setActiveSymbol(normalized);
    localStorage.setItem(SYMBOL_STORAGE_KEY, normalized);
  };

  useEffect(() => {
    if (refreshTrigger > 0 && isActive) {
      void refresh();
    }
  }, [refreshTrigger, isActive, refresh]);

  return (
    <div hidden={!isActive}>
      <StockSymbolInput
        value={symbolInput}
        onChange={setSymbolInput}
        onLoad={handleLoad}
        loading={loading}
      />
      <DashboardContent
        data={data}
        loading={loading}
        error={error}
        analysisDate={analysisDate}
        onAnalysisDateChange={setAnalysisDate}
        onRefresh={() => void refresh()}
      />
    </div>
  );
}
