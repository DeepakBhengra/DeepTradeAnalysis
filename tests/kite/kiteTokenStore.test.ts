import { describe, expect, it } from "vitest";
import {
  getKiteAccessToken,
  hasValidKiteAccessToken,
  normalizeAndValidateKiteAccessToken,
  setKiteAccessToken,
} from "../../src/kite/kiteTokenStore.js";

describe("kiteTokenStore", () => {
  it("treats placeholder tokens as disconnected", () => {
    setKiteAccessToken("your_daily_access_token");
    expect(hasValidKiteAccessToken()).toBe(false);
  });

  it("stores runtime access tokens", () => {
    setKiteAccessToken("abc123");
    expect(hasValidKiteAccessToken()).toBe(true);
    expect(getKiteAccessToken()).toBe("abc123");
  });

  it("rejects placeholder values when validating manual tokens", () => {
    expect(() =>
      normalizeAndValidateKiteAccessToken("your_daily_access_token"),
    ).toThrow(/valid Kite access token/);
  });

  it("accepts non-placeholder manual tokens", () => {
    expect(normalizeAndValidateKiteAccessToken("  real-token  ")).toBe(
      "real-token",
    );
  });
});
