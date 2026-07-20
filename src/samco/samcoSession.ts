import { assertSamcoApiKeys, config } from "../config.js";
import {
  ensureSamcoSessionToken,
  getSamcoWhoAmI,
  refreshSamcoSessionToken,
} from "./samcoClient.js";
import { getSamcoLiveTradingEnabled } from "./samcoLiveTrading.js";
import { getSamcoRuntimeSettings } from "./samcoRuntimeSettings.js";
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
}

export async function getSamcoAuthStatus(): Promise<SamcoAuthStatus> {
  const ledger = loadPositionLedger();
  const runtime = getSamcoRuntimeSettings();
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
  };

  if (!hasValidSamcoSessionToken()) {
    return status;
  }

  try {
    const whoAmI = await getSamcoWhoAmI();
    status.connected = true;
    status.srcIp = whoAmI.srcIp;
  } catch {
    status.connected = false;
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
    console.log(
      `Samco session ready (IP: ${whoAmI.srcIp ?? "unknown"}, token: ${getSamcoSessionToken().slice(0, 8)}...)`,
    );
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
