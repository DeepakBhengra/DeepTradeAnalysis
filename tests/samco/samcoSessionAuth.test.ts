import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("samco session auth recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SAMCO_API_KEY = "test-key";
    process.env.SAMCO_API_SECRET = "test-secret";
    process.env.SAMCO_SESSION_TOKEN = "stale-session-token";
    process.env.SAMCO_BASE_URL = "https://tradeapi.samco.in/";
    process.env.SAMCO_REQUIRED_STATIC_IP = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects trading-session-missing errors", async () => {
    const { SamcoApiError, isSamcoSessionAuthError } = await import(
      "../../src/samco/samcoClient.js"
    );

    expect(
      isSamcoSessionAuthError(
        new SamcoApiError(401, {
          statusMessage:
            "Unauthorized - Trading session is missing. Please generate a fresh session token.",
        }),
      ),
    ).toBe(true);
    expect(isSamcoSessionAuthError(new Error("order rejected"))).toBe(false);
  });

  it("does not fall back to startup config token after clear", async () => {
    const { setSamcoSessionToken, clearSamcoSessionToken, getSamcoSessionToken } =
      await import("../../src/samco/samcoTokenStore.js");

    setSamcoSessionToken("stale-session-token");
    clearSamcoSessionToken();
    expect(getSamcoSessionToken()).toBe("");
  });

  it("omits x-session-token when generating a new session", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/session/token") && method === "POST") {
        const headers = new Headers(init?.headers);
        expect(headers.get("x-session-token")).toBeNull();
        return new Response(
          JSON.stringify({
            status: "Success",
            sessionToken: "fresh-session-token",
            srcIp: "223.181.63.52",
            accountID: "DV99999",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ status: "Failure" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });

    const { setSamcoFetch, resetSamcoFetch, refreshSamcoSessionToken } =
      await import("../../src/samco/samcoClient.js");
    const { setSamcoSessionToken, getSamcoSessionToken, getSamcoSessionMeta } =
      await import("../../src/samco/samcoTokenStore.js");

    setSamcoSessionToken("stale-session-token");
    setSamcoFetch(fetchMock as typeof fetch);

    try {
      const session = await refreshSamcoSessionToken();
      expect(session.sessionToken).toBe("fresh-session-token");
      expect(getSamcoSessionToken()).toBe("fresh-session-token");
      expect(getSamcoSessionMeta().srcIp).toBe("223.181.63.52");
      expect(getSamcoSessionMeta().accountID).toBe("DV99999");
    } finally {
      resetSamcoFetch();
    }
  });

  it("clears a stale token, regenerates, and retries whoami", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/ip/whoami") && method === "GET") {
        const headers = new Headers(init?.headers);
        const token = headers.get("x-session-token");
        if (token === "stale-session-token") {
          return new Response(
            JSON.stringify({
              status: "Failure",
              statusMessage:
                "Unauthorized - Trading session is missing. Please generate a fresh session token.",
            }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
        if (token === "fresh-session-token") {
          return new Response(
            JSON.stringify({
              status: "Success",
              srcIp: "223.181.63.52",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ status: "Failure" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/session/token") && method === "POST") {
        const headers = new Headers(init?.headers);
        expect(headers.get("x-session-token")).toBeNull();
        return new Response(
          JSON.stringify({
            status: "Success",
            sessionToken: "fresh-session-token",
            srcIp: "223.181.63.52",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ status: "Failure" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });

    const { setSamcoFetch, resetSamcoFetch, getSamcoWhoAmI } = await import(
      "../../src/samco/samcoClient.js"
    );
    const { getSamcoSessionToken, setSamcoSessionToken } = await import(
      "../../src/samco/samcoTokenStore.js"
    );

    setSamcoSessionToken("stale-session-token");
    setSamcoFetch(fetchMock as typeof fetch);

    try {
      const whoAmI = await getSamcoWhoAmI();
      expect(whoAmI.srcIp).toBe("223.181.63.52");
      expect(getSamcoSessionToken()).toBe("fresh-session-token");

      const whoamiCalls = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes("/ip/whoami"),
      );
      const tokenCalls = fetchMock.mock.calls.filter((call) =>
        String(call[0]).includes("/session/token"),
      );
      expect(whoamiCalls.length).toBe(2);
      expect(tokenCalls.length).toBe(1);
    } finally {
      resetSamcoFetch();
    }
  });

  it("refresh succeeds even when whoami remains unauthorized", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.includes("/session/token") && method === "POST") {
        return new Response(
          JSON.stringify({
            status: "Success",
            sessionToken: "fresh-session-token",
            srcIp: "223.181.63.52",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.includes("/ip/whoami") && method === "GET") {
        return new Response(
          JSON.stringify({
            status: "Failure",
            statusMessage:
              "Unauthorized - Trading session is missing. Please generate a fresh session token.",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ status: "Failure" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });

    const { setSamcoFetch, resetSamcoFetch } = await import(
      "../../src/samco/samcoClient.js"
    );
    const { refreshSamcoSession } = await import("../../src/samco/samcoSession.js");

    setSamcoFetch(fetchMock as typeof fetch);
    try {
      const token = await refreshSamcoSession();
      expect(token).toBe("fresh-session-token");
    } finally {
      resetSamcoFetch();
    }
  });
});
