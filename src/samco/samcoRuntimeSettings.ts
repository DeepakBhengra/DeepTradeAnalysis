import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { config } from "../config.js";
import { getIstTimeParts } from "../utils/marketTime.js";
import { normalizeStopLossPct } from "../utils/stopLossPct.js";
import {
  DEFAULT_SAMCO_RULE_VARIANT,
  parseSamcoRuleVariant,
  type SamcoRuleVariant,
} from "./samcoRuleVariant.js";

const SETTINGS_PATH = resolve(process.cwd(), "data/samco-settings.json");
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 10_000;
const MAX_ENTRY_PRICE = 50_000;

export interface SamcoRuntimeSettingsFile {
  dateKey: string;
  quantity: number;
  dryRun: boolean;
  entryPriceMin?: number;
  entryPriceMax?: number;
  ruleVariant?: SamcoRuleVariant;
  /** Adverse loss % vs entry; omit/null/0 = disabled. */
  stopLossPct?: number | null;
}

export interface SamcoRuntimeSettingsView {
  dateKey: string;
  quantity: number;
  effectiveQuantity: number;
  dryRun: boolean;
  entryPriceMin: number;
  entryPriceMax: number;
  ruleVariant: SamcoRuleVariant;
  /** null when stop-loss is off. */
  stopLossPct: number | null;
  envDefaultQuantity: number;
  envDefaultDryRun: boolean;
  envDefaultEntryPriceMin: number;
  envDefaultEntryPriceMax: number;
  envDefaultRuleVariant: SamcoRuleVariant;
}

export interface SamcoEntryPriceRange {
  min: number;
  max: number;
}

function settingsFilePath(): string {
  return SETTINGS_PATH;
}

function todayDateKey(now = new Date()): string {
  return getIstTimeParts(now).dateKey;
}

function envEntryPriceDefaults(): SamcoEntryPriceRange {
  return {
    min: config.samco.entryPriceMin,
    max: config.samco.entryPriceMax,
  };
}

function resolveRuleVariant(
  stored: Pick<SamcoRuntimeSettingsFile, "ruleVariant"> | null,
): SamcoRuleVariant {
  return parseSamcoRuleVariant(stored?.ruleVariant);
}

function resolveStopLossPct(
  stored: Pick<SamcoRuntimeSettingsFile, "stopLossPct"> | null,
): number | null {
  return normalizeStopLossPct(stored?.stopLossPct ?? null);
}

function createDefaultSettings(now = new Date()): SamcoRuntimeSettingsFile {
  const { min, max } = envEntryPriceDefaults();
  return {
    dateKey: todayDateKey(now),
    quantity: config.samco.defaultQuantity,
    dryRun: config.samco.dryRun,
    entryPriceMin: min,
    entryPriceMax: max,
    ruleVariant: DEFAULT_SAMCO_RULE_VARIANT,
    stopLossPct: null,
  };
}

function readSettingsFile(): SamcoRuntimeSettingsFile | null {
  const filePath = settingsFilePath();
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as SamcoRuntimeSettingsFile;
    if (
      typeof parsed.dateKey !== "string" ||
      typeof parsed.quantity !== "number" ||
      typeof parsed.dryRun !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSettingsFile(settings: SamcoRuntimeSettingsFile): void {
  const filePath = settingsFilePath();
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf8");
}

function resolveEntryPriceRange(stored: SamcoRuntimeSettingsFile): SamcoEntryPriceRange {
  const defaults = envEntryPriceDefaults();
  const min =
    typeof stored.entryPriceMin === "number" && Number.isFinite(stored.entryPriceMin)
      ? stored.entryPriceMin
      : defaults.min;
  const max =
    typeof stored.entryPriceMax === "number" && Number.isFinite(stored.entryPriceMax)
      ? stored.entryPriceMax
      : defaults.max;
  return { min, max };
}

function normalizeForToday(
  stored: SamcoRuntimeSettingsFile | null,
  now = new Date(),
): SamcoRuntimeSettingsFile {
  const currentDateKey = todayDateKey(now);
  if (!stored) {
    return createDefaultSettings(now);
  }

  const { min, max } = resolveEntryPriceRange(stored);
  const ruleVariant = resolveRuleVariant(stored);
  const stopLossPct = resolveStopLossPct(stored);

  if (stored.dateKey !== currentDateKey) {
    return {
      dateKey: currentDateKey,
      quantity: config.samco.defaultQuantity,
      dryRun: stored.dryRun,
      entryPriceMin: min,
      entryPriceMax: max,
      ruleVariant,
      stopLossPct,
    };
  }

  return {
    ...stored,
    entryPriceMin: min,
    entryPriceMax: max,
    ruleVariant,
    stopLossPct,
  };
}

function toView(normalized: SamcoRuntimeSettingsFile): SamcoRuntimeSettingsView {
  const { min, max } = resolveEntryPriceRange(normalized);
  const envDefaults = envEntryPriceDefaults();

  return {
    dateKey: normalized.dateKey,
    quantity: normalized.quantity,
    effectiveQuantity: normalized.quantity,
    dryRun: normalized.dryRun,
    entryPriceMin: min,
    entryPriceMax: max,
    ruleVariant: resolveRuleVariant(normalized),
    stopLossPct: resolveStopLossPct(normalized),
    envDefaultQuantity: config.samco.defaultQuantity,
    envDefaultDryRun: config.samco.dryRun,
    envDefaultEntryPriceMin: envDefaults.min,
    envDefaultEntryPriceMax: envDefaults.max,
    envDefaultRuleVariant: DEFAULT_SAMCO_RULE_VARIANT,
  };
}

export function validateSamcoEntryPriceRange(min: number, max: number): void {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("Entry price min and max must be finite numbers.");
  }
  if (min < 0) {
    throw new Error("Entry price min must be at least 0.");
  }
  if (max <= 0) {
    throw new Error("Entry price max must be greater than 0.");
  }
  if (min > max) {
    throw new Error("Entry price min cannot exceed max.");
  }
  if (max > MAX_ENTRY_PRICE) {
    throw new Error(`Entry price max cannot exceed ${MAX_ENTRY_PRICE}.`);
  }
}

export function getSamcoRuntimeSettings(now = new Date()): SamcoRuntimeSettingsView {
  const normalized = normalizeForToday(readSettingsFile(), now);
  writeSettingsFile(normalized);
  return toView(normalized);
}

export function getSamcoDryRun(now = new Date()): boolean {
  return getSamcoRuntimeSettings(now).dryRun;
}

export function getSamcoEffectiveQuantity(now = new Date()): number {
  return getSamcoRuntimeSettings(now).effectiveQuantity;
}

export function getSamcoEntryPriceRange(now = new Date()): SamcoEntryPriceRange {
  const settings = getSamcoRuntimeSettings(now);
  return {
    min: settings.entryPriceMin,
    max: settings.entryPriceMax,
  };
}

export function getSamcoRuleVariant(now = new Date()): SamcoRuleVariant {
  return getSamcoRuntimeSettings(now).ruleVariant;
}

export function getSamcoStopLossPct(now = new Date()): number | null {
  return getSamcoRuntimeSettings(now).stopLossPct;
}

export function validateSamcoStopLossPct(value: number | null): void {
  if (value == null) {
    return;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Stop-loss % must be blank, 0 (off), or a positive number.");
  }
  if (value > 100) {
    throw new Error("Stop-loss % cannot exceed 100.");
  }
}

export function setSamcoStopLossPct(
  value: number | null,
  now = new Date(),
): SamcoRuntimeSettingsView {
  validateSamcoStopLossPct(value);
  const current = normalizeForToday(readSettingsFile(), now);
  const next: SamcoRuntimeSettingsFile = {
    ...current,
    dateKey: todayDateKey(now),
    stopLossPct: normalizeStopLossPct(value),
  };
  writeSettingsFile(next);
  return getSamcoRuntimeSettings(now);
}

export function setSamcoDryRun(enabled: boolean, now = new Date()): SamcoRuntimeSettingsView {
  const current = normalizeForToday(readSettingsFile(), now);
  const next: SamcoRuntimeSettingsFile = {
    ...current,
    dateKey: todayDateKey(now),
    dryRun: enabled,
  };
  writeSettingsFile(next);
  return getSamcoRuntimeSettings(now);
}

export function setSamcoDayQuantity(quantity: number, now = new Date()): SamcoRuntimeSettingsView {
  if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
    throw new Error(
      `Quantity must be an integer between ${MIN_QUANTITY} and ${MAX_QUANTITY}.`,
    );
  }

  const current = normalizeForToday(readSettingsFile(), now);
  const next: SamcoRuntimeSettingsFile = {
    ...current,
    dateKey: todayDateKey(now),
    quantity,
  };
  writeSettingsFile(next);
  return getSamcoRuntimeSettings(now);
}

export function setSamcoEntryPriceRange(
  min: number,
  max: number,
  now = new Date(),
): SamcoRuntimeSettingsView {
  validateSamcoEntryPriceRange(min, max);

  const current = normalizeForToday(readSettingsFile(), now);
  const next: SamcoRuntimeSettingsFile = {
    ...current,
    dateKey: todayDateKey(now),
    entryPriceMin: min,
    entryPriceMax: max,
  };
  writeSettingsFile(next);
  return getSamcoRuntimeSettings(now);
}

export function setSamcoRuleVariant(
  ruleVariant: string,
  now = new Date(),
): SamcoRuntimeSettingsView {
  const parsed = parseSamcoRuleVariant(ruleVariant);
  if (parsed !== ruleVariant) {
    throw new Error(
      `Invalid ruleVariant. Use one of: ${["deepak+deepak2", "deepak", "deepak2", "deepak3", "watchParty", "deeppro", "deeppro1"].join(", ")}.`,
    );
  }

  const current = normalizeForToday(readSettingsFile(), now);
  const next: SamcoRuntimeSettingsFile = {
    ...current,
    dateKey: todayDateKey(now),
    ruleVariant: parsed,
  };
  writeSettingsFile(next);
  return getSamcoRuntimeSettings(now);
}

export function resetSamcoRuntimeSettings(now = new Date()): SamcoRuntimeSettingsView {
  const next = createDefaultSettings(now);
  writeSettingsFile(next);
  return getSamcoRuntimeSettings(now);
}
