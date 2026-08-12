import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function loadRuntimeSettingsModule() {
  return import("../../src/samco/samcoRuntimeSettings.js");
}

describe("samcoRuntimeSettings", () => {
  let tempDir = "";

  beforeEach(() => {
    vi.resetModules();
    tempDir = mkdtempSync(join(tmpdir(), "samco-settings-"));
    process.env.SAMCO_DEFAULT_QUANTITY = "100";
    process.env.SAMCO_DRY_RUN = "true";
    process.env.SAMCO_ENTRY_PRICE_MIN = "0";
    process.env.SAMCO_ENTRY_PRICE_MAX = "3900";
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("stores day quantity for the current IST date", async () => {
    const settingsPath = join(tempDir, "samco-settings.json");
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoDayQuantity, getSamcoRuntimeSettings } =
        await loadRuntimeSettingsModule();

      const updated = setSamcoDayQuantity(250, new Date("2026-06-29T06:00:00+05:30"));
      expect(updated.effectiveQuantity).toBe(250);
      expect(updated.dateKey).toBe("2026-06-29");

      const reloaded = getSamcoRuntimeSettings(new Date("2026-06-29T10:00:00+05:30"));
      expect(reloaded.effectiveQuantity).toBe(250);
      expect(settingsPath).toBeTruthy();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("resets quantity to env default on a new IST date", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoDayQuantity, getSamcoRuntimeSettings } =
        await loadRuntimeSettingsModule();

      setSamcoDayQuantity(250, new Date("2026-06-29T06:00:00+05:30"));
      const nextDay = getSamcoRuntimeSettings(new Date("2026-06-30T06:00:00+05:30"));

      expect(nextDay.dateKey).toBe("2026-06-30");
      expect(nextDay.effectiveQuantity).toBe(100);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("rejects invalid quantity values", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoDayQuantity } = await loadRuntimeSettingsModule();
      expect(() => setSamcoDayQuantity(0)).toThrow(/integer/i);
      expect(() => setSamcoDayQuantity(1.5)).toThrow(/integer/i);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("stores and returns entry price range", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoEntryPriceRange, getSamcoEntryPriceRange } =
        await loadRuntimeSettingsModule();

      setSamcoEntryPriceRange(100, 2500, new Date("2026-06-29T06:00:00+05:30"));
      expect(getSamcoEntryPriceRange(new Date("2026-06-29T10:00:00+05:30"))).toEqual({
        min: 100,
        max: 2500,
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("persists entry price range across IST days", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoEntryPriceRange, getSamcoRuntimeSettings } =
        await loadRuntimeSettingsModule();

      setSamcoEntryPriceRange(200, 3000, new Date("2026-06-29T06:00:00+05:30"));
      const nextDay = getSamcoRuntimeSettings(new Date("2026-06-30T06:00:00+05:30"));

      expect(nextDay.entryPriceMin).toBe(200);
      expect(nextDay.entryPriceMax).toBe(3000);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("rejects invalid entry price range", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoEntryPriceRange } = await loadRuntimeSettingsModule();
      expect(() => setSamcoEntryPriceRange(3000, 100)).toThrow(/min cannot exceed max/i);
      expect(() => setSamcoEntryPriceRange(-1, 100)).toThrow(/min must be at least 0/i);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("migrates settings file missing entry price fields", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      mkdirSync(join(tempDir, "data"), { recursive: true });
      writeFileSync(
        join(tempDir, "data", "samco-settings.json"),
        JSON.stringify({
          dateKey: "2026-06-29",
          quantity: 100,
          dryRun: true,
        }),
        "utf8",
      );

      const { getSamcoRuntimeSettings } = await loadRuntimeSettingsModule();
      const settings = getSamcoRuntimeSettings(new Date("2026-06-29T10:00:00+05:30"));

      expect(settings.entryPriceMin).toBe(0);
      expect(settings.entryPriceMax).toBe(3900);

      const persisted = JSON.parse(
        readFileSync(join(tempDir, "data", "samco-settings.json"), "utf8"),
      );
      expect(persisted.entryPriceMin).toBe(0);
      expect(persisted.entryPriceMax).toBe(3900);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("stores and returns rule variant", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoRuleVariant, getSamcoRuleVariant, getSamcoRuntimeSettings } =
        await loadRuntimeSettingsModule();

      setSamcoRuleVariant("deeppro1", new Date("2026-06-29T06:00:00+05:30"));
      expect(getSamcoRuleVariant(new Date("2026-06-29T10:00:00+05:30"))).toBe(
        "deeppro1",
      );
      expect(
        getSamcoRuntimeSettings(new Date("2026-06-29T10:00:00+05:30")).ruleVariant,
      ).toBe("deeppro1");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("persists rule variant across IST days", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoRuleVariant, getSamcoRuntimeSettings } =
        await loadRuntimeSettingsModule();

      setSamcoRuleVariant("watchParty", new Date("2026-06-29T06:00:00+05:30"));
      const nextDay = getSamcoRuntimeSettings(new Date("2026-06-30T06:00:00+05:30"));
      expect(nextDay.ruleVariant).toBe("watchParty");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("rejects invalid rule variants", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoRuleVariant } = await loadRuntimeSettingsModule();
      expect(() => setSamcoRuleVariant("rulePnb")).toThrow(/Invalid ruleVariant/i);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("defaults missing ruleVariant to Deepak + Deepak-2", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      mkdirSync(join(tempDir, "data"), { recursive: true });
      writeFileSync(
        join(tempDir, "data", "samco-settings.json"),
        JSON.stringify({
          dateKey: "2026-06-29",
          quantity: 100,
          dryRun: true,
          entryPriceMin: 0,
          entryPriceMax: 3900,
        }),
        "utf8",
      );

      const { getSamcoRuntimeSettings } = await loadRuntimeSettingsModule();
      const settings = getSamcoRuntimeSettings(new Date("2026-06-29T10:00:00+05:30"));
      expect(settings.ruleVariant).toBe("deepak+deepak2");
      expect(settings.stopLossPct).toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("stores stop-loss pct and treats zero as off", async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);
      const { setSamcoStopLossPct, getSamcoStopLossPct, getSamcoRuntimeSettings } =
        await loadRuntimeSettingsModule();

      const updated = setSamcoStopLossPct(0.75, new Date("2026-06-29T06:00:00+05:30"));
      expect(updated.stopLossPct).toBe(0.75);
      expect(getSamcoStopLossPct(new Date("2026-06-29T10:00:00+05:30"))).toBe(0.75);

      const cleared = setSamcoStopLossPct(0, new Date("2026-06-29T11:00:00+05:30"));
      expect(cleared.stopLossPct).toBeNull();
      expect(
        getSamcoRuntimeSettings(new Date("2026-06-29T11:00:00+05:30")).stopLossPct,
      ).toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });
});
