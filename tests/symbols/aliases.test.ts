import { describe, expect, it } from "vitest";
import { applySymbolAlias, getSymbolAliasHint } from "../../src/symbols/aliases.js";

describe("symbol aliases", () => {
  it("maps SBI to SBIN", () => {
    expect(applySymbolAlias("SBI")).toBe("SBIN");
    expect(applySymbolAlias("sbi")).toBe("SBIN");
  });

  it("returns original symbol when no alias exists", () => {
    expect(applySymbolAlias("RELIANCE")).toBe("RELIANCE");
  });

  it("maps TATAMOTORS to TMPV", () => {
    expect(applySymbolAlias("TATAMOTORS")).toBe("TMPV");
    expect(getSymbolAliasHint("TATAMOTORS")).toBe("TMPV");
  });

  it("maps LTIM to LTM", () => {
    expect(applySymbolAlias("LTIM")).toBe("LTM");
    expect(getSymbolAliasHint("LTIM")).toBe("LTM");
  });
});
