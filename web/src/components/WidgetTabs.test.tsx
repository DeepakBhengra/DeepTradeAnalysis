import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WidgetTabs } from "./WidgetTabs";

describe("WidgetTabs", () => {
  it("highlights the active tab with orange underline styling", () => {
    render(<WidgetTabs active="stockDashboard" onChange={() => undefined} />);

    const stockTab = screen.getByRole("button", { name: "Stock 15m Dashboard" });
    const backtestTab = screen.getByRole("button", { name: "Deepak Backtest" });

    expect(stockTab.className).toContain("border-kite-orange");
    expect(backtestTab.className).toContain("border-transparent");
  });

  it("renders Stock 15m dashboard tab and calls onChange", () => {
    const onChange = vi.fn();

    render(<WidgetTabs active="deepakBacktest" onChange={onChange} />);

    const stockTab = screen.getByRole("button", {
      name: "Stock 15m Dashboard",
    });

    expect(stockTab).toBeTruthy();

    fireEvent.click(stockTab);

    expect(onChange).toHaveBeenCalledWith("stockDashboard");
  });

  it("renders Deepak Backtest tab and calls onChange", () => {
    const onChange = vi.fn();

    render(<WidgetTabs active="stockDashboard" onChange={onChange} />);

    const backtestTab = screen.getByRole("button", { name: "Deepak Backtest" });

    expect(backtestTab).toBeTruthy();

    fireEvent.click(backtestTab);

    expect(onChange).toHaveBeenCalledWith("deepakBacktest");
  });

  it("renders Deepak Day Scan tab and calls onChange", () => {
    const onChange = vi.fn();

    render(<WidgetTabs active="stockDashboard" onChange={onChange} />);

    const dayScanTab = screen.getByRole("button", { name: "Deepak Day Scan" });

    expect(dayScanTab).toBeTruthy();

    fireEvent.click(dayScanTab);

    expect(onChange).toHaveBeenCalledWith("deepakDayScan");
  });

  it("renders Day Scan Post-Mortem tab and calls onChange", () => {
    const onChange = vi.fn();

    render(<WidgetTabs active="stockDashboard" onChange={onChange} />);

    const tab = screen.getByRole("button", { name: "Day Scan Post-Mortem" });

    expect(tab).toBeTruthy();

    fireEvent.click(tab);

    expect(onChange).toHaveBeenCalledWith("dayScanPostMortem");
  });

  it("renders Day Scan Simulator tab and calls onChange", () => {
    const onChange = vi.fn();

    render(<WidgetTabs active="stockDashboard" onChange={onChange} />);

    const simulatorTab = screen.getByRole("button", { name: "Day Scan Simulator" });

    expect(simulatorTab).toBeTruthy();

    fireEvent.click(simulatorTab);

    expect(onChange).toHaveBeenCalledWith("dayScanSimulator");
  });

  it("renders Day Order Simulator tab and calls onChange", () => {
    const onChange = vi.fn();

    render(<WidgetTabs active="stockDashboard" onChange={onChange} />);

    const orderTab = screen.getByRole("button", { name: "Day Order Simulator" });

    expect(orderTab).toBeTruthy();

    fireEvent.click(orderTab);

    expect(onChange).toHaveBeenCalledWith("dayOrderSimulator");
  });

  it("renders Samco Trading tab and calls onChange", () => {
    const onChange = vi.fn();

    render(<WidgetTabs active="stockDashboard" onChange={onChange} />);

    const samcoTab = screen.getByRole("button", { name: "Samco Trading" });

    expect(samcoTab).toBeTruthy();

    fireEvent.click(samcoTab);

    expect(onChange).toHaveBeenCalledWith("samcoTrading");
  });

  it("does not render removed dashboard tabs", () => {
    render(<WidgetTabs active="stockDashboard" onChange={() => undefined} />);

    expect(screen.queryByRole("button", { name: "PNB 15m Dashboard" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "NIFTY Bank 15m Dashboard" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Order Simulator" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Stock 15m Simulator" })).toBeNull();
  });
});
