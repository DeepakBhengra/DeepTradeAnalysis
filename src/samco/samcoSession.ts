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
  /** Egress IP Samco saw on the last whoami / session call. */
  srcIp?: string;
  /** Registered PRIMARY IP from Samco whoami / session (null/empty = none). */
  primaryIp?: string | null;
  /** Registered SECONDARY IP from Samco whoami / session. */
  secondaryIp?: string | null;
  /** Samco whoami `matches` — true when srcIp is PRIMARY or SECONDARY. */
  samcoIpMatches?: boolean;
  matchedAs?: string | null;
  whoAmIMessage?: string;
  /** Configured local allowlist IP (empty = local check disabled). */
  requiredStaticIp: string;
  /** True when srcIp matches requiredStaticIp (or local check disabled). */
  staticIpMatched: boolean;
  staticIpMessage?: string;
}

function normalizeIp(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function applyWhoAmIStatus(
  status: SamcoAuthStatus,
  whoAmI: {
    srcIp?: string | null;
    primaryIp?: string | null;
    secondaryIp?: string | null;
    matches?: boolean;
    matchedAs?: string | null;
    statusMessage?: string;
  },
  fallbackSrcIp?: string,
): void {
  const srcIp = normalizeIp(whoAmI.srcIp) ?? normalizeIp(fallbackSrcIp);
  const primaryIp = normalizeIp(whoAmI.primaryIp) ?? null;
  const secondaryIp = normalizeIp(whoAmI.secondaryIp) ?? null;

  status.srcIp = srcIp;
  status.primaryIp = primaryIp;
  status.secondaryIp = secondaryIp;
  status.matchedAs = whoAmI.matchedAs ?? null;
  status.whoAmIMessage = whoAmI.statusMessage;

  if (typeof whoAmI.matches === "boolean") {
    status.samcoIpMatches = whoAmI.matches;
  } else if (srcIp) {
    status.samcoIpMatches =
      srcIp === primaryIp || (secondaryIp != null && srcIp === secondaryIp);
  } else {
    status.samcoIpMatches = undefined;
  }

  const requiredStaticIp = status.requiredStaticIp;
  status.staticIpMatched = doesSamcoStaticIpMatch(srcIp, requiredStaticIp);
  if (!status.staticIpMatched && isSamcoStaticIpEnforced()) {
    status.staticIpMessage = formatSamcoStaticIpMismatch(srcIp, requiredStaticIp);
  } else if (status.samcoIpMatches === false) {
    const base =
      whoAmI.statusMessage ??
      `Samco sees this host as ${srcIp ?? "unknown"}, but registered PRIMARY=${primaryIp ?? "none"} SECONDARY=${secondaryIp ?? "none"}.`;
    const appHint =
      !primaryIp && !secondaryIp
        ? " This session’s OAuth app has no Static IP in Samco’s API (PRIMARY=none). If the Dashboard shows an IP on app samcodeepakapiofc (or another name), that IP is on a different app than SAMCO_API_KEY / SAMCO_API_SECRET — open API Keys, copy keys from the same app where the IP is registered, update .env, then Refresh session."
        : " Order APIs will reject until this host’s egress IP is PRIMARY or SECONDARY for the same OAuth app as SAMCO_API_KEY.";
    status.staticIpMessage = `${base}${appHint}`;
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
    primaryIp: sessionMeta.primaryIp ?? null,
    secondaryIp: sessionMeta.secondaryIp ?? null,
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
    applyWhoAmIStatus(status, whoAmI, sessionMeta.srcIp);
  } catch {
    // Session token from /session/token is enough to be "connected".
    // whoami may fail on some hosts; fall back to IP from the login response.
    if (hasValidSamcoSessionToken()) {
      status.connected = true;
      applyWhoAmIStatus(
        status,
        {
          srcIp: sessionMeta.srcIp,
          primaryIp: sessionMeta.primaryIp,
          secondaryIp: sessionMeta.secondaryIp,
        },
        sessionMeta.srcIp,
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
    // Never fall back srcIp → primaryIp; that hides a real egress mismatch.
    let srcIp = meta.srcIp;
    try {
      const whoAmI = await getSamcoWhoAmI();
      srcIp = whoAmI.srcIp ?? srcIp;
      console.log(
        `Samco whoami: srcIp=${whoAmI.srcIp ?? "unknown"} primary=${whoAmI.primaryIp ?? "none"} secondary=${whoAmI.secondaryIp ?? "none"} matches=${String(whoAmI.matches)}`,
      );
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
