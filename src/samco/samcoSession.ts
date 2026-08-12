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
  getSamcoSessionMeta,
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

function applyIpStatus(
  status: SamcoAuthStatus,
  srcIp: string | undefined,
  requiredStaticIp: string,
): void {
  status.srcIp = srcIp;
  status.staticIpMatched = doesSamcoStaticIpMatch(srcIp, requiredStaticIp);
  if (!status.staticIpMatched && isSamcoStaticIpEnforced()) {
    status.staticIpMessage = formatSamcoStaticIpMismatch(srcIp, requiredStaticIp);
  } else {
    status.staticIpMessage = undefined;
  }
}

export async function getSamcoAuthStatus(): Promise<SamcoAuthStatus> {
  const ledger = loadPositionLedger();
  const runtime = getSamcoRuntimeSettings();
  const requiredStaticIp = getSamcoRequiredStaticIp();
  const sessionMeta = getSamcoSessionMeta();
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
    accountID: sessionMeta.accountID,
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
    status.accountID = status.accountID ?? sessionMeta.accountID;
    applyIpStatus(
      status,
      whoAmI.srcIp ?? whoAmI.primaryIp ?? sessionMeta.srcIp,
      requiredStaticIp,
    );
  } catch {
    // Session token from /session/token is enough to be "connected".
    // whoami may fail on some hosts; fall back to IP from the login response.
    if (hasValidSamcoSessionToken()) {
      status.connected = true;
      applyIpStatus(
        status,
        sessionMeta.srcIp ?? sessionMeta.primaryIp,
        requiredStaticIp,
      );
      if (!status.srcIp && isSamcoStaticIpEnforced()) {
        status.staticIpMatched = false;
        status.staticIpMessage = `Could not verify egress IP via Samco whoami (required ${requiredStaticIp}). Click Refresh session.`;
      }
    } else {
      status.connected = false;
      status.staticIpMatched = !isSamcoStaticIpEnforced();
      if (isSamcoStaticIpEnforced()) {
        status.staticIpMatched = false;
        status.staticIpMessage = `Could not verify egress IP via Samco whoami (required ${requiredStaticIp}).`;
      }
    }
  }

  return status;
}

export async function initializeSamcoSession(): Promise<void> {
  if (!config.samco.apiKey || !config.samco.apiSecret) {
    return;
  }

  assertSamcoApiKeys();

  try {
    const token = await ensureSamcoSessionToken();
    if (!token) {
      throw new Error("Samco session token was empty after generation.");
    }

    const meta = getSamcoSessionMeta();
    let srcIp = meta.srcIp ?? meta.primaryIp;
    try {
      const whoAmI = await getSamcoWhoAmI();
      srcIp = whoAmI.srcIp ?? whoAmI.primaryIp ?? srcIp;
    } catch (whoAmIError) {
      const message =
        whoAmIError instanceof Error ? whoAmIError.message : String(whoAmIError);
      console.warn(
        `Samco whoami after login failed (${message}); using session/token IP metadata.`,
      );
    }

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
    console.warn(
      `Samco IP/session check failed: ${message}. ` +
        `Use AES-encrypted SAMCO_API_KEY / SAMCO_API_SECRET from the Samco Trade API dashboard, ` +
        `sign in once on the Samco mobile app if prompted, then click Refresh session.`,
    );
  }
}

export async function refreshSamcoSession(): Promise<string> {
  assertSamcoApiKeys();
  const session = await refreshSamcoSessionToken();
  const token = session.sessionToken ?? getSamcoSessionToken();
  if (!token) {
    throw new Error("Samco refresh did not return a session token.");
  }

  // Prefer whoami for live IP, but do not fail refresh when whoami is flaky —
  // POST /session/token already proved the credentials and returns srcIp.
  try {
    await getSamcoWhoAmI();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const meta = getSamcoSessionMeta();
    if (meta.srcIp || meta.primaryIp) {
      console.warn(
        `Samco whoami failed after refresh (${message}); session token is valid (IP from login: ${meta.srcIp ?? meta.primaryIp}).`,
      );
    } else {
      console.warn(
        `Samco whoami failed after refresh (${message}); session token was still issued.`,
      );
    }
  }

  return token;
}
