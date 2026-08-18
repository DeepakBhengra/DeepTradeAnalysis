import { config } from "../config.js";
import { getSamcoWhoAmI } from "./samcoClient.js";

/**
 * Optional required egress IP when SAMCO_REQUIRED_STATIC_IP is set.
 * Strict IP checking is off by default (empty).
 */
export const DEFAULT_SAMCO_REQUIRED_STATIC_IP = "";

export function getSamcoRequiredStaticIp(): string {
  return (config.samco.requiredStaticIp ?? "").trim();
}

export function isSamcoStaticIpEnforced(): boolean {
  return getSamcoRequiredStaticIp().length > 0;
}

export function doesSamcoStaticIpMatch(
  srcIp: string | undefined | null,
  requiredIp = getSamcoRequiredStaticIp(),
): boolean {
  if (!requiredIp) {
    return true;
  }
  if (!srcIp || !srcIp.trim()) {
    return false;
  }
  return srcIp.trim() === requiredIp;
}

export function formatSamcoStaticIpMismatch(
  srcIp: string | undefined | null,
  requiredIp = getSamcoRequiredStaticIp(),
): string {
  return (
    `Samco live trading requires static egress IP ${requiredIp}, ` +
    `but this host is seen as ${srcIp?.trim() || "unknown"}. ` +
    `Run the API on the machine/VPS that owns ${requiredIp} ` +
    `(registered in the Samco developer portal), then Refresh session.`
  );
}

/**
 * Optional allowlist check when SAMCO_REQUIRED_STATIC_IP is set.
 * No-op (always passes) when the env is empty — the default.
 * Live placeOrder / squareOff no longer call this by default.
 */
export async function assertSamcoEgressIpForLiveOrders(): Promise<string | undefined> {
  const requiredIp = getSamcoRequiredStaticIp();
  if (!requiredIp) {
    return undefined;
  }

  const whoAmI = await getSamcoWhoAmI();
  const srcIp = whoAmI.srcIp ?? whoAmI.primaryIp;
  if (!doesSamcoStaticIpMatch(srcIp, requiredIp)) {
    throw new Error(formatSamcoStaticIpMismatch(srcIp, requiredIp));
  }
  return srcIp;
}
