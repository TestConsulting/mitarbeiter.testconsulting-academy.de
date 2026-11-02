import { Tooltip } from "@fluentui/react-components";
import { CalendarLtr16Regular, Clock16Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";

function localDateKey(date: Date): string {
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

export function TicketDueDate({ dueDate, showExactDate = false }: { dueDate: string | null; showExactDate?: boolean }) {
  const [today, setToday] = useState(() => localDateKey(new Date()));

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = setTimeout(() => setToday(localDateKey(new Date())), midnight.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [today]);

  if (!dueDate) return null;

  const [year, month, day] = dueDate.split("-");
  // Compare calendar days in UTC so local daylight-saving changes do not affect the count.
  const daysUntil = (Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  const overdue = daysUntil < 0;
  const overdueDays = Math.abs(daysUntil);
  const urgency = overdue ? "overdue" : daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : null;
  const fullDate = `${day}/${month}/${year}`;
  const label = overdue
    ? `${overdueDays} ${overdueDays === 1 ? "Tag" : "Tage"} überfällig`
    : daysUntil === 0 ? "Heute fällig"
      : daysUntil === 1 ? "Morgen"
        : daysUntil <= 7 ? `In ${daysUntil} Tagen` : `${day}.${month}.`;
  const description = `Fällig am ${fullDate}${overdue ? ` · seit ${overdueDays} ${overdueDays === 1 ? "Tag" : "Tagen"} überfällig` : ""}`;

  return (
    <Tooltip content={description} relationship="description">
      <span className={`ticket-due-date${urgency ? ` ticket-due-date--${urgency}` : ""}`} tabIndex={0} aria-label={description}>
        {overdue ? <Clock16Regular aria-hidden="true" /> : <CalendarLtr16Regular aria-hidden="true" />}
        <time dateTime={dueDate}>{showExactDate ? description : label}</time>
      </span>
    </Tooltip>
  );
}
