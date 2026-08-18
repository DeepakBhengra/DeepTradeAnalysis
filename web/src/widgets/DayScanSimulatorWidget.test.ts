import { describe, expect, it } from "vitest";

import { DAY_SCAN_SIMULATOR_LIVE_REFRESH_MS } from "../widgets/DayScanSimulatorWidget";

describe("Day Scan Simulator live refresh", () => {
  it("refreshes every 15 minutes for IST today", () => {
    expect(DAY_SCAN_SIMULATOR_LIVE_REFRESH_MS).toBe(15 * 60 * 1000);
  });
});
