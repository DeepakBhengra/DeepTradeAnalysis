import { describe, expect, it } from "vitest";

import type { OrderBookSnapshot } from "../types/orderBook";
import {
  EMPTY_ORDER_BOOK_TOUCH_REPORT,
  buildOrderBookTouchEvent,
  buildOrderBookTouchReportFilename,
  buildOrderBookTouchReportWorkbookXml,
  pricesTouch,
  reduceOrderBookTouchReport,
  stockTouchesHighestQty,
} from "./orderBookTouchReport";

const snapshot: OrderBookSnapshot = {
  symbol: "NSE:PNB",
  lastPrice: 147.74,
  buyQuantity: 18_482,
  sellQuantity: 26_63_647,
  bidOrders: 23,
  offerOrders: 22,
  bids: [
    { price: 147.71, orders: 4, quantity: 1194 },
    { price: 147.7, orders: 7, quantity: 4563 },
    { price: 147.69, orders: 4, quantity: 8336 },
    { price: 147.68, orders: 4, quantity: 1462 },
    { price: 147.67, orders: 4, quantity: 900 },
  ],
  offers: [
    { price: 147.74, orders: 3, quantity: 23 },
    { price: 147.75, orders: 12, quantity: 11210 },
    { price: 147.76, orders: 1, quantity: 12 },
    { price: 147.77, orders: 3, quantity: 472 },
    { price: 147.78, orders: 3, quantity: 100 },
  ],
  rows: [],
};

describe("orderBookTouchReport", () => {
  it("matches prices at paise precision", () => {
    expect(pricesTouch(147.75, 147.7500001)).toBe(true);
    expect(pricesTouch(147.75, 147.76)).toBe(false);
  });

  it("detects last price meeting the fattest of 5 bids or 5 offers", () => {
    expect(stockTouchesHighestQty(snapshot)).toEqual({ bid: false, offer: false });
    expect(
      stockTouchesHighestQty({ ...snapshot, lastPrice: 147.69 }),
    ).toEqual({ bid: true, offer: false });
    expect(
      stockTouchesHighestQty({ ...snapshot, lastPrice: 147.75 }),
    ).toEqual({ bid: false, offer: true });
    expect(
      stockTouchesHighestQty({
        ...snapshot,
        lastPrice: 147.69,
        offers: snapshot.offers.map((row, index) =>
          index === 1 ? { ...row, price: 147.69 } : row,
        ),
      }),
    ).toEqual({ bid: true, offer: true });
  });

  it("does not treat best bid/offer as a touch unless that level also has the highest qty", () => {
    expect(stockTouchesHighestQty({ ...snapshot, lastPrice: 147.71 })).toEqual({
      bid: false,
      offer: false,
    });
    expect(stockTouchesHighestQty({ ...snapshot, lastPrice: 147.74 })).toEqual({
      bid: false,
      offer: false,
    });
  });

  it("records timing, both fat levels, stock price, and totals", () => {
    const event = buildOrderBookTouchEvent(
      { ...snapshot, lastPrice: 147.69 },
      new Date("2026-11-27T07:16:41.000Z"),
    );
    expect(event).toMatchObject({
      recordedAtIst: "2026-11-27 12:46:41",
      stockPrice: 147.69,
      touched: "highest_bid",
      highestBidPrice: 147.69,
      highestBidQty: 8336,
      highestOfferPrice: 147.75,
      highestOfferQty: 11210,
      totalBidQty: 18_482,
      totalOfferQty: 26_63_647,
    });
  });

  it("logs one instance per episode, then a new row after the price leaves and returns", () => {
    let state = EMPTY_ORDER_BOOK_TOUCH_REPORT;
    const t0 = new Date("2026-11-27T07:16:41.000Z");
    state = reduceOrderBookTouchReport(state, snapshot, t0);
    expect(state.events).toHaveLength(0);

    const touching = { ...snapshot, lastPrice: 147.75 };
    state = reduceOrderBookTouchReport(state, touching, t0);
    state = reduceOrderBookTouchReport(
      state,
      touching,
      new Date("2026-11-27T07:16:42.000Z"),
    );
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.touched).toBe("highest_offer");

    state = reduceOrderBookTouchReport(
      state,
      snapshot,
      new Date("2026-11-27T07:16:43.000Z"),
    );
    expect(state.events).toHaveLength(1);

    state = reduceOrderBookTouchReport(
      state,
      touching,
      new Date("2026-11-27T07:16:44.000Z"),
    );
    expect(state.events).toHaveLength(2);
    expect(state.events[1]?.recordedAtIst).toBe("2026-11-27 12:46:44");
  });

  it("does not log again while last price stays on the same fat level even if qty changes", () => {
    let state = EMPTY_ORDER_BOOK_TOUCH_REPORT;
    const touching = { ...snapshot, lastPrice: 147.75 };
    state = reduceOrderBookTouchReport(
      state,
      touching,
      new Date("2026-11-27T07:16:41.000Z"),
    );
    state = reduceOrderBookTouchReport(
      state,
      {
        ...touching,
        sellQuantity: 2_700_000,
        offers: touching.offers.map((row, index) =>
          index === 1 ? { ...row, quantity: 12_000 } : row,
        ),
      },
      new Date("2026-11-27T07:16:42.000Z"),
    );
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.highestOfferQty).toBe(11210);
  });

  it("builds a downloadable workbook with the requested columns", () => {
    const event = buildOrderBookTouchEvent(
      { ...snapshot, lastPrice: 147.75 },
      new Date("2026-11-27T07:16:41.000Z"),
    );
    expect(event).not.toBeNull();
    const xml = buildOrderBookTouchReportWorkbookXml([event!]);
    expect(xml).toContain("ss:Name=\"Touches\"");
    expect(xml).toContain("Time IST");
    expect(xml).toContain("Highest BID");
    expect(xml).toContain("Highest OFFER");
    expect(xml).toContain("Stock price");
    expect(xml).toContain("Total BID qty");
    expect(xml).toContain("Total OFFER qty");
    expect(xml).toContain("2026-11-27 12:46:41");
    expect(xml).toContain(">147.75<");
    expect(xml).toContain(">11210<");
    expect(xml).toContain(">8336<");
    expect(xml).toContain(">18482<");
    expect(xml).toContain(">2663647<");
    expect(buildOrderBookTouchReportFilename([event!], tNow())).toBe(
      "order-book-touches_NSE-PNB_2026-11-27.xls",
    );
  });
});

function tNow(): Date {
  return new Date("2026-11-27T07:16:41.000Z");
}
