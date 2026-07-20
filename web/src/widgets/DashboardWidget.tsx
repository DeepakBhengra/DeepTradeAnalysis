import { useEffect, useState } from "react";

import { DashboardContent } from "../components/DashboardContent";
import { useDashboardData } from "../hooks/useDashboardData";

const DEFAULT_ANALYSIS_DATE = "2026-06-19";

export type DashboardId = "pnb" | "niftyBank";

interface DashboardWidgetProps {
  dashboardId: DashboardId;
  isActive: boolean;
  refreshTrigger?: number;
}

export function DashboardWidget({
  dashboardId,
  isActive,
  refreshTrigger = 0,
}: DashboardWidgetProps) {
  const [analysisDate, setAnalysisDate] = useState<string | null>(DEFAULT_ANALYSIS_DATE);
  const { data, loading, error, refresh } = useDashboardData(dashboardId, analysisDate);

  useEffect(() => {
    if (refreshTrigger > 0 && isActive) {
      void refresh();
    }
  }, [refreshTrigger, isActive, refresh]);

  return (
    <div hidden={!isActive}>
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
