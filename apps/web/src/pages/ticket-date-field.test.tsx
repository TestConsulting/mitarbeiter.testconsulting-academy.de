import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketDateField } from "./ticket-date-field.js";

afterEach(() => vi.useRealTimers());

describe("ticket date field", () => {
  it("displays day/month/year regardless of the browser locale", () => {
    render(<TicketDateField value="2026-10-29" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Fälligkeitsdatum" })).toHaveTextContent("29/10/2026");
  });

  it("stays empty by default", () => {
    render(<TicketDateField value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Fälligkeitsdatum" })).toHaveTextContent("TT/MM/JJJJ");
    expect(screen.queryByRole("button", { name: "Fälligkeitsdatum entfernen" })).not.toBeInTheDocument();
  });

  it("selects a date via month and year, preserves ISO values and allows clearing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<TicketDateField value="2026-10-29" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Fälligkeitsdatum" });
    await user.click(trigger);
    const calendar = within(screen.getByRole("dialog", { name: "Fälligkeitsdatum auswählen" }));
    await user.selectOptions(calendar.getByRole("combobox", { name: "Monat" }), "11");
    await user.click(calendar.getByRole("button", { name: "Donnerstag, 31. Dezember 2026" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-12-31");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    rerender(<TicketDateField value="2026-12-31" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Fälligkeitsdatum entfernen" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("marks today independently of the selected target, including when both coincide", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 5, 12));
    const { rerender } = render(<TicketDateField value="2026-11-04" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Fälligkeitsdatum" }));
    const today = screen.getByRole("button", { name: "Donnerstag, 5. November 2026" });
    const target = screen.getByRole("button", { name: "Mittwoch, 4. November 2026" });
    expect(today).toHaveAttribute("aria-current", "date");
    expect(today).toHaveClass("ticket-calendar__day--today");
    expect(today).not.toHaveClass("ticket-calendar__day--selected");
    expect(target).toHaveClass("ticket-calendar__day--selected");
    expect(target.closest("td")).toHaveAttribute("aria-selected", "true");
    rerender(<TicketDateField value="2026-11-05" onChange={vi.fn()} />);
    expect(today).toHaveClass("ticket-calendar__day--today", "ticket-calendar__day--selected");
  });

  it("supports keyboard navigation across months, leap days and Escape without changing the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TicketDateField value="2028-01-31" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Fälligkeitsdatum" });
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    const selected = screen.getByRole("button", { name: "Montag, 31. Januar 2028" });
    expect(selected).toHaveFocus();
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("button", { name: "Dienstag, 29. Februar 2028" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Mittwoch, 1. März 2028" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("button", { name: "Montag, 28. Februar 2028" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Sonntag, 5. März 2028" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("selects today using local calendar dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 5, 0, 1));
    const onChange = vi.fn();
    render(<TicketDateField value="2026-10-29" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Fälligkeitsdatum" }));
    fireEvent.click(screen.getByRole("button", { name: "Heute" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-05");
  });

  it("supports the full year range and reports invalid years without changing the ticket", () => {
    const onChange = vi.fn();
    render(<TicketDateField value="0001-01-01" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Fälligkeitsdatum" }));
    expect(screen.getByRole("button", { name: "Vorheriger Monat" })).toBeDisabled();
    const year = screen.getByRole("spinbutton", { name: "Jahr" });
    fireEvent.change(year, { target: { value: "10000" } });
    expect(screen.getByText("Jahr zwischen 1 und 9999 eingeben.")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(year, { target: { value: "9999" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Monat" }), { target: { value: "11" } });
    expect(screen.getByRole("button", { name: "Nächster Monat" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Freitag, 31. Dezember 9999" }));
    expect(onChange).toHaveBeenCalledWith("9999-12-31");
  });
});
