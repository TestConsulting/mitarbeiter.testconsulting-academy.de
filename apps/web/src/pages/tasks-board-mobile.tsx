import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@fluentui/react-components";
import {
  Add20Regular,
  CheckmarkCircle24Regular,
  ChevronDoubleUp16Regular,
  ChevronDown16Regular,
  Delete16Regular,
  Edit16Regular,
  ErrorCircle16Regular,
} from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BoardColumn, PortalUser, Ticket, TicketPriority, TicketType } from "@portal/shared";
import { TicketDueDate } from "./ticket-due-date.js";
import { TicketBlockButton, TicketBlockedBadge } from "./ticket-blocked-badge.js";

const ticketTypeOptions: { value: TicketType; label: string }[] = [
  { value: "task", label: "Task" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "spike", label: "Spike" },
  { value: "todo", label: "TODO" },
];

const priorityLabels: Record<TicketPriority, string> = {
  low: "Niedrig",
  normal: "Normal",
  high: "Hoch",
  urgent: "Dringend",
};

function getTicketTypeLabel(type: TicketType): string {
  return ticketTypeOptions.find((entry) => entry.value === type)?.label ?? "Task";
}

function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const iconMap: Record<TicketPriority, ReactNode> = {
    low: <ChevronDown16Regular aria-hidden="true" />,
    normal: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3.5 6h9M3.5 10h9" stroke="currentColor" strokeLinecap="round" />
      </svg>
    ),
    high: <ChevronDoubleUp16Regular aria-hidden="true" />,
    urgent: <ErrorCircle16Regular aria-hidden="true" />,
  };

  return (
    <span className={`ticket-priority ticket-priority--${priority}`} aria-label={`Priorität: ${priorityLabels[priority]}`}>
      <span className="ticket-priority__symbol" aria-hidden="true">{iconMap[priority]}</span>
      {priorityLabels[priority]}
    </span>
  );
}

export type MobileKanbanBoardProps = {
  columns: BoardColumn[];
  ticketsByColumn: Map<string, Ticket[]>;
  usersById: Map<string, PortalUser>;
  filters: ReactNode;
  dragDisabled: boolean;
  canDeleteColumn: (columnId: string) => boolean;
  canManageColumns: boolean;
  onAddColumn: () => void;
  onEditTicket: (ticket: Ticket) => void;
  onToggleBlocked: (ticket: Ticket) => Promise<void>;
  onAddTicket: (columnId: string) => void;
  onMoveTicket: (ticketId: string, columnId: string, position: number) => Promise<void> | void;
  onRenameColumn: (column: BoardColumn) => void;
  onDeleteColumn: (columnId: string) => void;
};

export function MobileKanbanBoard({
  columns,
  ticketsByColumn,
  usersById,
  filters,
  dragDisabled,
  canDeleteColumn,
  canManageColumns,
  onAddColumn,
  onEditTicket,
  onToggleBlocked,
  onAddTicket,
  onMoveTicket,
  onRenameColumn,
  onDeleteColumn,
}: MobileKanbanBoardProps) {
  const [selectedColumnId, setSelectedColumnId] = useState(columns[0]?.id ?? "");
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const suppressTabClickRef = useRef(false);

  useEffect(() => {
    if (!columns.some((column) => column.id === selectedColumnId)) {
      setSelectedColumnId(columns[0]?.id ?? "");
    }
  }, [columns, selectedColumnId]);

  useEffect(() => {
    const activeTab = selectedColumnId ? tabRefs.current[selectedColumnId] : null;
    if (activeTab && tabsRef.current) {
      activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedColumnId, columns.length]);

  const selectedColumn = useMemo(
    () => columns.find((column) => column.id === selectedColumnId) ?? columns[0] ?? null,
    [columns, selectedColumnId],
  );

  const allTickets = useMemo(
    () => columns.flatMap((column) => ticketsByColumn.get(column.id) ?? []),
    [columns, ticketsByColumn],
  );

  const resolveTargetColumnId = (overId: string | null) => {
    if (!overId) return null;
    if (columns.some((column) => column.id === overId)) return overId;
    const resolved = allTickets.find((ticket) => ticket.id === overId)?.columnId ?? null;
    console.log("[mobile-board] resolveTargetColumnId", { overId, resolved, columns: columns.map((column) => column.id) });
    return resolved;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 120,
        tolerance: 8,
      },
    }),
  );

  const handleDragStart = (event: { active: { id: string | number } }) => {
    const activeId = String(event.active.id);
    const activeTicket = allTickets.find((ticket) => ticket.id === activeId);
    console.log("[mobile-board] drag-start", { activeId, activeTicketId: activeTicket?.id, activeColumnId: activeTicket?.columnId });
    if (!activeTicket) return;
    setDraggingTicketId(activeTicket.id);
    setDragOverColumnId(activeTicket.columnId);
    setSelectedColumnId(activeTicket.columnId);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const overId = String(event.over?.id ?? "") || null;
    const targetColumnId = resolveTargetColumnId(overId);
    console.log("[mobile-board] drag-move", { overId, targetColumnId, clientX: (event.activatorEvent as PointerEvent | undefined)?.clientX, clientY: (event.activatorEvent as PointerEvent | undefined)?.clientY });
    if (targetColumnId) {
      setDragOverColumnId(targetColumnId);
      setSelectedColumnId(targetColumnId);
    }
  };

  const handleTabPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!tabsRef.current) return;

    suppressTabClickRef.current = false;
    tabDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: tabsRef.current.scrollLeft,
      moved: false,
    };
  };

  const handleTabPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tabDragRef.current || tabDragRef.current.pointerId !== event.pointerId || !tabsRef.current) return;
    const deltaX = event.clientX - tabDragRef.current.startX;
    if (Math.abs(deltaX) > 6) {
      tabDragRef.current.moved = true;
      suppressTabClickRef.current = true;
      event.preventDefault();
      tabsRef.current.scrollLeft = tabDragRef.current.startScrollLeft - deltaX;
    }
  };

  const handleTabPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tabDragRef.current || tabDragRef.current.pointerId !== event.pointerId) return;
    if (tabDragRef.current.moved) {
      suppressTabClickRef.current = true;
    }
    tabDragRef.current = null;
    if (event.pointerType === "mouse") {
      setTimeout(() => {
        suppressTabClickRef.current = false;
      }, 0);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log("[mobile-board] drag-end", { activeId: String(active.id), overId: over ? String(over.id) : null, overType: over?.data?.current?.type });
    setDraggingTicketId(null);
    setDragOverColumnId(null);

    if (!over || active.id === over.id) return;

    const activeTicket = allTickets.find((ticket) => ticket.id === String(active.id));
    if (!activeTicket) return;

    const targetColumnId = resolveTargetColumnId(String(over.id));
    if (!targetColumnId) return;

    const targetTickets = ticketsByColumn.get(targetColumnId) ?? [];
    const overTicketIndex = targetTickets.findIndex((ticket) => ticket.id === String(over.id));
    const targetIndex = overTicketIndex >= 0 ? overTicketIndex : targetTickets.length;
    console.log("[mobile-board] move-request", { ticketId: activeTicket.id, targetColumnId, targetIndex, targetTickets: targetTickets.map((ticket) => ticket.id) });

    void onMoveTicket(activeTicket.id, targetColumnId, targetIndex);
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1><CheckmarkCircle24Regular aria-hidden="true" /> Tasks</h1>
        <div className="page-heading__actions">
          {canManageColumns && (
            <Button className="mobile-board__add-column" appearance="primary" size="small" icon={<Add20Regular />} onClick={onAddColumn}>
              Spalte hinzufügen
            </Button>
          )}
        </div>
      </div>

      {filters}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDraggingTicketId(null);
          setDragOverColumnId(null);
        }}
      >
        <div className="mobile-board">
          <div
            className="mobile-board-tabs"
            ref={tabsRef}
            role="tablist"
            aria-label="Board-Spalten"
            style={{ overflowX: "auto", overflowY: "hidden", touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
            onPointerDown={handleTabPointerDown}
            onPointerMove={handleTabPointerMove}
            onPointerUp={handleTabPointerEnd}
            onPointerLeave={handleTabPointerEnd}
            onPointerCancel={handleTabPointerEnd}
          >
            {columns.map((column) => {
              const count = ticketsByColumn.get(column.id)?.length ?? 0;
              const isSelected = selectedColumn?.id === column.id;
              const isDropTarget = dragOverColumnId === column.id;

              return (
                <MobileColumnTab
                  key={column.id}
                  column={column}
                  count={count}
                  isSelected={isSelected}
                  isDropTarget={isDropTarget}
                  onSelect={() => {
                    if (suppressTabClickRef.current) {
                      suppressTabClickRef.current = false;
                      return;
                    }
                    setSelectedColumnId(column.id);
                  }}
                  tabRef={(node) => {
                    tabRefs.current[column.id] = node;
                  }}
                />
              );
            })}
          </div>

          {selectedColumn ? (
            <MobileColumnSection
              key={selectedColumn.id}
              column={selectedColumn}
              tickets={ticketsByColumn.get(selectedColumn.id) ?? []}
              usersById={usersById}
              canManageColumns={canManageColumns}
              canDeleteColumn={canDeleteColumn(selectedColumn.id)}
              dragDisabled={dragDisabled}
              dragOverColumnId={dragOverColumnId}
              onAddTicket={onAddTicket}
              onEditTicket={onEditTicket}
              onToggleBlocked={onToggleBlocked}
              onRenameColumn={onRenameColumn}
              onDeleteColumn={onDeleteColumn}
              draggingTicketId={draggingTicketId}
              isSelected={true}
            />
          ) : null}
        </div>

        <DragOverlay>
          {draggingTicketId ? (
            <MobileTicketCardDragOverlay ticket={allTickets.find((ticket) => ticket.id === draggingTicketId)!} usersById={usersById} columns={columns} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function MobileColumnTab({
  column,
  count,
  isSelected,
  isDropTarget,
  onSelect,
  tabRef,
}: {
  column: BoardColumn;
  count: number;
  isSelected: boolean;
  isDropTarget: boolean;
  onSelect: () => void;
  tabRef: (node: HTMLButtonElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column-drop", columnId: column.id },
  });

  return (
    <button
      ref={(node) => {
        setNodeRef(node);
        tabRef(node);
      }}
      type="button"
      role="tab"
      aria-selected={isSelected}
      className={`mobile-board-tab${isSelected ? " mobile-board-tab--selected" : ""}${isDropTarget || isOver ? " mobile-board-tab--drop-target" : ""}`}
      data-column-id={column.id}
      style={{ flex: "0 0 auto" }}
      onClick={onSelect}
    >
      <span>{column.title}</span>
      <span className="mobile-board-tab__count">{count}</span>
    </button>
  );
}

function MobileColumnSection({
  column,
  tickets,
  usersById,
  canManageColumns,
  canDeleteColumn,
  dragDisabled,
  dragOverColumnId,
  onAddTicket,
  onEditTicket,
  onToggleBlocked,
  onRenameColumn,
  onDeleteColumn,
  draggingTicketId,
  isSelected,
}: {
  column: BoardColumn;
  tickets: Ticket[];
  usersById: Map<string, PortalUser>;
  canManageColumns: boolean;
  canDeleteColumn: boolean;
  dragDisabled: boolean;
  dragOverColumnId: string | null;
  onAddTicket: (columnId: string) => void;
  onEditTicket: (ticket: Ticket) => void;
  onToggleBlocked: (ticket: Ticket) => Promise<void>;
  onRenameColumn: (column: BoardColumn) => void;
  onDeleteColumn: (columnId: string) => void;
  draggingTicketId: string | null;
  isSelected: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column-drop", columnId: column.id },
  });

  return (
    <section
      ref={setNodeRef}
      className={`mobile-board-column${isSelected ? " mobile-board-column--selected" : " mobile-board-column--inactive"}${dragOverColumnId === column.id || isOver ? " mobile-board-column--drop-target" : ""}`}
      aria-live="polite"
      data-column-id={column.id}
    >
      <div className="mobile-board-column__header">
        <h2>{column.title}</h2>
        <div className="mobile-board-column__header-actions">
          {canManageColumns && (
            <>
              <Button
                appearance="secondary"
                size="small"
                icon={<Edit16Regular />}
                aria-label={`Spalte ${column.title} umbenennen`}
                title="Spalte umbenennen"
                onClick={() => onRenameColumn(column)}
              />
              <Button
                appearance="secondary"
                size="small"
                icon={<Delete16Regular />}
                aria-label={`Spalte ${column.title} löschen`}
                title="Spalte löschen"
                disabled={!canDeleteColumn}
                onClick={() => onDeleteColumn(column.id)}
              />
            </>
          )}
          {canManageColumns && (
            <Button appearance="secondary" size="small" icon={<Add20Regular />} onClick={() => onAddTicket(column.id)}>
              Ticket hinzufügen
            </Button>
          )}
        </div>
      </div>

      <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
        <div className={`mobile-board-column__list${dragOverColumnId === column.id || isOver ? " mobile-board-column__list--drop-target" : ""}`}>
          {tickets.length === 0 ? (
            <div className="empty-state empty-state--compact">
              <h3>Keine Tickets</h3>
              <p>In dieser Spalte gibt es noch keine Aufgaben.</p>
            </div>
          ) : (
            tickets.map((ticket) => {
              const assignee = ticket.assigneeId ? usersById.get(ticket.assigneeId) : undefined;
              return (
                <MobileTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  columnTitle={column.title}
                  assignee={assignee}
                  onEdit={() => onEditTicket(ticket)}
                  onToggleBlocked={() => onToggleBlocked(ticket)}
                  isDragging={draggingTicketId === ticket.id}
                  dragDisabled={dragDisabled}
                />
              );
            })
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function MobileTicketCardDragOverlay({ ticket, usersById, columns }: { ticket: Ticket; usersById: Map<string, PortalUser>; columns: BoardColumn[] }) {
  const assignee = ticket.assigneeId ? usersById.get(ticket.assigneeId) : undefined;
  const ticketType = ticket.type ?? "task";
  const priority = ticket.priority ?? "normal";

  return (
    <div className={`mobile-ticket-card mobile-ticket-card--drag-overlay ticket-card--type-${ticketType}`}>
      <div className="mobile-ticket-card__header">
        <div className="mobile-ticket-card__content">
          <span className="mobile-ticket-card__title">{ticket.title}</span>
          {ticket.description && <p className="mobile-ticket-card__description">{ticket.description}</p>}
        </div>
      </div>
      <div className="ticket-card__badges">
        <span className={`ticket-card__type-badge ticket-card__type-badge--${ticketType}`}>
          {getTicketTypeLabel(ticketType)}
        </span>
        <TicketBlockedBadge blocked={ticket.blocked} />
      </div>
      <div className="mobile-ticket-card__meta">
        {assignee ? (
          <span className="mobile-ticket-card__assignee">
            <span className="mobile-ticket-card__assignee-badge" aria-hidden="true">{assignee.name.charAt(0).toUpperCase()}</span>
            {assignee.name}
          </span>
        ) : (
          <span className="mobile-ticket-card__assignee mobile-ticket-card__assignee--empty">Unzugewiesen</span>
        )}
        <TicketDueDate dueDate={ticket.dueDate ?? null} columnTitle={columns.find((column) => column.id === ticket.columnId)?.title} />
        <TicketPriorityBadge priority={priority} />
      </div>
    </div>
  );
}

function MobileTicketCard({
  ticket,
  columnTitle,
  assignee,
  onEdit,
  onToggleBlocked,
  isDragging: forcedDragging,
  dragDisabled,
}: {
  ticket: Ticket;
  columnTitle: string;
  assignee: PortalUser | undefined;
  onEdit: () => void;
  onToggleBlocked: () => Promise<void>;
  isDragging?: boolean;
  dragDisabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id, disabled: dragDisabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || forcedDragging ? 0.6 : 1,
  };
  const ticketType = ticket.type ?? "task";
  const priority = ticket.priority ?? "normal";
  const [blockError, setBlockError] = useState<string | null>(null);

  return (
    <div
      ref={setNodeRef}
      className={`mobile-ticket-card ticket-card--type-${ticketType}`}
      style={style}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Ticket ${ticket.title} öffnen`}
    >
      <div className="mobile-ticket-card__header">
        <div className="mobile-ticket-card__content">
          <span className="mobile-ticket-card__title">{ticket.title}</span>
          {ticket.description && (
            <p className="mobile-ticket-card__description">{ticket.description}</p>
          )}
        </div>
        <div className="ticket-card__actions">
          <TicketBlockButton
            blocked={ticket.blocked}
            onToggle={onToggleBlocked}
            onError={setBlockError}
            className="mobile-ticket-card__block"
          />
          <button
            type="button"
            className="mobile-ticket-card__drag-handle"
            aria-label="Ticket verschieben"
            disabled={dragDisabled}
            title="Ticket verschieben"
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        </div>
      </div>

      <div className="ticket-card__badges">
        <span className={`ticket-card__type-badge ticket-card__type-badge--${ticketType}`}>
          {getTicketTypeLabel(ticketType)}
        </span>
        <TicketBlockedBadge blocked={ticket.blocked} />
      </div>
      {blockError && <p className="ticket-card__block-error" role="alert">{blockError}</p>}

      <div className="mobile-ticket-card__meta">
        {assignee ? (
          <span className="mobile-ticket-card__assignee">
            <span className="mobile-ticket-card__assignee-badge" aria-hidden="true">
              {assignee.name.charAt(0).toUpperCase()}
            </span>
            {assignee.name}
          </span>
        ) : (
          <span className="mobile-ticket-card__assignee mobile-ticket-card__assignee--empty">Unzugewiesen</span>
        )}

        <TicketDueDate dueDate={ticket.dueDate ?? null} columnTitle={columnTitle} />
        <TicketPriorityBadge priority={priority} />
      </div>
    </div>
  );
}
