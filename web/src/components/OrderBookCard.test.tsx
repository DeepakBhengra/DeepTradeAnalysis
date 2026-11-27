import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderBookCard, OrderBookTable, OrderBookTouchReportTable } from "./OrderBookCard";
import type { OrderBookSnapshot, OrderBookTouchEvent } from "../types/orderBook";

vi.mock("../hooks/useLiveOrderBook", () => ({
  useLiveOrderBook: () => ({
    data: null,
    loading: false,
    error: null,
  }),
}));

vi.mock("./OrderBookRecordingChart", () => ({
  OrderBookRecordingChart: ({ samples }: { samples: unknown[] }) => (
    <div data-testid="order-book-graph">{samples.length} graph points</div>
  ),
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

let liveTrailSamples: unknown[] = [];
const downloadTouchReport = vi.fn();
let touchEvents: OrderBookTouchEvent[] = [];

vi.mock("../hooks/useOrderBookRecorder", () => ({
  useOrderBookRecorder: () => recorder,
}));

vi.mock("../hooks/useOrderBookLiveTrail", () => ({
  useOrderBookLiveTrail: () => liveTrailSamples,
}));

vi.mock("../hooks/useOrderBookTouchReport", () => ({
  useOrderBookTouchReport: () => ({
    events: touchEvents,
    download: downloadTouchReport,
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

  it("bolds the fattest of 5 bid qtys and the fattest of 5 offer qtys", () => {
    const depth: OrderBookSnapshot = {
      ...snapshot,
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
      rows: [
        {
          bid: { price: 147.71, orders: 4, quantity: 1194 },
          offer: { price: 147.74, orders: 3, quantity: 23 },
        },
        {
          bid: { price: 147.7, orders: 7, quantity: 4563 },
          offer: { price: 147.75, orders: 12, quantity: 11210 },
        },
        {
          bid: { price: 147.69, orders: 4, quantity: 8336 },
          offer: { price: 147.76, orders: 1, quantity: 12 },
        },
        {
          bid: { price: 147.68, orders: 4, quantity: 1462 },
          offer: { price: 147.77, orders: 3, quantity: 472 },
        },
        {
          bid: { price: 147.67, orders: 4, quantity: 900 },
          offer: { price: 147.78, orders: 3, quantity: 100 },
        },
      ],
    };

    render(<OrderBookTable snapshot={depth} />);

    expect(screen.getByText("8,336")).toHaveAttribute("data-highest-qty", "true");
    expect(screen.getByText("8,336")).toHaveClass("font-bold", "text-sm");
    expect(screen.getByText("11,210")).toHaveAttribute("data-highest-qty", "true");
    expect(screen.getByText("11,210")).toHaveClass("font-bold", "text-sm");
    expect(screen.getByText("4,563")).not.toHaveAttribute("data-highest-qty");
    expect(screen.getByText("472")).not.toHaveAttribute("data-highest-qty");
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
    liveTrailSamples = [];
    touchEvents = [];
    downloadTouchReport.mockClear();
  });

  it("exposes start, stop, time range, and download XLS", () => {
    render(<OrderBookCard symbol="PNB" />);

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(start).toHaveBeenCalled();

    expect(screen.getByRole("button", { name: "Stop recording" })).toBeDisabled();
    expect(screen.getByLabelText("Recording stopped")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Live window/i), {
      target: { value: "15m" },
    });
    expect(setRecordInterval).toHaveBeenCalledWith("15m");

    expect(screen.getByRole("button", { name: "Download XLS" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download touch report" })).toBeDisabled();
  });

  it("shows a recording-in-progress status while capturing", () => {
    recorder.recording = true;
    recorder.samples = [{}];
    liveTrailSamples = [{}];
    render(<OrderBookCard symbol="PNB" />);

    expect(screen.getByLabelText("Recording in progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop recording" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Start recording" })).toBeDisabled();
    expect(screen.getByText(/Recording/)).toBeInTheDocument();
    expect(screen.getByTestId("order-book-graph")).toHaveTextContent("1 graph points");
  });

  it("keeps generating the graph from the live trail after recording stops", () => {
    recorder.recording = false;
    recorder.samples = [];
    liveTrailSamples = [{}, {}, {}];
    render(<OrderBookCard symbol="PNB" />);

    expect(screen.getByLabelText("Recording stopped")).toBeInTheDocument();
    expect(screen.getByTestId("order-book-graph")).toHaveTextContent("3 graph points");
  });

  it("enables download of the stock-price touch report", () => {
    touchEvents = [
      {
        recordedAtIso: "2026-11-27T07:16:41.000Z",
        recordedAtIst: "2026-11-27 12:46:41",
        symbol: "NSE:PNB",
        stockPrice: 147.69,
        touched: "highest_bid",
        highestBidPrice: 147.69,
        highestBidQty: 8336,
        highestBidLevel: 3,
        highestOfferPrice: 147.75,
        highestOfferQty: 11210,
        highestOfferLevel: 2,
        totalBidQty: 18482,
        totalOfferQty: 2663647,
        totalBidOrders: 23,
        totalOfferOrders: 22,
      },
    ];
    render(<OrderBookCard symbol="PNB" />);

    expect(screen.getByText(/1 touch/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download touch report" }));
    expect(downloadTouchReport).toHaveBeenCalled();
  });
});

describe("OrderBookTouchReportTable", () => {
  it("lists timing, fat bid/offer, stock price, and totals", () => {
    render(
      <OrderBookTouchReportTable
        events={[
          {
            recordedAtIso: "2026-11-27T07:16:41.000Z",
            recordedAtIst: "2026-11-27 12:46:41",
            symbol: "NSE:PNB",
            stockPrice: 147.69,
            touched: "highest_bid",
            highestBidPrice: 147.69,
            highestBidQty: 8336,
            highestBidLevel: 3,
            highestOfferPrice: 147.75,
            highestOfferQty: 11210,
            highestOfferLevel: 2,
            totalBidQty: 18482,
            totalOfferQty: 2663647,
            totalBidOrders: 23,
            totalOfferOrders: 22,
          },
        ]}
      />,
    );

    expect(screen.getByText("2026-11-27 12:46:41")).toBeInTheDocument();
    expect(screen.getByText("Highest BID", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("147.69")).toBeInTheDocument();
    expect(screen.getByText(/147\.69 × 8,336/)).toBeInTheDocument();
    expect(screen.getByText(/147\.75 × 11,210/)).toBeInTheDocument();
    expect(screen.getByText("18,482")).toBeInTheDocument();
    expect(screen.getByText("26,63,647")).toBeInTheDocument();
  });
});
