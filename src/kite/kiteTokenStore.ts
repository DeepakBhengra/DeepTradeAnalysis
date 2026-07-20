import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";

const PLACEHOLDER_TOKENS = new Set([
  "",
  "your_daily_access_token",
  "your_access_token",
]);

let runtimeAccessToken: string | undefined;

function normalizeToken(token: string | undefined): string {
  return token?.trim() ?? "";
}

export function getKiteAccessToken(): string {
  return normalizeToken(runtimeAccessToken ?? config.kite.accessToken);
}

export function hasValidKiteAccessToken(): boolean {
  const token = getKiteAccessToken();
  return token.length > 0 && !PLACEHOLDER_TOKENS.has(token);
}

export function setKiteAccessToken(token: string): void {
  const normalized = normalizeToken(token);
  runtimeAccessToken = normalized;
  process.env.KITE_ACCESS_TOKEN = normalized;
}

export function persistKiteAccessTokenToEnv(token: string): void {
  const normalized = normalizeToken(token);
  setKiteAccessToken(normalized);

  const envPath = resolve(process.cwd(), ".env");
  const line = `KITE_ACCESS_TOKEN=${normalized}`;

  if (!existsSync(envPath)) {
    writeFileSync(envPath, `${line}\n`, "utf8");
    return;
  }

  const content = readFileSync(envPath, "utf8");
  const pattern = /^KITE_ACCESS_TOKEN=.*$/m;

  if (pattern.test(content)) {
    writeFileSync(envPath, content.replace(pattern, line), "utf8");
    return;
  }

  writeFileSync(
    envPath,
    `${content.trimEnd()}\n${line}\n`,
    "utf8",
  );
}
