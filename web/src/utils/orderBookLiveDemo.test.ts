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

  it("makes last price touch the fat bid, then the fat offer, on a 10-tick cycle", () => {
    const touchBid = buildDemoOrderBookSnapshot("PNB", 10);
    expect(touchBid.lastPrice).toBe(highestQuantityBid(touchBid)?.price);

    const mid = buildDemoOrderBookSnapshot("PNB", 3);
    expect(mid.lastPrice).not.toBe(highestQuantityBid(mid)?.price);
    expect(mid.lastPrice).not.toBe(highestQuantityOffer(mid)?.price);

    const touchOffer = buildDemoOrderBookSnapshot("PNB", 5);
    expect(touchOffer.lastPrice).toBe(highestQuantityOffer(touchOffer)?.price);
  });
});
