import { useState } from "react";

import { AnalysisDatePicker } from "../components/AnalysisDatePicker";
import { DashboardContent } from "../components/DashboardContent";
import { SimulationControls } from "../components/SimulationControls";
import { StockSymbolInput } from "../components/StockSymbolInput";
import { useDashboardSimulation } from "../hooks/useDashboardSimulation";

const DEFAULT_SYMBOL = "RELIANCE";
const SYMBOL_STORAGE_KEY = "stock-simulator-symbol";
const DEFAULT_ANALYSIS_DATE = "2026-06-19";

function readStoredSymbol(): string {
  const stored = localStorage.getItem(SYMBOL_STORAGE_KEY)?.trim().toUpperCase();
  return stored || DEFAULT_SYMBOL;
}

interface StockSimulatorWidgetProps {
  isActive: boolean;
}

export function StockSimulatorWidget({ isActive }: StockSimulatorWidgetProps) {
  const [symbolInput, setSymbolInput] = useState(readStoredSymbol);
  const [activeSymbol, setActiveSymbol] = useState(readStoredSymbol);
  const [analysisDate, setAnalysisDate] = useState(DEFAULT_ANALYSIS_DATE);

  const {
    data,
    loading,
    error,
    status,
    sessionIndex,
    sessionCandleCount,
    simulatedTimeIst,
    start,
    pause,
    stop,
  } = useDashboardSimulation(activeSymbol, analysisDate);

  const handleLoad = () => {
    const normalized = symbolInput.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    setActiveSymbol(normalized);
    localStorage.setItem(SYMBOL_STORAGE_KEY, normalized);
  };

  const modeOverride =
    simulatedTimeIst != null
      ? `Simulation · ${simulatedTimeIst} IST`
      : "Simulation · press Start";

  return (
    <div hidden={!isActive}>
      <StockSymbolInput
        value={symbolInput}
        onChange={setSymbolInput}
        onLoad={handleLoad}
        loading={loading && status === "loading"}
      />
      <div className="border-b border-kite-border bg-kite-surface px-3 py-2">
        <AnalysisDatePicker
          analysisDate={analysisDate}
          onChange={(date) => {
            if (date) {
              setAnalysisDate(date);
            }
          }}
          showTodayButton={false}
        />
      </div>
      <DashboardContent
        data={data}
        loading={loading}
        error={error}
        analysisDate={analysisDate}
        onAnalysisDateChange={() => {}}
        onRefresh={() => {}}
        showDatePicker={false}
        showRefresh={false}
        modeOverride={modeOverride}
        headerExtra={
          <SimulationControls
            status={status}
            sessionIndex={sessionIndex}
            sessionCandleCount={sessionCandleCount}
            simulatedTimeIst={simulatedTimeIst}
            loading={loading}
            onStart={start}
            onPause={pause}
            onStop={stop}
          />
        }
      />
    </div>
  );
}
