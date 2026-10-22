import { describe, expect, it } from "vitest";

import {
  API_UNREACHABLE_HINT,
  errorMessageFromResponse,
  formatNetworkFetchError,
  formatUnknownError,
  opaqueHttpFallback,
  readApiErrorBody,
} from "./formatError";

describe("formatUnknownError", () => {
  it("reads nested API error bodies", () => {
    expect(readApiErrorBody({ error: "Server down" }, "fallback")).toBe("Server down");
    expect(readApiErrorBody({ error: { message: "Bad request" } }, "fallback")).toBe(
      "Bad request",
    );
    expect(readApiErrorBody(null, "fallback")).toBe("fallback");
  });

  it("formats plain objects without message as JSON", () => {
    expect(formatUnknownError({ code: 123 })).toBe('{"code":123}');
  });
});

describe("opaqueHttpFallback", () => {
  it("maps proxy 500/502/503 to the start-the-API hint", () => {
    expect(opaqueHttpFallback(500, "Saving Kite access token failed")).toBe(
      API_UNREACHABLE_HINT,
    );
    expect(opaqueHttpFallback(404, "Saving Kite access token failed")).toBe(
      "Saving Kite access token failed: 404",
    );
  });
});

describe("errorMessageFromResponse", () => {
  it("prefers a JSON error body over the fallback", async () => {
    const message = await errorMessageFromResponse(
      {
        status: 400,
        json: async () => ({
          error:
            "Kite rejected this access token (incorrect api_key or access_token). Click Login via Zerodha to generate today's token. Do not paste request_token, PIN, or an instrument id.",
        }),
      } as Response,
      "Saving Kite access token failed",
    );

    expect(message).toMatch(/Login via Zerodha/);
  });

  it("maps an opaque 500 to the start-the-API hint", async () => {
    const message = await errorMessageFromResponse(
      {
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      } as Response,
      "Dashboard request failed",
    );

    expect(message).toBe(API_UNREACHABLE_HINT);
  });
});

describe("formatNetworkFetchError", () => {
  it("maps browser Failed to fetch to actionable API server message", () => {
    const message = formatNetworkFetchError(new Error("Failed to fetch"), "day scan");
    expect(message).toContain("Cannot connect to the API server");
    expect(message).toContain("npm run dev:dashboard");
    expect(message).toContain("localhost:5173");
  });
});
