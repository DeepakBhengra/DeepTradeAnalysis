import { describe, expect, it } from "vitest";

import type { PortfolioState } from "../types/paperTrading";
import { INITIAL_CASH } from "../types/paperTrading";
import {
  computePnL,
  computeRequiredCapital,
  createInitialPortfolio,
  getPositionSide,
  placeOrder,
  processPendingOrders,
  updatePosition,
  validateOrderCapital,
} from "./paperTrading";

describe("updatePosition", () => {
  it("opens a long from flat", () => {
    expect(updatePosition({ quantity: 0, avgPrice: 0 }, 10, 100)).toEqual({
      quantity: 10,
      avgPrice: 100,
    });
  });

  it("keeps avg price when partially closing a long", () => {
    expect(updatePosition({ quantity: 10, avgPrice: 100 }, -5, 110)).toEqual({
      quantity: 5,
      avgPrice: 100,
    });
  });

  it("averages when adding to a long", () => {
    expect(updatePosition({ quantity: 10, avgPrice: 100 }, 10, 120)).toEqual({
      quantity: 20,
      avgPrice: 110,
    });
  });

  it("flips long to short at fill price", () => {
    expect(updatePosition({ quantity: 10, avgPrice: 100 }, -15, 95)).toEqual({
      quantity: -5,
      avgPrice: 95,
    });
  });
});

describe("placeOrder", () => {
  it("fills market buy and reduces cash", () => {
    const portfolio = createInitialPortfolio();
    const result = placeOrder(
      portfolio,
      { side: "BUY", orderType: "MARKET", quantity: 10 },
      100,
      0,
    );

    expect(result.success).toBe(true);
    expect(result.portfolio.cash).toBe(INITIAL_CASH - 1000);
    expect(result.portfolio.position).toEqual({ quantity: 10, avgPrice: 100 });
    expect(result.portfolio.fills).toHaveLength(1);
  });

  it("rejects market buy with insufficient cash", () => {
    const portfolio = createInitialPortfolio();
    const result = placeOrder(
      portfolio,
      { side: "BUY", orderType: "MARKET", quantity: 20_000 },
      100,
      0,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient funds");
  });

  it("rejects limit buy with insufficient cash", () => {
    const portfolio = createInitialPortfolio();
    const result = placeOrder(
      portfolio,
      { side: "BUY", orderType: "LIMIT", quantity: 2000, price: 1307 },
      100,
      0,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient funds");
  });

  it("opens short via market sell", () => {
    const portfolio = createInitialPortfolio();
    const result = placeOrder(
      portfolio,
      { side: "SELL", orderType: "MARKET", quantity: 5 },
      200,
      1,
    );

    expect(result.success).toBe(true);
    expect(result.portfolio.position).toEqual({ quantity: -5, avgPrice: 200 });
    expect(result.portfolio.cash).toBe(INITIAL_CASH + 1000);
  });

  it("queues limit orders instead of filling immediately", () => {
    const portfolio = createInitialPortfolio();
    const result = placeOrder(
      portfolio,
      { side: "BUY", orderType: "LIMIT", quantity: 10, price: 90 },
      100,
      2,
    );

    expect(result.success).toBe(true);
    expect(result.portfolio.pendingOrders).toHaveLength(1);
    expect(result.portfolio.position.quantity).toBe(0);
  });
});

describe("processPendingOrders", () => {
  it("fills limit buy when candle low crosses limit", () => {
    let portfolio: PortfolioState = createInitialPortfolio();
    const placed = placeOrder(
      portfolio,
      { side: "BUY", orderType: "LIMIT", quantity: 10, price: 95 },
      100,
      0,
    );
    portfolio = placed.portfolio;

    portfolio = processPendingOrders(
      portfolio,
      { open: 100, high: 101, low: 94, close: 99 },
      1,
    );

    expect(portfolio.pendingOrders).toHaveLength(0);
    expect(portfolio.position).toEqual({ quantity: 10, avgPrice: 95 });
  });

  it("fills sl sell when candle low crosses stop", () => {
    let portfolio: PortfolioState = createInitialPortfolio();
    portfolio = placeOrder(
      portfolio,
      { side: "BUY", orderType: "MARKET", quantity: 10 },
      100,
      0,
    ).portfolio;

    portfolio = placeOrder(
      portfolio,
      { side: "SELL", orderType: "SL", quantity: 10, price: 95 },
      100,
      0,
    ).portfolio;

    portfolio = processPendingOrders(
      portfolio,
      { open: 100, high: 100, low: 94, close: 96 },
      2,
    );

    expect(portfolio.pendingOrders).toHaveLength(0);
    expect(portfolio.position.quantity).toBe(0);
  });
});

describe("computePnL", () => {
  it("computes unrealized profit on a long", () => {
    const portfolio = placeOrder(
      createInitialPortfolio(),
      { side: "BUY", orderType: "MARKET", quantity: 10 },
      100,
      0,
    ).portfolio;

    const pnl = computePnL(portfolio, 110);
    expect(pnl.unrealizedPnL).toBe(100);
    expect(pnl.totalPnL).toBe(100);
    expect(pnl.realizedPnL).toBe(0);
  });

  it("computes profit after closing a long", () => {
    let portfolio = placeOrder(
      createInitialPortfolio(),
      { side: "BUY", orderType: "MARKET", quantity: 10 },
      100,
      0,
    ).portfolio;

    portfolio = placeOrder(
      portfolio,
      { side: "SELL", orderType: "MARKET", quantity: 10 },
      110,
      1,
    ).portfolio;

    const pnl = computePnL(portfolio, 110);
    expect(pnl.unrealizedPnL).toBe(0);
    expect(pnl.realizedPnL).toBe(100);
    expect(pnl.totalPnL).toBe(100);
  });
});

describe("getPositionSide", () => {
  it("reports long, short, and flat", () => {
    expect(getPositionSide(5)).toBe("Long");
    expect(getPositionSide(-3)).toBe("Short");
    expect(getPositionSide(0)).toBe("Flat");
  });
});

describe("computeRequiredCapital", () => {
  it("computes buy market capital from current price", () => {
    expect(
      computeRequiredCapital(
        { side: "BUY", orderType: "MARKET", quantity: 10 },
        100,
      ),
    ).toBe(1000);
  });

  it("returns null for sell orders", () => {
    expect(
      computeRequiredCapital(
        { side: "SELL", orderType: "MARKET", quantity: 10 },
        100,
      ),
    ).toBeNull();
  });
});

describe("validateOrderCapital", () => {
  it("returns an error when required capital exceeds cash", () => {
    expect(
      validateOrderCapital(
        { side: "BUY", orderType: "LIMIT", quantity: 2000, price: 1307 },
        100,
        INITIAL_CASH,
      ),
    ).toContain("Insufficient funds");
  });
});

describe("short cover flow", () => {
  it("covers a short with market buy", () => {
    let portfolio = placeOrder(
      createInitialPortfolio(),
      { side: "SELL", orderType: "MARKET", quantity: 10 },
      100,
      0,
    ).portfolio;

    portfolio = placeOrder(
      portfolio,
      { side: "BUY", orderType: "MARKET", quantity: 10 },
      90,
      1,
    ).portfolio;

    expect(portfolio.position.quantity).toBe(0);
    const pnl = computePnL(portfolio, 90);
    expect(pnl.totalPnL).toBe(100);
  });
});
