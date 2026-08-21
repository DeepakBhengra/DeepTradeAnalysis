import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getSamcoAuthStatus IP diagnostics", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SAMCO_API_KEY = "test-key";
    process.env.SAMCO_API_SECRET = "test-secret";
    process.env.SAMCO_SESSION_TOKEN = "session-token";
    process.env.SAMCO_BASE_URL = "https://tradeapi.samco.in/";
    process.env.SAMCO_REQUIRED_STATIC_IP = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces Samco whoami primary/secondary and match result", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/ip/whoami")) {
        return new Response(
          JSON.stringify({
            status: "Success",
            statusMessage:
              "Calling IP (198.51.100.7) is NOT a registered IP. Registered: PRIMARY=223.181.56.224",
            srcIp: "198.51.100.7",
            primaryIp: "223.181.56.224",
            secondaryIp: null,
            matches: false,
            matchedAs: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ status: "Failure" }), { status: 500 });
    });

    const { setSamcoFetch, resetSamcoFetch } = await import(
      "../../src/samco/samcoClient.js"
    );
    const { setSamcoSessionToken } = await import("../../src/samco/samcoTokenStore.js");
    const { getSamcoAuthStatus } = await import("../../src/samco/samcoSession.js");

    setSamcoSessionToken("session-token");
    setSamcoFetch(fetchMock as typeof fetch);

    try {
      const status = await getSamcoAuthStatus();
      expect(status.srcIp).toBe("198.51.100.7");
      expect(status.primaryIp).toBe("223.181.56.224");
      expect(status.secondaryIp).toBeNull();
      expect(status.samcoIpMatches).toBe(false);
      expect(status.staticIpMessage).toContain("198.51.100.7");
      expect(status.staticIpMessage).toContain("223.181.56.224");
    } finally {
      resetSamcoFetch();
    }
  });

  it("does not treat registered primaryIp as the host srcIp", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/ip/whoami")) {
        return new Response(
          JSON.stringify({
            status: "Success",
            // srcIp intentionally missing — must not fall back to primaryIp.
            primaryIp: "223.181.56.224",
            secondaryIp: null,
            matches: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ status: "Failure" }), { status: 500 });
    });

    const { setSamcoFetch, resetSamcoFetch } = await import(
      "../../src/samco/samcoClient.js"
    );
    const { setSamcoSessionToken } = await import("../../src/samco/samcoTokenStore.js");
    const { getSamcoAuthStatus } = await import("../../src/samco/samcoSession.js");

    setSamcoSessionToken("session-token");
    setSamcoFetch(fetchMock as typeof fetch);

    try {
      const status = await getSamcoAuthStatus();
      expect(status.srcIp).toBeUndefined();
      expect(status.primaryIp).toBe("223.181.56.224");
      expect(status.samcoIpMatches).toBe(false);
    } finally {
      resetSamcoFetch();
    }
  });
});
