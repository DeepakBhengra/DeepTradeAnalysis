import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignalCard } from "../components/SignalCard";

describe("SignalCard", () => {
  it("renders BUY state", () => {
    render(
      <SignalCard decision="BUY" close={108.5} latestClosedAt="2026-06-17T10:15:00.000Z" />,
    );
    expect(screen.getByText("BUY")).toBeInTheDocument();
    expect(screen.getByText("108.50")).toBeInTheDocument();
  });

  it("renders SELL state", () => {
    render(<SignalCard decision="SELL" close={99.2} latestClosedAt={null} />);
    expect(screen.getByText("SELL")).toBeInTheDocument();
  });

  it("renders HOLD state", () => {
    render(<SignalCard decision="HOLD" close={null} latestClosedAt={null} />);
    expect(screen.getByText("HOLD")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
