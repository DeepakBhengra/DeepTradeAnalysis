import { describe, expect, it } from "vitest";

import {
  brokerageCharges,
  netRealizedPnLAfterBrokerageCharges,
} from "./brokerageCharges";

describe("brokerageCharges", () => {
  it("matches screenshot example: 500→512 × 1000 → net 11773.32", () => {
    const result = brokerageCharges({
      buyPrice: 500,
      sellPrice: 512,
      quantity: 1000,
    });

    expect(result.grossProfit).toBe(12000);
    expect(result.brokerage).toBe(40);
    expect(result.stt).toBe(128);
    expect(result.stampDuty).toBe(15);
    expect(result.totalCharges).toBe(226.68);
    expect(result.netProfit).toBe(11773.32);
  });

  it("matches screenshot example: 400→490 × 1000 → net 89785.72", () => {
    const result = brokerageCharges({
      buyPrice: 400,
      sellPrice: 490,
      quantity: 1000,
    });

    expect(result.grossProfit).toBe(90000);
    expect(result.brokerage).toBe(40);
    expect(result.stt).toBe(123);
    expect(result.stampDuty).toBe(12);
    expect(result.totalCharges).toBe(214.28);
    expect(result.netProfit).toBe(89785.72);
  });

  it("caps brokerage at ₹20 per order for large notionals", () => {
    const result = brokerageCharges({
      buyPrice: 500,
      sellPrice: 512,
      quantity: 1000,
    });
    expect(result.brokerage).toBe(40);
  });

  it("uses 0.03% brokerage when that is below ₹20 per side", () => {
    // Buy 10_000 → ₹3; sell 11_000 → ₹3.30
    const result = brokerageCharges({
      buyPrice: 100,
      sellPrice: 110,
      quantity: 100,
    });
    expect(result.brokerage).toBe(6.3);
  });
});

describe("netRealizedPnLAfterBrokerageCharges", () => {
  it("treats long as buy entry / sell exit", () => {
    expect(
      netRealizedPnLAfterBrokerageCharges("BUY", 500, 512, 1000),
    ).toBe(11773.32);
  });

  it("treats short as sell entry / buy cover", () => {
    const longNet = netRealizedPnLAfterBrokerageCharges("BUY", 500, 512, 1000);
    const shortNet = netRealizedPnLAfterBrokerageCharges("SELL", 512, 500, 1000);
    // Same prices swapped: short that sells 512 and covers 500 matches the long path.
    expect(shortNet).toBe(longNet);
  });

  it("short loss when cover is above entry", () => {
    const net = netRealizedPnLAfterBrokerageCharges("SELL", 500, 512, 1000);
    expect(net).toBeLessThan(0);
    expect(net).toBe(
      brokerageCharges({ buyPrice: 512, sellPrice: 500, quantity: 1000 }).netProfit,
    );
  });
});
