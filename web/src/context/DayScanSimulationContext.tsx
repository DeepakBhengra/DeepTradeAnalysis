import { createContext, useContext, useState, type ReactNode } from "react";

import {
  useDayScanSimulation,
  type SimulationStatus,
} from "../hooks/useDayScanSimulation";
import type { DayScanSimulationPayload } from "../types/backtest";
import {
  DAY_SCAN_SIMULATION_VARIANT_LABEL,
  parseDayScanSimulationVariant,
  type DayScanSimulationVariant,
} from "../utils/dayScanSimulationVariant";
import { readLocalStorage, writeLocalStorage } from "../utils/safeStorage";

const DEFAULT_ANALYSIS_DATE = "2026-05-11";
const VARIANT_STORAGE_KEY = "dayscan-simulation-variant";

function readStoredVariant(): DayScanSimulationVariant {
  return parseDayScanSimulationVariant(readLocalStorage(VARIANT_STORAGE_KEY));
}

export interface DayScanSimulationContextValue {
  analysisDate: string;
  setAnalysisDate: (date: string) => void;
  ruleVariant: DayScanSimulationVariant;
  setRuleVariant: (variant: DayScanSimulationVariant) => void;
  ruleVariantLabel: string;
  data: DayScanSimulationPayload | null;
  loading: boolean;
  error: string | null;
  status: SimulationStatus;
  sessionIndex: number;
  sessionCandleCount: number;
  simulatedTimeIst: string | null;
  start: () => void;
  pause: () => void;
  stop: () => void;
}

const DayScanSimulationContext = createContext<DayScanSimulationContextValue | null>(
  null,
);

export function DayScanSimulationProvider({ children }: { children: ReactNode }) {
  const [analysisDate, setAnalysisDate] = useState(DEFAULT_ANALYSIS_DATE);
  const [ruleVariant, setRuleVariantState] =
    useState<DayScanSimulationVariant>(readStoredVariant);
  const simulation = useDayScanSimulation(analysisDate, ruleVariant);

  const setRuleVariant = (variant: DayScanSimulationVariant) => {
    setRuleVariantState(variant);
    writeLocalStorage(VARIANT_STORAGE_KEY, variant);
  };

  const value: DayScanSimulationContextValue = {
    analysisDate,
    setAnalysisDate,
    ruleVariant,
    setRuleVariant,
    ruleVariantLabel: DAY_SCAN_SIMULATION_VARIANT_LABEL[ruleVariant],
    ...simulation,
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
