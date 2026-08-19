import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import {
  useDayScanSimulation,
  type SimulationStatus,
} from "../hooks/useDayScanSimulation";
import type { DayScanSimulationPayload } from "../types/backtest";
import {
  DEFAULT_DAY_SCAN_ENTRY_PRICE_MAX,
  DEFAULT_DAY_SCAN_ENTRY_PRICE_MIN,
  filterDayScanSimulationPayloadByEntryPrice,
  parseDayScanEntryPriceInput,
} from "../utils/dayScanEntryPriceFilter";
import {
  DAY_SCAN_SIMULATION_VARIANT_LABEL,
  parseDayScanSimulationVariant,
  type DayScanSimulationVariant,
} from "../utils/dayScanSimulationVariant";
import { todayIstDateKey } from "../utils/istTime";
import { readLocalStorage, writeLocalStorage } from "../utils/safeStorage";

const VARIANT_STORAGE_KEY = "dayscan-simulation-variant";
const ENTRY_MIN_STORAGE_KEY = "dayscan-simulation-entry-price-min";
const ENTRY_MAX_STORAGE_KEY = "dayscan-simulation-entry-price-max";

function readStoredVariant(): DayScanSimulationVariant {
  return parseDayScanSimulationVariant(readLocalStorage(VARIANT_STORAGE_KEY));
}

function readStoredPrice(key: string, fallback: number): string {
  const stored = readLocalStorage(key);
  if (stored == null || stored.trim() === "") {
    return String(fallback);
  }
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? String(parsed) : String(fallback);
}

export interface DayScanSimulationContextValue {
  analysisDate: string;
  setAnalysisDate: (date: string) => void;
  ruleVariant: DayScanSimulationVariant;
  setRuleVariant: (variant: DayScanSimulationVariant) => void;
  ruleVariantLabel: string;
  entryPriceMinInput: string;
  entryPriceMaxInput: string;
  setEntryPriceMinInput: (value: string) => void;
  setEntryPriceMaxInput: (value: string) => void;
  entryPriceMin: number;
  entryPriceMax: number;
  /** Unfiltered candle payload from the API. */
  rawData: DayScanSimulationPayload | null;
  /** Entry-price-filtered payload shared with Day Order Simulator. */
  data: DayScanSimulationPayload | null;
  filteredOutEntryCount: number;
  loading: boolean;
  error: string | null;
  status: SimulationStatus;
  sessionIndex: number;
  sessionCandleCount: number;
  simulatedTimeIst: string | null;
  start: () => void;
  pause: () => void;
  stop: () => void;
  reloadLatest: () => void;
}

const DayScanSimulationContext = createContext<DayScanSimulationContextValue | null>(
  null,
);

export function DayScanSimulationProvider({ children }: { children: ReactNode }) {
  const [analysisDate, setAnalysisDate] = useState(todayIstDateKey);
  const [ruleVariant, setRuleVariantState] =
    useState<DayScanSimulationVariant>(readStoredVariant);
  const [entryPriceMinInput, setEntryPriceMinInputState] = useState(() =>
    readStoredPrice(ENTRY_MIN_STORAGE_KEY, DEFAULT_DAY_SCAN_ENTRY_PRICE_MIN),
  );
  const [entryPriceMaxInput, setEntryPriceMaxInputState] = useState(() =>
    readStoredPrice(ENTRY_MAX_STORAGE_KEY, DEFAULT_DAY_SCAN_ENTRY_PRICE_MAX),
  );
  const simulation = useDayScanSimulation(analysisDate, ruleVariant);

  const setRuleVariant = (variant: DayScanSimulationVariant) => {
    setRuleVariantState(variant);
    writeLocalStorage(VARIANT_STORAGE_KEY, variant);
  };

  const setEntryPriceMinInput = (value: string) => {
    setEntryPriceMinInputState(value);
    writeLocalStorage(ENTRY_MIN_STORAGE_KEY, value);
  };

  const setEntryPriceMaxInput = (value: string) => {
    setEntryPriceMaxInputState(value);
    writeLocalStorage(ENTRY_MAX_STORAGE_KEY, value);
  };

  const entryPriceMin = parseDayScanEntryPriceInput(
    entryPriceMinInput,
    DEFAULT_DAY_SCAN_ENTRY_PRICE_MIN,
  );
  const entryPriceMax = parseDayScanEntryPriceInput(
    entryPriceMaxInput,
    DEFAULT_DAY_SCAN_ENTRY_PRICE_MAX,
  );

  const data = useMemo(() => {
    if (!simulation.data) {
      return null;
    }
    return filterDayScanSimulationPayloadByEntryPrice(
      simulation.data,
      entryPriceMin,
      entryPriceMax,
    );
  }, [simulation.data, entryPriceMin, entryPriceMax]);

  const filteredOutEntryCount = simulation.data
    ? simulation.data.entries.length - (data?.entries.length ?? 0)
    : 0;

  const value: DayScanSimulationContextValue = {
    analysisDate,
    setAnalysisDate,
    ruleVariant,
    setRuleVariant,
    ruleVariantLabel: DAY_SCAN_SIMULATION_VARIANT_LABEL[ruleVariant],
    entryPriceMinInput,
    entryPriceMaxInput,
    setEntryPriceMinInput,
    setEntryPriceMaxInput,
    entryPriceMin,
    entryPriceMax,
    rawData: simulation.data,
    data,
    filteredOutEntryCount,
    loading: simulation.loading,
    error: simulation.error,
    status: simulation.status,
    sessionIndex: simulation.sessionIndex,
    sessionCandleCount: simulation.sessionCandleCount,
    simulatedTimeIst: simulation.simulatedTimeIst,
    start: simulation.start,
    pause: simulation.pause,
    stop: simulation.stop,
    reloadLatest: simulation.reloadLatest,
  };

  return (
    <DayScanSimulationContext.Provider value={value}>
      {children}
    </DayScanSimulationContext.Provider>
  );
}

export function useDayScanSimulationContext(): DayScanSimulationContextValue {
  const context = useContext(DayScanSimulationContext);
  if (!context) {
    throw new Error(
      "useDayScanSimulationContext must be used within DayScanSimulationProvider",
    );
  }
  return context;
}
