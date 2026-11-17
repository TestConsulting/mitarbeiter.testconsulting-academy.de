import { Button, Input, Select } from "@fluentui/react-components";
import { Search20Regular } from "@fluentui/react-icons";
import type { TicketPriority } from "@portal/shared";

export type TasksBoardFilterScope = "all" | "mine" | "overdue";
export type TasksBoardPriorityFilter = "all" | TicketPriority;

const priorityOptions: { value: TasksBoardPriorityFilter; label: string }[] = [
  { value: "all", label: "Priorität: Alle" },
  { value: "urgent", label: "Dringend" },
  { value: "high", label: "Hoch" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Niedrig" },
];

export function TasksBoardFilters({
  query, onQueryChange, scope, onScopeChange, priority, onPriorityChange, overdueCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  scope: TasksBoardFilterScope;
  onScopeChange: (value: TasksBoardFilterScope) => void;
  priority: TasksBoardPriorityFilter;
  onPriorityChange: (value: TasksBoardPriorityFilter) => void;
  overdueCount: number;
}) {
  return (
    <section className="tasks-board-filters" aria-label="Tickets filtern">
      <Input
        className="board-search"
        aria-label="Tickets durchsuchen"
        placeholder="Tickets durchsuchen"
        contentBefore={<Search20Regular aria-hidden="true" />}
        value={query}
        onChange={(_event, data) => onQueryChange(data.value)}
      />
      <div className="tasks-board-filters__scopes" role="group" aria-label="Ticketauswahl">
        <Button className="tasks-board-filters__scope" aria-pressed={scope === "all"} onClick={() => onScopeChange("all")}>
          Alle Tickets
        </Button>
        <Button className="tasks-board-filters__scope" aria-pressed={scope === "mine"} onClick={() => onScopeChange("mine")}>
          Meine Tickets
        </Button>
        <Button className="tasks-board-filters__scope" aria-pressed={scope === "overdue"} onClick={() => onScopeChange("overdue")}>
          Überfällig <span className="tasks-board-filters__overdue-count">({overdueCount})</span>
        </Button>
      </div>
      <div className="tasks-board-filters__priority">
        <Select
          aria-label="Priorität"
          value={priority}
          onChange={(_event, data) => {
            const option = priorityOptions.find((item) => item.value === data.value);
            if (option) onPriorityChange(option.value);
          }}
        >
          {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </div>
    </section>
  );
}
