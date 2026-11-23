import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrderBookCard, OrderBookTable } from "./OrderBookCard";
import type { OrderBookSnapshot } from "../types/orderBook";

vi.mock("../hooks/useLiveOrderBook", () => ({
  useLiveOrderBook: () => ({
    data: null,
    loading: false,
    error: null,
  }),
}));

const start = vi.fn();
const stop = vi.fn();
const download = vi.fn();
const setRecordInterval = vi.fn();

vi.mock("../hooks/useOrderBookRecorder", () => ({
  useOrderBookRecorder: () => ({
    interval: "5m",
    setRecordInterval,
    recording: false,
    samples: [],
    error: null,
    start,
    stop,
    download,
  }),
}));

const snapshot: OrderBookSnapshot = {
  symbol: "NSE:PNB",
  lastPrice: 150.95,
  buyQuantity: 2013775,
  sellQuantity: 2676374,
  bidOrders: 11,
  offerOrders: 18,
  bids: [{ price: 150.92, orders: 1, quantity: 474 }],
  offers: [{ price: 150.95, orders: 2, quantity: 295 }],
  rows: [
    {
      bid: { price: 150.92, orders: 1, quantity: 474 },
      offer: { price: 150.95, orders: 2, quantity: 295 },
    },
  ],
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
});

describe("OrderBookCard recording controls", () => {
  it("exposes start, stop, interval, and download XLS", () => {
    render(<OrderBookCard symbol="PNB" />);

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(start).toHaveBeenCalled();

    expect(screen.getByRole("button", { name: "Stop recording" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Record interval/i), {
      target: { value: "15m" },
    });
    expect(setRecordInterval).toHaveBeenCalledWith("15m");

    expect(screen.getByRole("button", { name: "Download XLS" })).toBeDisabled();
  });
});
