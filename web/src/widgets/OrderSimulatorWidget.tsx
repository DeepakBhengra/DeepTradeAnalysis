import { useState } from "react";

import { AnalysisDatePicker } from "../components/AnalysisDatePicker";
import { DashboardContent } from "../components/DashboardContent";
import { OrderEntryForm } from "../components/OrderEntryForm";
import { PositionPnLPanel } from "../components/PositionPnLPanel";
import { SimulationControls } from "../components/SimulationControls";
import { StockSymbolInput } from "../components/StockSymbolInput";
import { useDashboardSimulation } from "../hooks/useDashboardSimulation";
import { usePaperTrading } from "../hooks/usePaperTrading";
import { todayIstDateKey } from "../utils/istTime";

const DEFAULT_SYMBOL = "RELIANCE";
const SYMBOL_STORAGE_KEY = "order-simulator-symbol";

function readStoredSymbol(): string {
  const stored = localStorage.getItem(SYMBOL_STORAGE_KEY)?.trim().toUpperCase();
  return stored || DEFAULT_SYMBOL;
}

interface OrderSimulatorWidgetProps {
  isActive: boolean;
}

export function OrderSimulatorWidget({ isActive }: OrderSimulatorWidgetProps) {
  const [symbolInput, setSymbolInput] = useState(readStoredSymbol);
  const [activeSymbol, setActiveSymbol] = useState(readStoredSymbol);
  const [analysisDate, setAnalysisDate] = useState(todayIstDateKey);

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

  const {
    portfolio,
    pnl,
    currentPrice,
    canTrade,
    lastError,
    placeOrder,
    cancelOrder,
    resetPortfolio,
  } = usePaperTrading(data, sessionIndex, activeSymbol, analysisDate);

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

      <div className="grid grid-cols-1 gap-px bg-kite-border xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 bg-kite-bg">
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

        <aside className="bg-kite-bg p-3 xl:sticky xl:top-0 xl:max-h-screen xl:overflow-y-auto">
          <div className="flex flex-col gap-3">
            <OrderEntryForm
              currentPrice={currentPrice}
              availableCash={pnl.cash}
              canTrade={canTrade}
              lastError={lastError}
              onPlaceOrder={placeOrder}
            />
            <PositionPnLPanel
              portfolio={portfolio}
              pnl={pnl}
              currentPrice={currentPrice}
              onResetPortfolio={resetPortfolio}
              onCancelOrder={cancelOrder}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
