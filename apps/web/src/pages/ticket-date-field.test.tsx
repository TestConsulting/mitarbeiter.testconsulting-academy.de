import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TicketDateField } from "./ticket-date-field.js";

describe("ticket date field", () => {
  it("displays day/month/year regardless of the browser locale", () => {
    render(<TicketDateField value="2026-10-29" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("29/10/2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Fälligkeitsdatum")).toHaveValue("2026-10-29");
  });

  it("stays empty by default", () => {
    render(<TicketDateField value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("TT/MM/JJJJ")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Fälligkeitsdatum entfernen" })).not.toBeInTheDocument();
  });

  it("preserves ISO values from the calendar and allows clearing", () => {
    const onChange = vi.fn();
    render(<TicketDateField value="2026-10-29" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Fälligkeitsdatum"), { target: { value: "2026-12-31" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-12-31");
    fireEvent.click(screen.getByRole("button", { name: "Fälligkeitsdatum entfernen" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
