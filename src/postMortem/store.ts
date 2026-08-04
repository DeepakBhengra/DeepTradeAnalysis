import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const STORE_ROOT = resolve(process.cwd(), "data/post-mortem");

export type PostMortemVariantId =
  | "deepak"
  | "deepak2"
  | "deeppro"
  | "deeppro1"
  | "rulePnb"
  | "ruleSunpharma"
  | "ruleLtm"
  | "ruleIcicigi"
  | "ruleTechm"
  | "ruleTvsmotor"
  | "rulePolicybzr";

/**
 * Bump when deeppro detection thresholds change so Post-Mortem recomputes
 * signal-day indexes instead of serving a stale cache.
 */
export const DEEPPRO_SIGNAL_DAYS_RULES_REVISION = 10;

/**
 * Bump when Deeppro1 detection thresholds change so Post-Mortem recomputes
 * signal-day indexes instead of serving a stale cache.
 */
export const DEEPPRO1_SIGNAL_DAYS_RULES_REVISION = 2;

/**
 * Bump when RulePNB detection thresholds change so Post-Mortem recomputes
 * signal-day indexes instead of serving a stale cache.
 */
export const RULEPNB_SIGNAL_DAYS_RULES_REVISION = 1;

/**
 * Bump when RuleSUNPHARMA detection thresholds change so Post-Mortem recomputes
 * signal-day indexes instead of serving a stale cache.
 */
export const RULESUNPHARMA_SIGNAL_DAYS_RULES_REVISION = 1;

/**
 * Bump when per-symbol favourable rules (LTM/ICICIGI/TECHM/TVSMOTOR/POLICYBZR)
 * change so Post-Mortem recomputes signal-day indexes.
 */
export const FAVOURABLE_SYMBOL_SIGNAL_DAYS_RULES_REVISION = 1;

const FAVOURABLE_SYMBOL_VARIANTS = new Set<PostMortemVariantId>([
  "ruleLtm",
  "ruleIcicigi",
  "ruleTechm",
  "ruleTvsmotor",
  "rulePolicybzr",
]);

export interface StoredSignalDay {
  date: string;
  signalCount: number;
  buyCount: number;
  sellCount: number;
}

export interface StoredSignalDaysIndex {
  version: 1;
  savedAt: string;
  symbol: string;
  fromDate: string;
  toDate: string;
  variant: PostMortemVariantId;
  /** Present for deeppro indexes; used to invalidate after rule tweaks. */
  rulesRevision?: number;
  days: StoredSignalDay[];
  tradingDaysScanned: number;
  totalSignals: number;
}

export interface StoredPostMortemReport {
  version: 1;
  savedAt: string;
  symbol: string;
  date: string;
  variant: PostMortemVariantId;
  mode: string;
  /** Graded report JSON (DeepakPostMortemReport shape from the web app). */
  report: unknown;
  /** Session series used by the mid chart. */
  series: unknown[];
}

function sanitizeSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  if (!normalized) {
    throw new Error("Invalid symbol.");
  }
  return normalized;
}

function assertVariant(variant: string): PostMortemVariantId {
  if (
    variant === "deepak" ||
    variant === "deepak2" ||
    variant === "deeppro" ||
    variant === "deeppro1" ||
    variant === "rulePnb" ||
    variant === "ruleSunpharma" ||
    variant === "ruleLtm" ||
    variant === "ruleIcicigi" ||
    variant === "ruleTechm" ||
    variant === "ruleTvsmotor" ||
    variant === "rulePolicybzr"
  ) {
    return variant;
  }
  throw new Error(
    "Invalid variant. Use deepak, deepak2, deeppro, deeppro1, rulePnb, ruleSunpharma, ruleLtm, ruleIcicigi, ruleTechm, ruleTvsmotor, or rulePolicybzr.",
  );
}

function assertDateKey(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid date format. Use YYYY-MM-DD.");
  }
  return date;
}

function ensureDir(filePath: string): void {
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

function signalDaysPath(
  symbol: string,
  variant: PostMortemVariantId,
  fromDate: string,
  toDate: string,
): string {
  return join(
    STORE_ROOT,
    sanitizeSymbol(symbol),
    "_indexes",
    `${variant}_${fromDate}_${toDate}.json`,
  );
}

function reportPath(symbol: string, date: string, variant: PostMortemVariantId): string {
  return join(STORE_ROOT, sanitizeSymbol(symbol), assertDateKey(date), `${variant}.json`);
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown): void {
  ensureDir(filePath);
  writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

export function loadSignalDaysIndex(
  symbol: string,
  variant: string,
  fromDate: string,
  toDate: string,
): StoredSignalDaysIndex | null {
  const variantId = assertVariant(variant);
  const from = assertDateKey(fromDate);
  const to = assertDateKey(toDate);
  const stored = readJsonFile<StoredSignalDaysIndex>(
    signalDaysPath(symbol, variantId, from, to),
  );
  if (!stored || stored.version !== 1 || !Array.isArray(stored.days)) {
    return null;
  }
  if (
    variantId === "deeppro" &&
    stored.rulesRevision !== DEEPPRO_SIGNAL_DAYS_RULES_REVISION
  ) {
    return null;
  }
  if (
    variantId === "deeppro1" &&
    stored.rulesRevision !== DEEPPRO1_SIGNAL_DAYS_RULES_REVISION
  ) {
    return null;
  }
  if (
    variantId === "rulePnb" &&
    stored.rulesRevision !== RULEPNB_SIGNAL_DAYS_RULES_REVISION
  ) {
    return null;
  }
  if (
    variantId === "ruleSunpharma" &&
    stored.rulesRevision !== RULESUNPHARMA_SIGNAL_DAYS_RULES_REVISION
  ) {
    return null;
  }
  if (
    FAVOURABLE_SYMBOL_VARIANTS.has(variantId) &&
    stored.rulesRevision !== FAVOURABLE_SYMBOL_SIGNAL_DAYS_RULES_REVISION
  ) {
    return null;
  }
  return stored;
}

export function saveSignalDaysIndex(input: {
  symbol: string;
  variant: string;
  fromDate: string;
  toDate: string;
  days: StoredSignalDay[];
  tradingDaysScanned: number;
  totalSignals: number;
}): StoredSignalDaysIndex {
  const variantId = assertVariant(input.variant);
  const from = assertDateKey(input.fromDate);
  const to = assertDateKey(input.toDate);
  const symbol = sanitizeSymbol(input.symbol);
  const record: StoredSignalDaysIndex = {
    version: 1,
    savedAt: new Date().toISOString(),
    symbol,
    fromDate: from,
    toDate: to,
    variant: variantId,
    ...(variantId === "deeppro"
      ? { rulesRevision: DEEPPRO_SIGNAL_DAYS_RULES_REVISION }
      : variantId === "deeppro1"
        ? { rulesRevision: DEEPPRO1_SIGNAL_DAYS_RULES_REVISION }
        : variantId === "rulePnb"
          ? { rulesRevision: RULEPNB_SIGNAL_DAYS_RULES_REVISION }
          : variantId === "ruleSunpharma"
            ? { rulesRevision: RULESUNPHARMA_SIGNAL_DAYS_RULES_REVISION }
            : FAVOURABLE_SYMBOL_VARIANTS.has(variantId)
              ? { rulesRevision: FAVOURABLE_SYMBOL_SIGNAL_DAYS_RULES_REVISION }
              : {}),
    days: input.days,
    tradingDaysScanned: input.tradingDaysScanned,
    totalSignals: input.totalSignals,
  };
  writeJsonFile(signalDaysPath(symbol, variantId, from, to), record);
  return record;
}

export function loadPostMortemReport(
  symbol: string,
  date: string,
  variant: string,
): StoredPostMortemReport | null {
  const variantId = assertVariant(variant);
  const dateKey = assertDateKey(date);
  const stored = readJsonFile<StoredPostMortemReport>(
    reportPath(symbol, dateKey, variantId),
  );
  if (!stored || stored.version !== 1 || stored.report == null) {
    return null;
  }
  return stored;
}

export function savePostMortemReport(input: {
  symbol: string;
  date: string;
  variant: string;
  mode: string;
  report: unknown;
  series: unknown[];
}): StoredPostMortemReport {
  const variantId = assertVariant(input.variant);
  const dateKey = assertDateKey(input.date);
  const symbol = sanitizeSymbol(input.symbol);
  if (input.report == null || typeof input.report !== "object") {
    throw new Error("Missing report payload.");
  }
  if (!Array.isArray(input.series)) {
    throw new Error("Missing series payload.");
  }
  const record: StoredPostMortemReport = {
    version: 1,
    savedAt: new Date().toISOString(),
    symbol,
    date: dateKey,
    variant: variantId,
    mode: input.mode,
    report: input.report,
    series: input.series,
  };
  writeJsonFile(reportPath(symbol, dateKey, variantId), record);
  return record;
}
