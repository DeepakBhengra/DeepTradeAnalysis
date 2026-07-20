import {

  config,

  dashboardSymbols,

  getDashboardSymbol,

  type DashboardSymbolConfig,

  type DashboardSymbolId,

} from "../config.js";

import {

  buildDashboardPayload,

  type DashboardPayload,

} from "./buildDashboardPayload.js";



function cacheKey(symbolId: string, analysisDate?: string): string {

  return `${symbolId}:${analysisDate ?? "live"}`;

}



export class SignalCache {

  private payloads = new Map<string, DashboardPayload>();

  private refreshingKeys = new Set<string>();

  private refreshTimer?: ReturnType<typeof setInterval>;



  async get(

    dashboardSymbol: DashboardSymbolConfig,

    analysisDate?: string,

  ): Promise<DashboardPayload> {

    const key = cacheKey(dashboardSymbol.id, analysisDate);

    if (!this.payloads.has(key)) {

      await this.refresh(dashboardSymbol, analysisDate);

    }

    return this.payloads.get(key)!;

  }



  async refresh(

    dashboardSymbol: DashboardSymbolConfig,

    analysisDate?: string,

  ): Promise<DashboardPayload> {

    const key = cacheKey(dashboardSymbol.id, analysisDate);



    if (this.refreshingKeys.has(key) && this.payloads.has(key)) {

      return this.payloads.get(key)!;

    }



    this.refreshingKeys.add(key);

    try {

      const payload = await buildDashboardPayload({ analysisDate, dashboardSymbol });

      this.payloads.set(key, payload);

      return payload;

    } finally {

      this.refreshingKeys.delete(key);

    }

  }



  clear(): void {

    this.payloads.clear();

  }



  startAutoRefresh(): void {

    if (this.refreshTimer) {

      return;

    }



    const refreshAllLive = () => {

      for (const dashboardId of Object.keys(dashboardSymbols) as DashboardSymbolId[]) {

        const dashboardSymbol = getDashboardSymbol(dashboardId);

        void this.refresh(dashboardSymbol).catch((error) => {

          console.error(`Signal cache refresh failed for ${dashboardId}:`, error);

        });

      }

    };



    refreshAllLive();



    this.refreshTimer = setInterval(refreshAllLive, config.pollIntervalMs);

  }



  stopAutoRefresh(): void {

    if (this.refreshTimer) {

      clearInterval(this.refreshTimer);

      this.refreshTimer = undefined;

    }

  }

}


