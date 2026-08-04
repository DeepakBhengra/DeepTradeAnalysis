import { fetchDayScanSimulation } from "../api/client";
import type { DayScanSimulationPayload } from "../types/backtest";
import type { DayOrderPortfolio, DayOrderRunSettings } from "../types/dayOrder";
import { DEFAULT_DAY_ORDER_RUN_SETTINGS } from "../types/dayOrder";
import { createInitialDayOrderPortfolio, processDayOrderTick } from "./dayOrderEngine";

/**
 * Replay Day Scan simulation frames from session index 0 through `throughIndex`
 * so Order Simulator does not miss earlier entries/exits (e.g. 09:15 → 09:30
 * square-offs) when it starts mid-session.
 */
export async function catchUpDayOrderPortfolio(input: {
  date: string;
  variant: string;
  throughIndex: number;
  currentPayload?: DayScanSimulationPayload | null;
  settings?: DayOrderRunSettings;
}): Promise<DayOrderPortfolio> {
  const throughIndex = Math.max(0, input.throughIndex);
  const settings = input.settings ?? DEFAULT_DAY_ORDER_RUN_SETTINGS;
  let portfolio = createInitialDayOrderPortfolio();

  for (let index = 0; index <= throughIndex; index++) {
    const payload =
      index === throughIndex && input.currentPayload != null
        ? input.currentPayload
        : await fetchDayScanSimulation(input.date, index, input.variant);
    portfolio = processDayOrderTick(portfolio, payload, settings);
  }

  return portfolio;
}
