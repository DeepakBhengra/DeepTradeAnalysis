import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("samcoTradeLog", () => {
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "samco-logs-"));
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("appends, filters by date, and exports CSV", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const tradeLog = await import("../../src/samco/samcoTradeLog.js");

      tradeLog.resetSamcoTradeLogs();
      tradeLog.appendSamcoTradeLogs(
        [
          {
            level: "info",
            message: "Dry-run entry BUY PNB qty=100 (deepak).",
            signalKey: "deepak-PNB-10:30-2",
          },
        ],
        { dryRun: true, now: new Date("2026-06-29T10:00:00+05:30") },
      );

      const records = tradeLog.getSamcoTradeLogs("2026-06-29");
      expect(records).toHaveLength(1);
      expect(records[0]?.dryRun).toBe(true);
      expect(records[0]?.action).toBe("entry");

      const csv = tradeLog.exportSamcoTradeLogsCsv("2026-06-29");
      expect(csv).toContain("timestamp,dateKey,level,message,signalKey,dryRun,action");
      expect(csv).toContain("Dry-run entry BUY PNB qty=100 (deepak).");
      expect(csv).toContain("true");
    } finally {
      process.chdir(originalCwd);
    }
  });
});
