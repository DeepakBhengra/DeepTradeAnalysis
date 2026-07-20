import { createContext, useContext, useState, type ReactNode } from "react";

import {
  useDayScanSimulation,
  type SimulationStatus,
} from "../hooks/useDayScanSimulation";
import type { DayScanSimulationPayload } from "../types/backtest";

const DEFAULT_ANALYSIS_DATE = "2026-05-11";

export interface DayScanSimulationContextValue {
  analysisDate: string;
  setAnalysisDate: (date: string) => void;
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
  const simulation = useDayScanSimulation(analysisDate);

  const value: DayScanSimulationContextValue = {
    analysisDate,
    setAnalysisDate,
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
