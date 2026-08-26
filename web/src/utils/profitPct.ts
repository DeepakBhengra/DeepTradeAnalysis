/** Default Deeppro1 mid-price profit target (%). */
export const DEFAULT_DEEPPRO1_PROFIT_PCT = 0.45;

/** Preset profit-% options shown in Day Scan / Sim / Order / Samco selects. */
export const DEEPPRO1_PROFIT_PCT_OPTIONS = [
  0.3, 0.45, 0.5, 0.6, 0.75, 1, 1.5, 2,
] as const;

/**
 * Normalize a profit-% setting for Deeppro1 square-off.
 * Blank/invalid/non-positive → fallback (default 0.45). Never "off".
 */
export function normalizeProfitPct(
  value: number | null | undefined,
  fallback: number = DEFAULT_DEEPPRO1_PROFIT_PCT,
): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 100) {
    return value;
  }
  if (Number.isFinite(fallback) && fallback > 0 && fallback <= 100) {
    return fallback;
  }
  return DEFAULT_DEEPPRO1_PROFIT_PCT;
}

export function formatProfitPctLabel(value: number): string {
  const normalized = normalizeProfitPct(value);
  return Number.isInteger(normalized) ? `${normalized}%` : `${normalized}%`;
}
