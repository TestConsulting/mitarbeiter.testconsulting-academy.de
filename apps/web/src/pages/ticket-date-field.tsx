import { Button, Field, Input } from "@fluentui/react-components";
import { CalendarLtr16Regular, Dismiss16Regular } from "@fluentui/react-icons";

export function TicketDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const formattedDate = value ? value.split("-").reverse().join("/") : "";

  return (
    <Field label="Fälligkeitsdatum" hint="Optional. Format: TT/MM/JJJJ. Ohne Datum bleibt das Ticket ohne Termin.">
      {(controlProps) => (
        <div className="ticket-date-field">
          <div className="ticket-date-field__picker">
            <Input id={`${controlProps.id}-display`} aria-labelledby="" aria-describedby=""
              value={formattedDate} placeholder="TT/MM/JJJJ" readOnly tabIndex={-1} aria-hidden="true"
              contentAfter={<CalendarLtr16Regular aria-hidden="true" />} />
            <input {...controlProps} type="date" lang="de-DE" min="0001-01-01" max="9999-12-31"
              className="ticket-date-field__native" value={value}
              onClick={(event) => event.currentTarget.showPicker?.()}
              onChange={(event) => onChange(event.target.value)} />
          </div>
          {value && (
            <Button type="button" appearance="subtle" size="small" icon={<Dismiss16Regular />}
              aria-label="Fälligkeitsdatum entfernen" onClick={() => onChange("")} />
          )}
        </div>
      )}
    </Field>
  );
}
