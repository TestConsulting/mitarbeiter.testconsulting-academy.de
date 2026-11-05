import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, Field, Input, Popover, PopoverSurface, PopoverTrigger, Select } from "@fluentui/react-components";
import { CalendarLtr16Regular, ChevronLeft16Regular, ChevronRight16Regular, Dismiss16Regular } from "@fluentui/react-icons";
import { localDateKey } from "./ticket-due-date.js";

const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Date(2026, month, 1).toLocaleDateString("de-DE", { month: "long" }));
const dateLabel = new Intl.DateTimeFormat("de-DE", { dateStyle: "full" });
const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function TicketDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState("");
  const [activeDate, setActiveDate] = useState("");
  const gridRef = useRef<HTMLTableElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const parsedYear = Number(year);
  const validYear = /^\d{1,4}$/.test(year) && parsedYear >= 1 && parsedYear <= 9999;
  const today = localDateKey(new Date());
  const firstDay = calendarDate(validYear ? parsedYear : 2000, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) =>
    calendarDate(firstDay.getFullYear(), month, index - offset + 1));
  const focusDate = days.some((day) => localDateKey(day) === activeDate)
    ? activeDate : localDateKey(firstDay);

  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${activeDate}"]`)?.focus();
  }, [open, activeDate]);

  function showDate(date: Date) {
    setMonth(date.getMonth());
    setYear(String(date.getFullYear()));
    setActiveDate(localDateKey(date));
  }

  function changeOpen(nextOpen: boolean) {
    if (nextOpen) showDate(value ? new Date(`${value}T12:00:00`) : new Date());
    setOpen(nextOpen);
  }

  function selectDate(date: Date) {
    onChange(localDateKey(date));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function moveMonth(amount: number) {
    const date = calendarDate(parsedYear, month + amount, 1);
    if (date.getFullYear() >= 1 && date.getFullYear() <= 9999) showDate(date);
  }

  function navigateDay(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    const next = new Date(date);
    const weekday = (date.getDay() + 6) % 7;
    switch (event.key) {
      case "ArrowLeft": next.setDate(date.getDate() - 1); break;
      case "ArrowRight": next.setDate(date.getDate() + 1); break;
      case "ArrowUp": next.setDate(date.getDate() - 7); break;
      case "ArrowDown": next.setDate(date.getDate() + 7); break;
      case "Home": next.setDate(date.getDate() - weekday); break;
      case "End": next.setDate(date.getDate() + 6 - weekday); break;
      case "PageUp":
      case "PageDown": {
        const monthStart = calendarDate(date.getFullYear(), date.getMonth() + (event.key === "PageUp" ? -1 : 1), 1);
        const lastDay = calendarDate(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        next.setFullYear(monthStart.getFullYear(), monthStart.getMonth(), Math.min(date.getDate(), lastDay));
        break;
      }
      default: return;
    }
    event.preventDefault();
    if (next.getFullYear() >= 1 && next.getFullYear() <= 9999) showDate(next);
  }

  return (
    <Field label="Fälligkeitsdatum" hint="Optional. Format: TT/MM/JJJJ. Ohne Datum bleibt das Ticket ohne Termin.">
      {(controlProps) => (
        <div className="ticket-date-field">
          <Popover open={open} onOpenChange={(_event, data) => changeOpen(data.open)}
            positioning={{ position: "below", align: "start" }} trapFocus>
            <PopoverTrigger disableButtonEnhancement>
              <Button {...controlProps} ref={triggerRef} type="button" className="ticket-date-field__trigger"
                aria-haspopup="dialog" aria-expanded={open}>
                <span className={value ? undefined : "ticket-date-field__placeholder"}>
                  {value ? value.split("-").reverse().join("/") : "TT/MM/JJJJ"}
                </span>
                <CalendarLtr16Regular aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverSurface className="ticket-calendar" role="dialog" aria-label="Fälligkeitsdatum auswählen">
              <div className="ticket-calendar__navigation">
                <Button type="button" appearance="subtle" size="small" icon={<ChevronLeft16Regular />}
                  aria-label="Vorheriger Monat" disabled={!validYear || (parsedYear === 1 && month === 0)}
                  onClick={() => moveMonth(-1)} />
                <Field label="Monat">
                  <Select value={String(month)} onChange={(_event, data) => setMonth(Number(data.value))}>
                    {monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
                  </Select>
                </Field>
                <Field label="Jahr" validationState={validYear ? "none" : "error"}
                  validationMessage={validYear ? undefined : "Jahr zwischen 1 und 9999 eingeben."}>
                  <Input type="number" min={1} max={9999} step={1} value={year}
                    onChange={(_event, data) => setYear(data.value)} />
                </Field>
                <Button type="button" appearance="subtle" size="small" icon={<ChevronRight16Regular />}
                  aria-label="Nächster Monat" disabled={!validYear || (parsedYear === 9999 && month === 11)}
                  onClick={() => moveMonth(1)} />
              </div>
              {validYear && <table ref={gridRef} className="ticket-calendar__grid" role="grid"
                aria-label={`${monthNames[month]} ${year}`}>
                <thead><tr>{weekdays.map((day) => <th key={day} scope="col">{day}</th>)}</tr></thead>
                <tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>
                  {days.slice(week * 7, week * 7 + 7).map((date) => {
                    const key = localDateKey(date);
                    const isToday = key === today;
                    const isSelected = key === value;
                    const inRange = date.getFullYear() >= 1 && date.getFullYear() <= 9999;
                    return <td key={key} role="gridcell" aria-selected={isSelected}>
                      <button type="button" data-date={key}
                        className={[
                          "ticket-calendar__day",
                          date.getMonth() !== month ? "ticket-calendar__day--outside" : "",
                          isToday ? "ticket-calendar__day--today" : "",
                          isSelected ? "ticket-calendar__day--selected" : "",
                        ].filter(Boolean).join(" ")}
                        aria-label={dateLabel.format(date)} aria-current={isToday ? "date" : undefined}
                        tabIndex={key === focusDate ? 0 : -1} disabled={!inRange}
                        onKeyDown={(event) => navigateDay(event, date)} onClick={() => selectDate(date)}>
                        {date.getDate()}
                      </button>
                    </td>;
                  })}
                </tr>)}</tbody>
              </table>}
              <div className="ticket-calendar__footer">
                <Button type="button" appearance="subtle" onClick={() => selectDate(new Date())}>Heute</Button>
                <Button type="button" appearance="subtle" onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}>Schließen</Button>
              </div>
            </PopoverSurface>
          </Popover>
          {value && (
            <Button type="button" appearance="subtle" size="small" icon={<Dismiss16Regular />}
              aria-label="Fälligkeitsdatum entfernen" onClick={() => onChange("")} />
          )}
        </div>
      )}
    </Field>
  );
}
