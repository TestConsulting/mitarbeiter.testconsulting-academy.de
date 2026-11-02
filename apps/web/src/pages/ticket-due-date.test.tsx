import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketDueDate } from "./ticket-due-date.js";

afterEach(() => vi.useRealTimers());

describe("ticket due date", () => {
  it("renders no date when no due date is set", () => {
    const { container } = render(<TicketDueDate dueDate={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["2030-11-02", "3 Tage überfällig", "overdue"],
    ["2030-11-04", "1 Tag überfällig", "overdue"],
    ["2030-11-05", "Heute fällig", "today"],
    ["2030-11-06", "Morgen", "tomorrow"],
    ["2030-11-07", "In 2 Tagen", null],
    ["2030-11-12", "In 7 Tagen", null],
    ["2030-11-13", "13.11.", null],
    ["2031-01-01", "01.01.", null],
  ] as const)("formats %s as %s with the correct urgency", (dueDate, label, urgency) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 10, 5, 23, 30));
    render(<TicketDueDate dueDate={dueDate} />);
    const time = screen.getByText(label);
    expect(time).toHaveAttribute("datetime", dueDate);
    expect(time.parentElement).toHaveAttribute("tabindex", "0");
    const [year, month, day] = dueDate.split("-");
    expect(time.parentElement?.getAttribute("aria-label")).toContain(`Fällig am ${day}/${month}/${year}`);
    expect(time.parentElement?.className).toBe(`ticket-due-date${urgency ? ` ticket-due-date--${urgency}` : ""}`);
    expect(time.parentElement?.querySelector("svg")).toBeInTheDocument();
  });

  it.each(["hover", "focus"])("shows the full date and overdue duration on %s", (interaction) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 29, 12));
    render(<TicketDueDate dueDate="2026-10-26" />);
    const date = screen.getByLabelText("Fällig am 26/10/2026 · seit 3 Tagen überfällig");
    if (interaction === "hover") fireEvent.pointerEnter(date);
    else fireEvent.focus(date);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Fällig am 26/10/2026 · seit 3 Tagen überfällig");
  });

  it("shows the exact date and singular overdue duration in ticket details", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 29, 12));
    render(<TicketDueDate dueDate="2026-10-28" showExactDate />);
    expect(screen.getByText("Fällig am 28/10/2026 · seit 1 Tag überfällig", { selector: "time" })).toBeInTheDocument();
  });

  it("counts calendar days across a daylight-saving transition", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 23, 30));
    render(<TicketDueDate dueDate="2026-10-26" />);
    expect(screen.getByText("In 2 Tagen")).toBeInTheDocument();
  });

  it("counts leap days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2028, 1, 28, 12));
    render(<TicketDueDate dueDate="2028-03-01" />);
    expect(screen.getByText("In 2 Tagen")).toBeInTheDocument();
  });

  it("updates overdue status at local midnight without a reload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 11, 31, 23, 59, 59));
    render(<TicketDueDate dueDate="2030-12-31" />);
    expect(screen.getByText("Heute fällig").parentElement).not.toHaveClass("ticket-due-date--overdue");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("1 Tag überfällig").parentElement).toHaveClass("ticket-due-date--overdue");
  });
});
