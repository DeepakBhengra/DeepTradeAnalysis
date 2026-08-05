import { describe, expect, it } from "vitest";

import {
  DEFAULT_SAMCO_RULE_VARIANT,
  isSamcoRuleVariant,
  parseSamcoRuleVariant,
  strategiesForSamcoRuleVariant,
} from "../../src/samco/samcoRuleVariant.js";

describe("samcoRuleVariant", () => {
  it("defaults to Deepak + Deepak-2", () => {
    expect(DEFAULT_SAMCO_RULE_VARIANT).toBe("deepak+deepak2");
    expect(parseSamcoRuleVariant(undefined)).toBe("deepak+deepak2");
    expect(parseSamcoRuleVariant("nope")).toBe("deepak+deepak2");
  });

  it("recognizes supported variants", () => {
    expect(isSamcoRuleVariant("deeppro1")).toBe(true);
    expect(isSamcoRuleVariant("rulePnb")).toBe(false);
  });

  it("maps variants to strategies", () => {
    expect(strategiesForSamcoRuleVariant("deepak+deepak2")).toEqual([
      "deepak",
      "deepak2",
    ]);
    expect(strategiesForSamcoRuleVariant("deeppro1")).toEqual(["deeppro1"]);
    expect(strategiesForSamcoRuleVariant("watchParty")).toEqual(["watchParty"]);
  });
});
