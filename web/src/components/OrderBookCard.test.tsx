import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const recorder = {
  interval: "5m" as const,
  setRecordInterval,
  recording: false,
  samples: [] as unknown[],
  error: null as string | null,
  start,
  stop,
  download,
};

vi.mock("../hooks/useOrderBookRecorder", () => ({
  useOrderBookRecorder: () => recorder,
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
  beforeEach(() => {
    start.mockClear();
    stop.mockClear();
    download.mockClear();
    setRecordInterval.mockClear();
    recorder.recording = false;
    recorder.samples = [];
    recorder.error = null;
    recorder.interval = "5m";
  });

  it("exposes start, stop, time range, and download XLS", () => {
    render(<OrderBookCard symbol="PNB" />);

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(start).toHaveBeenCalled();

    expect(screen.getByRole("button", { name: "Stop recording" })).toBeDisabled();
    expect(screen.getByLabelText("Recording stopped")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Time range/i), {
      target: { value: "15m" },
    });
    expect(setRecordInterval).toHaveBeenCalledWith("15m");

    expect(screen.getByRole("button", { name: "Download XLS" })).toBeDisabled();
  });

  it("shows a recording-in-progress status while capturing", () => {
    recorder.recording = true;
    recorder.samples = [{}];
    render(<OrderBookCard symbol="PNB" />);

    expect(screen.getByLabelText("Recording in progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop recording" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Start recording" })).toBeDisabled();
    expect(screen.getByText(/Recording/)).toBeInTheDocument();
  });
});
