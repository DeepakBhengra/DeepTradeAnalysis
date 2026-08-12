import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";

const PLACEHOLDER_TOKENS = new Set([
  "",
  "your_session_token",
  "your_samco_session_token",
]);

let runtimeSessionToken: string | undefined;

function normalizeToken(token: string | undefined): string {
  return token?.trim() ?? "";
}

export function getSamcoSessionToken(): string {
  return normalizeToken(runtimeSessionToken ?? config.samco.sessionToken);
}

export function hasValidSamcoSessionToken(): boolean {
  const token = getSamcoSessionToken();
  return token.length > 0 && !PLACEHOLDER_TOKENS.has(token);
}

export function setSamcoSessionToken(token: string): void {
  const normalized = normalizeToken(token);
  runtimeSessionToken = normalized;
  process.env.SAMCO_SESSION_TOKEN = normalized;
}

/** Drop a stale/invalid session so the next ensure regenerates from API keys. */
export function clearSamcoSessionToken(): void {
  runtimeSessionToken = undefined;
  process.env.SAMCO_SESSION_TOKEN = "";
}

export function persistSamcoSessionTokenToEnv(token: string): void {
  const normalized = normalizeToken(token);
  setSamcoSessionToken(normalized);

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
