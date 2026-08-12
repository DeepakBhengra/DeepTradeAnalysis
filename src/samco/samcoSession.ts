import { assertSamcoApiKeys, config } from "../config.js";
import {
  ensureSamcoSessionToken,
  getSamcoWhoAmI,
  refreshSamcoSessionToken,
} from "./samcoClient.js";
import { getSamcoLiveTradingEnabled } from "./samcoLiveTrading.js";
import { getSamcoRuntimeSettings } from "./samcoRuntimeSettings.js";
import {
  doesSamcoStaticIpMatch,
  formatSamcoStaticIpMismatch,
  getSamcoRequiredStaticIp,
  isSamcoStaticIpEnforced,
} from "./samcoStaticIp.js";
import {
  getSamcoSessionToken,
  hasValidSamcoSessionToken,
} from "./samcoTokenStore.js";
import { loadPositionLedger, getOpenLedgerEntries } from "./positionLedger.js";

export interface SamcoAuthStatus {
  connected: boolean;
  sessionTokenPresent: boolean;
  dryRun: boolean;
  liveTradingEnabled: boolean;
  baseUrl: string;
  productType: string;
  orderType: string;
  defaultQuantity: number;
  effectiveQuantity: number;
  settingsDateKey: string;
  envDefaultQuantity: number;
  envDefaultDryRun: boolean;
  openPositionsCount: number;
  accountID?: string;
  srcIp?: string;
  /** Configured Samco-registered static IP (empty = check disabled). */
  requiredStaticIp: string;
  /** True when srcIp matches requiredStaticIp (or check disabled). */
  staticIpMatched: boolean;
  staticIpMessage?: string;
}

export async function getSamcoAuthStatus(): Promise<SamcoAuthStatus> {
  const ledger = loadPositionLedger();
  const runtime = getSamcoRuntimeSettings();
  const requiredStaticIp = getSamcoRequiredStaticIp();
  const status: SamcoAuthStatus = {
    connected: hasValidSamcoSessionToken(),
    sessionTokenPresent: hasValidSamcoSessionToken(),
    dryRun: runtime.dryRun,
    liveTradingEnabled: getSamcoLiveTradingEnabled(),
    baseUrl: config.samco.baseUrl,
    productType: config.samco.productType,
    orderType: config.samco.orderType,
    defaultQuantity: runtime.quantity,
    effectiveQuantity: runtime.effectiveQuantity,
    settingsDateKey: runtime.dateKey,
    envDefaultQuantity: runtime.envDefaultQuantity,
    envDefaultDryRun: runtime.envDefaultDryRun,
    openPositionsCount: getOpenLedgerEntries(ledger).length,
    requiredStaticIp,
    staticIpMatched: !isSamcoStaticIpEnforced(),
  };

  if (!hasValidSamcoSessionToken()) {
    if (isSamcoStaticIpEnforced()) {
      status.staticIpMatched = false;
      status.staticIpMessage = `Connect session so Samco can confirm egress IP is ${requiredStaticIp}.`;
    }
    return status;
  }

  try {
    const whoAmI = await getSamcoWhoAmI();
    status.connected = true;
    status.srcIp = whoAmI.srcIp ?? whoAmI.primaryIp;
    status.staticIpMatched = doesSamcoStaticIpMatch(status.srcIp, requiredStaticIp);
    if (!status.staticIpMatched && isSamcoStaticIpEnforced()) {
      status.staticIpMessage = formatSamcoStaticIpMismatch(
        status.srcIp,
        requiredStaticIp,
      );
    }
  } catch {
    status.connected = false;
    status.staticIpMatched = !isSamcoStaticIpEnforced();
    if (isSamcoStaticIpEnforced()) {
      status.staticIpMatched = false;
      status.staticIpMessage = `Could not verify egress IP via Samco whoami (required ${requiredStaticIp}).`;
    }
  }

  return status;
}

export async function initializeSamcoSession(): Promise<void> {
  if (!config.samco.apiKey || !config.samco.apiSecret) {
    return;
  }

  assertSamcoApiKeys();
  await ensureSamcoSessionToken();

  try {
    const whoAmI = await getSamcoWhoAmI();
    const srcIp = whoAmI.srcIp ?? whoAmI.primaryIp;
    const requiredStaticIp = getSamcoRequiredStaticIp();
    console.log(
      `Samco session ready (IP: ${srcIp ?? "unknown"}, required: ${requiredStaticIp || "any"}, token: ${getSamcoSessionToken().slice(0, 8)}...)`,
    );
    if (
      isSamcoStaticIpEnforced() &&
      !doesSamcoStaticIpMatch(srcIp, requiredStaticIp)
    ) {
      console.warn(formatSamcoStaticIpMismatch(srcIp, requiredStaticIp));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Samco IP/session check failed: ${message}`);
  }
}

export async function refreshSamcoSession(): Promise<string> {
  assertSamcoApiKeys();
  const session = await refreshSamcoSessionToken();
  return session.sessionToken ?? getSamcoSessionToken();
}
