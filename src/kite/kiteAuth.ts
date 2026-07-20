import { KiteConnect } from "kiteconnect";
import type { Connect } from "kiteconnect";
import { assertKiteApiKeys, config, getKiteAppUrl, getKiteRedirectUrl } from "../config.js";
import {
  getKiteAccessToken,
  hasValidKiteAccessToken,
  persistKiteAccessTokenToEnv,
} from "./kiteTokenStore.js";

export interface KiteAuthStatus {
  connected: boolean;
  redirectUrl: string;
  appUrl: string;
  loginUrl: string;
}

export interface KiteSessionResult {
  accessToken: string;
  userId?: string;
  userName?: string;
}

function createLoginClient(): Connect {
  assertKiteApiKeys();
  return new KiteConnect({ api_key: config.kite.apiKey });
}

export function getKiteAuthStatus(): KiteAuthStatus {
  const loginUrl = config.kite.apiKey
    ? `${config.kite.apiBaseUrl}/api/kite/login`
    : "";

  return {
    connected: hasValidKiteAccessToken(),
    redirectUrl: getKiteRedirectUrl(),
    appUrl: getKiteAppUrl(),
    loginUrl,
  };
}

export async function completeKiteLogin(
  requestToken: string,
): Promise<KiteSessionResult> {
  assertKiteApiKeys();

  const kite = createLoginClient();
  const session = await kite.generateSession(
    requestToken,
    config.kite.apiSecret,
  );

  const accessToken =
    typeof session.access_token === "string" ? session.access_token : "";

  if (!accessToken) {
    throw new Error("Kite login succeeded but no access_token was returned.");
  }

  persistKiteAccessTokenToEnv(accessToken);

  return {
    accessToken,
    userId: typeof session.user_id === "string" ? session.user_id : undefined,
    userName:
      typeof session.user_name === "string" ? session.user_name : undefined,
  };
}

export function getKiteLoginUrl(): string {
  return createLoginClient().getLoginURL();
}

export function getActiveKiteAccessToken(): string {
  if (!hasValidKiteAccessToken()) {
    throw new Error(
      "Kite not connected. Click Connect Kite to log in, or set KITE_ACCESS_TOKEN in .env.",
    );
  }

  return getKiteAccessToken();
}
