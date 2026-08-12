/**
 * Samco `/order/placeOrder` only documents Limit (`L`) and Stop-Limit (`SL`).
 * Older env configs used `MKT`; map unsupported values to `L` and always send price.
 */
export type SamcoPlaceOrderType = "L" | "SL";

export function resolveSamcoPlaceOrderType(
  raw: string | undefined | null,
): SamcoPlaceOrderType {
  const normalized = (raw ?? "").trim().toUpperCase();
  if (
    normalized === "SL" ||
    normalized === "SL-L" ||
    normalized === "STOPLOSS" ||
    normalized === "STOP_LOSS"
  ) {
    return "SL";
  }
  return "L";
}

export function formatSamcoLimitPrice(price: number): string {
  if (!Number.isFinite(price)) {
    throw new Error(`Invalid Samco limit price: ${price}`);
  }
  return price.toFixed(2);
}
