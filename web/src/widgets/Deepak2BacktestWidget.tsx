import { useEffect, useRef, useState } from "react";

import { BacktestResultsTable } from "../components/BacktestResultsTable";
import { DateRangePicker } from "../components/DateRangePicker";
import { DeepakRulesPanel } from "../components/DeepakRulesPanel";
import { StockSymbolInput } from "../components/StockSymbolInput";
import { useDeepak2Backtest } from "../hooks/useDeepak2Backtest";

const DEFAULT_SYMBOL = "RELIANCE";
const SYMBOL_STORAGE_KEY = "deepak2-backtest-symbol";
const DEFAULT_FROM_DATE = "2026-05-01";
const DEFAULT_TO_DATE = "2026-06-19";

function readStoredSymbol(): string {
  const stored = localStorage.getItem(SYMBOL_STORAGE_KEY)?.trim().toUpperCase();
  return stored || DEFAULT_SYMBOL;
}

interface Deepak2BacktestWidgetProps {
  isActive: boolean;
  refreshTrigger?: number;
}

export function Deepak2BacktestWidget({
  isActive,
  refreshTrigger = 0,
}: Deepak2BacktestWidgetProps) {
  const [symbolInput, setSymbolInput] = useState(readStoredSymbol);
  const [activeSymbol, setActiveSymbol] = useState(readStoredSymbol);
  const [fromDate, setFromDate] = useState(DEFAULT_FROM_DATE);
  const [toDate, setToDate] = useState(DEFAULT_TO_DATE);
  const { data, loading, error, run } = useDeepak2Backtest();
  const hasRunRef = useRef(false);

  const handleLoadSymbol = () => {
    const normalized = symbolInput.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    setActiveSymbol(normalized);
    localStorage.setItem(SYMBOL_STORAGE_KEY, normalized);
  };

  const handleRun = () => {
    hasRunRef.current = true;
    void run(activeSymbol, fromDate, toDate);
  };

  useEffect(() => {
    if (refreshTrigger > 0 && isActive && hasRunRef.current) {
      void run(activeSymbol, fromDate, toDate);
    }
  }, [refreshTrigger, isActive, run, activeSymbol, fromDate, toDate]);

  return (
    <div hidden={!isActive}>
      <main className="mx-auto flex max-w-6xl flex-col gap-3 p-3">
        <StockSymbolInput
          value={symbolInput}
          onChange={setSymbolInput}
          onLoad={handleLoadSymbol}
          loading={loading}
        />
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
          onRun={handleRun}
          loading={loading}
          runDisabled={activeSymbol.trim().length === 0}
        />
        <DeepakRulesPanel variant="deepak2" />

        {error && (
          <section className="border border-kite-red/30 bg-kite-surface p-3 text-xs text-kite-red">
            {error}
          </section>
        )}

        {!data && !loading && !error && (
          <section className="border border-kite-border bg-kite-surface p-3 text-xs text-kite-muted">
            Select a symbol and date range, then click Run Backtest to evaluate Deepak-2 BUY/SELL
            signals (session starts 10:15 IST).
          </section>
        )}

        {data && <BacktestResultsTable payload={data} />}
      </main>
    </div>
  );
}
