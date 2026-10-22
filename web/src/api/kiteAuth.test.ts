import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchKiteStatus } from "./kiteAuth";

describe("fetchKiteStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns JSON status when the API is healthy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          connected: false,
          redirectUrl: "http://localhost:3001/api/kite/callback",
          appUrl: "http://localhost:5173",
          loginUrl: "",
        }),
      }),
    );

    await expect(fetchKiteStatus()).resolves.toEqual({
      connected: false,
      redirectUrl: "http://localhost:3001/api/kite/callback",
      appUrl: "http://localhost:5173",
      loginUrl: "",
    });
  });

  it("surfaces a JSON error body from a 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Kite config is missing." }),
      }),
    );

    await expect(fetchKiteStatus()).rejects.toThrow("Kite config is missing.");
  });

  it("maps an opaque proxy 500 to a start-the-API message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );

    await expect(fetchKiteStatus()).rejects.toThrow(
      /Cannot reach the API on port 3001/,
    );
  });
});
