import { describe, expect, it } from "vitest";
import { setManualKiteAccessToken } from "../../src/kite/kiteAuth.js";
import {
  hasValidKiteAccessToken,
  setKiteAccessToken,
} from "../../src/kite/kiteTokenStore.js";

describe("setManualKiteAccessToken", () => {
  it("rejects empty and placeholder tokens", () => {
    setKiteAccessToken("");
    expect(() => setManualKiteAccessToken("")).toThrow(/valid Kite access token/);
    expect(() => setManualKiteAccessToken("your_daily_access_token")).toThrow(
      /valid Kite access token/,
    );
    expect(hasValidKiteAccessToken()).toBe(false);
  });

  it("persists a manual access token in runtime state", () => {
    const status = setManualKiteAccessToken("manual-token-123");
    expect(status.connected).toBe(true);
    expect(hasValidKiteAccessToken()).toBe(true);
  });
});
