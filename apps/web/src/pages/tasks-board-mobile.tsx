import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Input } from "@fluentui/react-components";
import { Add20Regular, CheckmarkCircle24Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import type { BoardColumn, PortalUser, Ticket } from "@portal/shared";

export type MobileKanbanBoardProps = {
  columns: BoardColumn[];
  ticketsByColumn: Map<string, Ticket[]>;
  usersById: Map<string, PortalUser>;
  filterQuery: string;
  setFilterQuery: (value: string) => void;
  canManageColumns: boolean;
  onAddColumn: () => void;
  onEditTicket: (ticket: Ticket) => void;
  onAddTicket: (columnId: string) => void;
  onMoveTicket: (ticketId: string, columnId: string, position: number) => Promise<void> | void;
};

export function MobileKanbanBoard({
  columns,
  ticketsByColumn,
  usersById,
  filterQuery,
  setFilterQuery,
  canManageColumns,
  onAddColumn,
  onEditTicket,
  onAddTicket,
  onMoveTicket,
}: MobileKanbanBoardProps) {
  const [selectedColumnId, setSelectedColumnId] = useState(columns[0]?.id ?? "");

  useEffect(() => {
    if (!columns.some((column) => column.id === selectedColumnId)) {
      setSelectedColumnId(columns[0]?.id ?? "");
    }
  }, [columns, selectedColumnId]);

  const selectedColumn = useMemo(
    () => columns.find((column) => column.id === selectedColumnId) ?? columns[0] ?? null,
    [columns, selectedColumnId],
  );

  const activeTickets = useMemo(
    () => selectedColumn ? ticketsByColumn.get(selectedColumn.id) ?? [] : [],
    [selectedColumn, ticketsByColumn],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 8,
      },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!selectedColumn || !over || active.id === over.id) return;

    const oldIndex = activeTickets.findIndex((ticket) => ticket.id === String(active.id));
    const newIndex = activeTickets.findIndex((ticket) => ticket.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(activeTickets, oldIndex, newIndex);
    const targetTicket = reordered[newIndex];
    if (!targetTicket) return;

    void onMoveTicket(targetTicket.id, selectedColumn.id, newIndex);
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1><CheckmarkCircle24Regular aria-hidden="true" /> Tasks</h1>
        <div className="page-heading__actions">
          <Input
            className="board-search"
            placeholder="Tickets durchsuchen"
            value={filterQuery}
            onChange={(_event, data) => setFilterQuery(data.value)}
          />
          {canManageColumns && (
            <Button appearance="primary" onClick={onAddColumn}>
              Spalte hinzufügen
            </Button>
          )}
        </div>
      </div>

      <div className="mobile-board-tabs" role="tablist" aria-label="Board-Spalten">
        {columns.map((column) => {
          const count = ticketsByColumn.get(column.id)?.length ?? 0;
          const isSelected = selectedColumn?.id === column.id;
          return (
            <button
              key={column.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`mobile-board-tab${isSelected ? " mobile-board-tab--selected" : ""}`}
              onClick={() => setSelectedColumnId(column.id)}
            >
              <span>{column.title}</span>
              <span className="mobile-board-tab__count">{count}</span>
            </button>
          );
        })}
      </div>

      {selectedColumn && (
        <section className="mobile-board-column" aria-live="polite">
          <div className="mobile-board-column__header">
            <h2>{selectedColumn.title}</h2>
            {canManageColumns && (
              <Button appearance="secondary" size="small" icon={<Add20Regular />} onClick={() => onAddTicket(selectedColumn.id)}>
                Ticket hinzufügen
              </Button>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={activeTickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
              <div className="mobile-board-column__list">
                {activeTickets.length === 0 ? (
                  <div className="empty-state empty-state--compact">
                    <h3>Keine Tickets</h3>
                    <p>In dieser Spalte gibt es noch keine Aufgaben.</p>
                  </div>
                ) : (
                  activeTickets.map((ticket) => {
                    const assignee = ticket.assigneeId ? usersById.get(ticket.assigneeId) : undefined;
                    return (
                      <MobileTicketCard
                        key={ticket.id}
                        ticket={ticket}
                        assignee={assignee}
                        onEdit={() => onEditTicket(ticket)}
                      />
                    );
                  })
                )}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      )}
    </div>
  );
}

function MobileTicketCard({
  ticket,
  assignee,
  onEdit,
}: {
  ticket: Ticket;
  assignee: PortalUser | undefined;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className="mobile-ticket-card"
      style={style}
    >
      <div className="mobile-ticket-card__header">
        <button type="button" className="mobile-ticket-card__content" onClick={onEdit}>
          <span className="mobile-ticket-card__title">{ticket.title}</span>
        </button>
        <button
          type="button"
          className="mobile-ticket-card__drag-handle"
          aria-label="Ticket verschieben"
          title="Ticket verschieben"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      </div>
      <div className="mobile-ticket-card__meta">
        {assignee ? <span>{assignee.name}</span> : <span>Unzugewiesen</span>}
        {ticket.priority ? <span>• {ticket.priority}</span> : null}
      </div>
    </div>
  );
}
