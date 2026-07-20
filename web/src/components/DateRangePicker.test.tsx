import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateRangePicker } from "./DateRangePicker";

describe("DateRangePicker", () => {
  it("disables run when from date is after to date", () => {
    render(
      <DateRangePicker
        fromDate="2026-06-20"
        toDate="2026-06-19"
        onFromChange={() => undefined}
        onToChange={() => undefined}
        onRun={() => undefined}
        loading={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Run Backtest" })).toBeDisabled();
    expect(screen.getByText(/From date must be on or before to date/)).toBeTruthy();
  });

  it("calls onRun when button is clicked", () => {
    const onRun = vi.fn();

    render(
      <DateRangePicker
        fromDate="2026-05-01"
        toDate="2026-06-19"
        onFromChange={() => undefined}
        onToChange={() => undefined}
        onRun={onRun}
        loading={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run Backtest" }));

    expect(onRun).toHaveBeenCalledOnce();
  });
});
