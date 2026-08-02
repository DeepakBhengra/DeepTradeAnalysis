import { describe, expect, it } from "vitest";

import {
  isDayScanRuleVariant,
  isPostMortemRuleVariant,
} from "./ruleVariant";

describe("ruleVariant helpers", () => {
  it("accepts known day-scan variants", () => {
    expect(isDayScanRuleVariant("deepak")).toBe(true);
    expect(isDayScanRuleVariant("deepak2")).toBe(true);
    expect(isDayScanRuleVariant("deepak3")).toBe(true);
    expect(isDayScanRuleVariant("watchParty")).toBe(true);
    expect(isDayScanRuleVariant("other")).toBe(false);
  });

  it("accepts known post-mortem variants", () => {
    expect(isPostMortemRuleVariant("deepak")).toBe(true);
    expect(isPostMortemRuleVariant("deepak2")).toBe(true);
    expect(isPostMortemRuleVariant("deepak3")).toBe(false);
    expect(isPostMortemRuleVariant("watchParty")).toBe(false);
  });
});
