import { describe, expect, it } from "vitest";
import {
  getDashboardSymbol,
  resolveDashboardSymbol,
} from "../../src/config.js";

describe("resolveDashboardSymbol", () => {
  it("resolves registry ids", () => {
    expect(resolveDashboardSymbol("pnb").tradingSymbol).toBe("PNB");
    expect(resolveDashboardSymbol("niftyBank").tradingSymbol).toBe("NIFTY BANK");
  });

  it("resolves registry trading symbols and exchange symbols", () => {
    expect(resolveDashboardSymbol("PNB").id).toBe("pnb");
    expect(resolveDashboardSymbol("NSE:PNB").id).toBe("pnb");
    expect(resolveDashboardSymbol("NIFTY BANK").id).toBe("niftyBank");
    expect(resolveDashboardSymbol("NSE:NIFTY BANK").id).toBe("niftyBank");
  });

  it("normalizes NSE equity symbols", () => {
    const resolved = resolveDashboardSymbol("reliance");

    expect(resolved).toEqual({
      id: "RELIANCE",
      symbol: "NSE:RELIANCE",
      tradingSymbol: "RELIANCE",
      exchange: "NSE",
      segment: "NSE",
    });
  });

  it("maps common aliases to NSE tickers", () => {
    const resolved = resolveDashboardSymbol("SBI");

    expect(resolved.tradingSymbol).toBe("SBIN");
    expect(resolved.symbol).toBe("NSE:SBIN");
    expect(resolved.id).toBe("SBIN");
  });

  it("maps LTIM to LTM", () => {
    const resolved = resolveDashboardSymbol("LTIM");

    expect(resolved.tradingSymbol).toBe("LTM");
    expect(resolved.symbol).toBe("NSE:LTM");
  });

  it("strips NSE: prefix for equities", () => {
    const resolved = resolveDashboardSymbol("NSE:TCS");

    expect(resolved.tradingSymbol).toBe("TCS");
    expect(resolved.symbol).toBe("NSE:TCS");
  });

  it("rejects index symbols not in registry", () => {
    expect(() => resolveDashboardSymbol("NIFTY 50")).toThrow(
      /NIFTY Bank 15m Dashboard/,
    );
  });

  it("rejects invalid symbols", () => {
    expect(() => resolveDashboardSymbol("")).toThrow(/valid NSE symbol/);
    expect(() => resolveDashboardSymbol("BAD!")).toThrow(/Invalid symbol/);
  });

  it("defaults to PNB when input is omitted", () => {
    expect(resolveDashboardSymbol().id).toBe("pnb");
    expect(getDashboardSymbol().id).toBe("pnb");
  });
});
