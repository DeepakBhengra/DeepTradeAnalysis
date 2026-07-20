import type { Request, Response } from "express";
import { getKiteAppUrl } from "../config.js";

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;

export function isAllowedLocalOrigin(value: string): boolean {
  return LOCALHOST_ORIGIN.test(value);
}

export function resolveKiteReturnTo(
  returnTo: string | undefined,
  fallback = getKiteAppUrl(),
): string {
  if (returnTo && isAllowedLocalOrigin(returnTo)) {
    return returnTo;
  }
  return fallback;
}

export function setKiteReturnToCookie(res: Response, returnTo: string): void {
  res.setHeader(
    "Set-Cookie",
    `kite_return_to=${encodeURIComponent(returnTo)}; Path=/; Max-Age=300; HttpOnly; SameSite=Lax`,
  );
}

export function readKiteReturnToCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith("kite_return_to=")) {
      continue;
    }
    const value = trimmed.slice("kite_return_to=".length);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}

export function clearKiteReturnToCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    "kite_return_to=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
  );
}
