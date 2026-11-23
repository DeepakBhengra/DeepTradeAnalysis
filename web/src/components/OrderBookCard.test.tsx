import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderBookTable } from "./OrderBookCard";
import type { OrderBookSnapshot } from "../types/orderBook";

const snapshot: OrderBookSnapshot = {
  symbol: "NSE:PNB",
  lastPrice: 150.95,
  buyQuantity: 2013775,
  sellQuantity: 2676374,
  bidOrders: 11,
  offerOrders: 18,
  liveLevelCount: 20,
  requestedLevels: 20,
  bids: [{ price: 150.92, orders: 1, quantity: 474 }],
  offers: [{ price: 150.95, orders: 2, quantity: 295 }],
  rows: Array.from({ length: 20 }, (_, index) => ({
    bid: {
      price: Number((150.92 - index * 0.01).toFixed(2)),
      orders: 1,
      quantity: 474 + index,
    },
    offer: {
      price: Number((150.95 + index * 0.01).toFixed(2)),
      orders: 2,
      quantity: 295 + index,
    },
  })),
};

describe("OrderBookTable", () => {
  it("renders paired bid/offer columns like the Kite depth panel", () => {
    render(<OrderBookTable snapshot={snapshot} />);

    expect(screen.getByText("Bid")).toBeInTheDocument();
    expect(screen.getByText("Offer")).toBeInTheDocument();
    expect(screen.getByText("150.92")).toBeInTheDocument();
    expect(screen.getByText("150.95")).toBeInTheDocument();
    expect(screen.getByText("474")).toBeInTheDocument();
    expect(screen.getByText("295")).toBeInTheDocument();
    expect(screen.getByText("20,13,775")).toBeInTheDocument();
    expect(screen.getByText("26,76,374")).toBeInTheDocument();
  });

  it("renders 20 bid/offer rows", () => {
    render(<OrderBookTable snapshot={snapshot} />);
    expect(screen.getByText("150.73")).toBeInTheDocument();
    expect(screen.getByText("151.14")).toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr")).toHaveLength(21);
  });
});
