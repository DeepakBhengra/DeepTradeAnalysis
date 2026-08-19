import { useEffect, useState } from "react";

import { DashboardContent } from "../components/DashboardContent";
import { useDashboardData } from "../hooks/useDashboardData";
import { todayIstDateKey } from "../utils/istTime";

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
  const [analysisDate, setAnalysisDate] = useState<string | null>(todayIstDateKey);
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
