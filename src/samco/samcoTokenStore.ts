import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";

const PLACEHOLDER_TOKENS = new Set([
  "",
  "your_session_token",
  "your_samco_session_token",
]);

/**
 * Once we set/clear at runtime, never fall back to the startup
 * `config.samco.sessionToken` (that value is frozen at process boot).
 */
let runtimeTokenOverride = false;
let runtimeSessionToken = "";

export interface SamcoSessionMeta {
  accountID?: string;
  accountName?: string;
  srcIp?: string;
  primaryIp?: string;
  secondaryIp?: string;
}

let lastSessionMeta: SamcoSessionMeta = {};

function normalizeToken(token: string | undefined | null): string {
  return token?.trim() ?? "";
}

export function getSamcoSessionToken(): string {
  if (runtimeTokenOverride) {
    return normalizeToken(runtimeSessionToken);
  }
  return normalizeToken(config.samco.sessionToken);
}

export function hasValidSamcoSessionToken(): boolean {
  const token = getSamcoSessionToken();
  return token.length > 0 && !PLACEHOLDER_TOKENS.has(token);
}

export function setSamcoSessionToken(token: string): void {
  const normalized = normalizeToken(token);
  runtimeTokenOverride = true;
  runtimeSessionToken = normalized;
  process.env.SAMCO_SESSION_TOKEN = normalized;
}

/** Drop a stale/invalid session so the next ensure regenerates from API keys. */
export function clearSamcoSessionToken(): void {
  runtimeTokenOverride = true;
  runtimeSessionToken = "";
  process.env.SAMCO_SESSION_TOKEN = "";
  lastSessionMeta = {};
}

export function setSamcoSessionMeta(meta: SamcoSessionMeta): void {
  lastSessionMeta = {
    accountID: meta.accountID,
    accountName: meta.accountName,
    srcIp: meta.srcIp,
    primaryIp: meta.primaryIp,
    secondaryIp: meta.secondaryIp,
  };
}

export function getSamcoSessionMeta(): SamcoSessionMeta {
  return { ...lastSessionMeta };
}

export function persistSamcoSessionTokenToEnv(token: string): void {
  const normalized = normalizeToken(token);
  setSamcoSessionToken(normalized);

  // Never rewrite the developer's .env during unit tests.
  if (process.env.VITEST || process.env.SAMCO_DISABLE_ENV_PERSIST === "1") {
    return;
  }

  const envPath = resolve(process.cwd(), ".env");
  const line = `SAMCO_SESSION_TOKEN=${normalized}`;

  if (!existsSync(envPath)) {
    writeFileSync(envPath, `${line}\n`, "utf8");
    return;
  }

  const content = readFileSync(envPath, "utf8");
  const pattern = /^SAMCO_SESSION_TOKEN=.*$/m;

  if (pattern.test(content)) {
    writeFileSync(envPath, content.replace(pattern, line), "utf8");
    return;
  }

  writeFileSync(envPath, `${content.trimEnd()}\n${line}\n`, "utf8");
}
