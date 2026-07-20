import { describe, expect, it } from "vitest";
import {
  getKiteAccessToken,
  hasValidKiteAccessToken,
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
});
