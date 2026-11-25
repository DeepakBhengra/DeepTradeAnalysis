import { describe, expect, it } from "vitest";

import { highestQuantityBid, highestQuantityOffer } from "./orderBookGraph";
import { buildDemoOrderBookSnapshot } from "./orderBookLiveDemo";

describe("orderBookLiveDemo", () => {
  it("puts the fattest qty on a deeper of the 5 levels, not best bid/offer", () => {
    const snapshot = buildDemoOrderBookSnapshot("PNB", 3);
    expect(highestQuantityBid(snapshot)?.level).toBe(2);
    expect(highestQuantityOffer(snapshot)?.level).toBe(3);
    expect(snapshot.lastPrice).toBe(147.93);
  });
});
