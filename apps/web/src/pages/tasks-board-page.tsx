import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Dropdown,
  Field,
  Input,
  Option,
} from "@fluentui/react-components";
import { Add20Regular, Archive16Regular, CheckmarkCircle24Regular, Delete16Regular, Edit16Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { BoardColumn, BoardState, PortalUser, Ticket } from "@portal/shared";
import { canManagePortal } from "@portal/shared";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api/client.js";
import { useAuth } from "../app/auth-context.js";

export function TasksBoardPage() {
  const { user } = useAuth();
  const isAdmin = canManagePortal(user);
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardState | null>(null);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [isAddColumnOpen, setAddColumnOpen] = useState(false);
  const [isAddTicketOpen, setAddTicketOpen] = useState(false);
  const [newTicketColumnId, setNewTicketColumnId] = useState<string | null>(null);
  const [newTicketTitle, setNewTicketTitle] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);
  const [renamingColumn, setRenamingColumn] = useState<BoardColumn | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [archivingColumnId, setArchivingColumnId] = useState<string | null>(null);
  const [columnActionError, setColumnActionError] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [archivedCount, setArchivedCount] = useState(0);

  const usersById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);

  useEffect(() => {
    let active = true;
    Promise.all([api.board.get(), api.users.list(), api.board.listArchivedTickets()])
      .then(([boardState, userList, archivedTickets]) => {
        if (!active) return;
        setBoard(boardState);
        setUsers(userList);
        setArchivedCount(archivedTickets.length);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => { active = false; };
  }, []);

  const columnsSorted = useMemo(
    () => (board ? [...board.columns].sort((a, b) => a.position - b.position) : []),
    [board],
  );

  const columnsById = useMemo(() => new Map(columnsSorted.map((entry) => [entry.id, entry])), [columnsSorted]);

  const ticketsByColumn = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    if (board) {
      for (const column of board.columns) map.set(column.id, []);
      for (const ticket of [...board.tickets].sort((a, b) => a.position - b.position)) {
        map.get(ticket.columnId)?.push(ticket);
      }
    }
    return map;
  }, [board]);

  const activeTicket = useMemo(
    () => board?.tickets.find((ticket) => ticket.id === activeTicketId) ?? null,
    [activeTicketId, board],
  );

  const activeTicketColumnTitle = useMemo(
    () => columnsSorted.find((column) => column.id === activeTicket?.columnId)?.title ?? "Backlog",
    [activeTicket, columnsSorted],
  );

  async function handleCreateColumn(event: FormEvent) {
    event.preventDefault();
    const title = newColumnTitle.trim();
    if (!title) return;
    const columns = await api.board.createColumn(title);
    setBoard((current) => (current ? { ...current, columns } : current));
    setNewColumnTitle("");
    setAddColumnOpen(false);
  }

  function openRenameColumn(column: BoardColumn) {
    setRenamingColumn(column);
    setRenameTitle(column.title);
  }

  async function handleRenameColumn(event: FormEvent) {
    event.preventDefault();
    if (!renamingColumn) return;
    const title = renameTitle.trim();
    if (!title) return;
    const columns = await api.board.renameColumn(renamingColumn.id, title);
    setBoard((current) => (current ? { ...current, columns } : current));
    setRenamingColumn(null);
  }

  async function handleDeleteColumn(id: string) {
    try {
      const columns = await api.board.deleteColumn(id);
      setBoard((current) => (current ? { ...current, columns } : current));
      setDeletingColumnId(null);
      setColumnActionError(null);
    } catch (error) {
      setColumnActionError(error instanceof ApiError ? error.message : "Spalte konnte nicht gelöscht werden.");
    }
  }

  async function handleCreateTicket(event: FormEvent) {
    event.preventDefault();
    if (!newTicketColumnId) return;
    const title = newTicketTitle.trim();
    if (!title) return;
    const tickets = await api.board.createTicket({
      columnId: newTicketColumnId,
      title,
      description: newTicketDescription.trim() ? newTicketDescription.trim() : null,
    });
    setBoard((current) => (current ? { ...current, tickets } : current));
    setAddTicketOpen(false);
    setNewTicketColumnId(null);
    setNewTicketTitle("");
    setNewTicketDescription("");
  }

  async function handleArchiveTickets(columnId: string) {
    const tickets = await api.board.archiveTickets(columnId);
    setBoard((current) => (current ? { ...current, tickets } : current));
    const archivedTickets = await api.board.listArchivedTickets();
    setArchivedCount(archivedTickets.length);
  }

  async function handleArchiveTicket(id: string) {
    const tickets = await api.board.archiveTicket(id);
    setBoard((current) => (current ? { ...current, tickets } : current));
    const archivedTickets = await api.board.listArchivedTickets();
    setArchivedCount(archivedTickets.length);
  }

  function openAddTicket(columnId: string) {
    setNewTicketColumnId(columnId);
    setAddTicketOpen(true);
  }

  const normalizedFilter = filterQuery.trim().toLowerCase();

  const filteredTicketsByColumn = useMemo(() => {
    if (!normalizedFilter) return ticketsByColumn;
    const map = new Map<string, Ticket[]>();
    for (const column of columnsSorted) {
      const tickets = ticketsByColumn.get(column.id) ?? [];
      const filtered = tickets.filter((ticket) => {
        const assigneeName = ticket.assigneeId ? usersById.get(ticket.assigneeId)?.name ?? "" : "";
        const haystack = [ticket.title, ticket.description ?? "", assigneeName, column.title]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedFilter);
      });
      map.set(column.id, filtered);
    }
    return map;
  }, [columnsSorted, normalizedFilter, ticketsByColumn, usersById]);

  const newTicketColumnTitle = newTicketColumnId ? columnsById.get(newTicketColumnId)?.title ?? "" : "";

  async function handleUpdateTicket(id: string, patch: {
    title?: string;
    description?: string | null;
    assigneeId?: string | null;
    columnId?: string;
    position?: number;
  }) {
    const tickets = await api.board.updateTicket(id, patch);
    setBoard((current) => (current ? { ...current, tickets } : current));
  }

  async function handleDeleteTicket(id: string) {
    const tickets = await api.board.deleteTicket(id);
    setBoard((current) => (current ? { ...current, tickets } : current));
    setDeletingTicketId(null);
    setEditingTicket((current) => (current?.id === id ? null : current));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const isColumnDrag = board?.columns.some((column) => column.id === activeId) ?? false;
    setActiveTicketId(isColumnDrag ? null : activeId);
    setActiveColumnId(isColumnDrag ? activeId : null);
  }, [board]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicketId(null);
    setActiveColumnId(null);
    if (!over || !board) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeColumn = board.columns.find((entry) => entry.id === activeId);
    const overColumn = board.columns.find((entry) => entry.id === overId);
    if (activeColumn && overColumn && activeColumn.id !== overColumn.id) {
      const oldIndex = columnsSorted.findIndex((entry) => entry.id === activeColumn.id);
      const newIndex = columnsSorted.findIndex((entry) => entry.id === overColumn.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        void (async () => {
          const columns = await api.board.updateColumn(activeColumn.id, { position: newIndex });
          setBoard((current) => (current ? { ...current, columns } : current));
        })();
      }
      return;
    }

    const ticket = board.tickets.find((entry) => entry.id === activeId);
    if (!ticket) return;

    const targetColumnId = board.columns.some((entry) => entry.id === overId)
      ? overId
      : board.tickets.find((entry) => entry.id === overId)?.columnId;
    if (!targetColumnId) return;

    const siblings = (ticketsByColumn.get(targetColumnId) ?? []).filter((entry) => entry.id !== ticket.id);
    const overTicketIndex = siblings.findIndex((entry) => entry.id === overId);
    const targetIndex = overTicketIndex === -1 ? siblings.length : overTicketIndex;

    if (targetColumnId === ticket.columnId && targetIndex === ticket.position) return;

    void handleUpdateTicket(ticket.id, { columnId: targetColumnId, position: targetIndex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, columnsSorted, ticketsByColumn]);

  if (status === "loading") {
    return (
      <div className="page-stack">
        <div className="page-heading"><h1><CheckmarkCircle24Regular aria-hidden="true" /> Tasks</h1></div>
        <p>Board wird geladen …</p>
      </div>
    );
  }

  if (status === "error" || !board) {
    return (
      <div className="page-stack">
        <div className="page-heading"><h1><CheckmarkCircle24Regular aria-hidden="true" /> Tasks</h1></div>
        <section className="empty-state">
          <h2>Das Board konnte nicht geladen werden.</h2>
          <p>Bitte lade die Seite neu oder versuche es später erneut.</p>
        </section>
      </div>
    );
  }

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
          <Button appearance="secondary" onClick={() => navigate("/areas/tasks/archive")}>
            {`Archiv anzeigen (${archivedCount})`}
          </Button>
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setAddColumnOpen(true)}>
            Spalte hinzufügen
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => { setActiveTicketId(null); setActiveColumnId(null); }}
      >
        <SortableContext items={columnsSorted.map((column) => column.id)} strategy={horizontalListSortingStrategy}>
          <div className="board">
            {columnsSorted.map((column) => (
              <BoardColumnView
                key={column.id}
                column={column}
                tickets={filteredTicketsByColumn.get(column.id) ?? []}
                ticketCount={(ticketsByColumn.get(column.id) ?? []).length}
                users={usersById}
                onEditTicket={setEditingTicket}
                onDeleteTicket={setDeletingTicketId}
                onArchiveTickets={() => { setColumnActionError(null); setArchivingColumnId(column.id); }}
                onArchiveTicket={handleArchiveTicket}
                onAddTicket={() => openAddTicket(column.id)}
                canArchive={column.title === "Erledigt" || column.title === "Done" || column.title === "Fertig"}
                dragDisabled={normalizedFilter.length > 0}
                onRenameColumn={() => openRenameColumn(column)}
                onDeleteColumn={() => { setColumnActionError(null); setDeletingColumnId(column.id); }}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeTicket ? (
            <TicketCardPreview
              ticket={activeTicket}
              columnTitle={activeTicketColumnTitle}
              assignee={activeTicket.assigneeId ? usersById.get(activeTicket.assigneeId) : undefined}
            />
          ) : null}
          {activeColumnId && board.columns.find((column) => column.id === activeColumnId) ? (
            <ColumnCardPreview column={board.columns.find((column) => column.id === activeColumnId)!} />
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={isAddTicketOpen} onOpenChange={(_event, data) => {
        setAddTicketOpen(data.open);
        if (!data.open) {
          setNewTicketColumnId(null);
          setNewTicketTitle("");
          setNewTicketDescription("");
        }
      }}>
        <DialogSurface>
          <form onSubmit={handleCreateTicket}>
            <DialogBody>
              <DialogTitle>Ticket in {newTicketColumnTitle} anlegen</DialogTitle>
              <DialogContent className="ticket-dialog-content">
                <Field label="Titel">
                  <Input value={newTicketTitle} onChange={(_event, data) => setNewTicketTitle(data.value)} autoFocus />
                </Field>
                <Field label="Beschreibung">
                  <textarea
                    className="ticket-dialog__textarea"
                    value={newTicketDescription}
                    onChange={(event) => setNewTicketDescription(event.target.value)}
                    rows={7}
                    placeholder="Beschreibung eingeben"
                  />
                </Field>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary" type="button">Abbrechen</Button>
                </DialogTrigger>
                <Button appearance="primary" type="submit">Anlegen</Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>

      <Dialog open={isAddColumnOpen} onOpenChange={(_event, data) => setAddColumnOpen(data.open)}>
        <DialogSurface>
          <form onSubmit={handleCreateColumn}>
            <DialogBody>
              <DialogTitle>Neue Spalte</DialogTitle>
              <DialogContent>
                <Field label="Name der Spalte">
                  <Input value={newColumnTitle} onChange={(_event, data) => setNewColumnTitle(data.value)} autoFocus />
                </Field>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary" type="button">Abbrechen</Button>
                </DialogTrigger>
                <Button appearance="primary" type="submit">Anlegen</Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>

      <Dialog open={renamingColumn !== null} onOpenChange={(_event, data) => { if (!data.open) setRenamingColumn(null); }}>
        <DialogSurface>
          <form onSubmit={handleRenameColumn}>
            <DialogBody>
              <DialogTitle>Spalte umbenennen</DialogTitle>
              <DialogContent>
                <Field label="Name der Spalte">
                  <Input value={renameTitle} onChange={(_event, data) => setRenameTitle(data.value)} autoFocus />
                </Field>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary" type="button">Abbrechen</Button>
                </DialogTrigger>
                <Button appearance="primary" type="submit">Speichern</Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>

      <Dialog
        open={deletingColumnId !== null}
        onOpenChange={(_event, data) => { if (!data.open) { setDeletingColumnId(null); setColumnActionError(null); } }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Spalte löschen?</DialogTitle>
            <DialogContent>
              {columnActionError ?? "Diese Aktion kann nicht rückgängig gemacht werden."}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">Abbrechen</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={() => deletingColumnId && handleDeleteColumn(deletingColumnId)}>
                Löschen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        open={archivingColumnId !== null}
        onOpenChange={(_event, data) => { if (!data.open) setArchivingColumnId(null); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Tickets archivieren?</DialogTitle>
            <DialogContent>
              Alle Tickets dieser Spalte werden archiviert und aus dem Board entfernt.
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">Abbrechen</Button>
              </DialogTrigger>
              <Button
                appearance="primary"
                onClick={async () => {
                  if (!archivingColumnId) return;
                  await handleArchiveTickets(archivingColumnId);
                  setArchivingColumnId(null);
                }}
              >
                Bestätigen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {editingTicket && (
        <EditTicketDialog
          ticket={editingTicket}
          columns={columnsSorted}
          users={users}
          onClose={() => setEditingTicket(null)}
          onSave={async (patch) => {
            await handleUpdateTicket(editingTicket.id, patch);
            setEditingTicket(null);
          }}
          onRequestDelete={() => setDeletingTicketId(editingTicket.id)}
        />
      )}

      <Dialog open={deletingTicketId !== null} onOpenChange={(_event, data) => { if (!data.open) setDeletingTicketId(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Ticket löschen?</DialogTitle>
            <DialogContent>Diese Aktion kann nicht rückgängig gemacht werden.</DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">Abbrechen</Button>
              </DialogTrigger>
              <Button appearance="primary" onClick={() => deletingTicketId && handleDeleteTicket(deletingTicketId)}>
                Löschen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

function BoardColumnView({
  column,
  tickets,
  ticketCount,
  users,
  onEditTicket,
  onDeleteTicket,
  onArchiveTickets,
  onArchiveTicket,
  onAddTicket,
  canArchive,
  dragDisabled,
  onRenameColumn,
  onDeleteColumn,
}: {
  column: BoardColumn;
  tickets: Ticket[];
  ticketCount: number;
  users: Map<string, PortalUser>;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (id: string) => void;
  onArchiveTickets: () => void;
  onArchiveTicket: (id: string) => void;
  onAddTicket: () => void;
  canArchive: boolean;
  dragDisabled: boolean;
  onRenameColumn: () => void;
  onDeleteColumn: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.75 : 1 };

  return (
    <section className={`board-column${isDragging ? " board-column--dragging" : ""}`} ref={setNodeRef} style={style}>
      <header className="board-column__header">
        <div className="board-column__header-main">
          <button
            type="button"
            className="board-column__drag-handle"
            aria-label={`Spalte ${column.title} verschieben`}
            title="Spalte verschieben"
            {...attributes}
            {...listeners}
          >
            <span aria-hidden="true">⋮⋮</span>
          </button>
          <h2>{column.title}</h2>
        </div>
        <div className="board-column__header-actions">
          <Badge appearance="tint" color="informative">{ticketCount}</Badge>
          <button
            type="button"
            className="board-column__action"
            aria-label="Spalte umbenennen"
            title="Spalte umbenennen"
            onClick={onRenameColumn}
          >
            <Edit16Regular />
          </button>
          {ticketCount > 0 ? (
            <span className="board-column__action-tooltip" title="Spalte kann nur gelöscht werden, wenn sie leer ist.">
              <button
                type="button"
                className="board-column__action"
                aria-label="Spalte löschen"
                title="Spalte kann nur gelöscht werden, wenn sie leer ist."
                disabled
                onClick={onDeleteColumn}
              >
                <Delete16Regular />
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="board-column__action"
              aria-label="Spalte löschen"
              title="Spalte löschen"
              onClick={onDeleteColumn}
            >
              <Delete16Regular />
            </button>
          )}
        </div>
      </header>

      <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
        <div className="board-column__cards">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              columnTitle={column.title}
              assignee={ticket.assigneeId ? users.get(ticket.assigneeId) : undefined}
              dragDisabled={dragDisabled}
              canArchive={canArchive}
              onArchive={() => onArchiveTicket(ticket.id)}
              onEdit={() => onEditTicket(ticket)}
              onDelete={() => onDeleteTicket(ticket.id)}
            />
          ))}
        </div>
      </SortableContext>

      <div className="board-column__footer">
        <Button appearance="secondary" size="small" onClick={onAddTicket}>
          Ticket hinzufügen
        </Button>
        {canArchive && (
          <Button appearance="subtle" size="small" onClick={onArchiveTickets} disabled={ticketCount === 0}>
            Archivieren
          </Button>
        )}
      </div>
    </section>
  );
}

function TicketCard({
  ticket,
  columnTitle,
  assignee,
  dragDisabled,
  canArchive,
  onArchive,
  onEdit,
  onDelete,
}: {
  ticket: Ticket;
  columnTitle: string;
  assignee: PortalUser | undefined;
  dragDisabled: boolean;
  canArchive: boolean;
  onArchive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id, disabled: dragDisabled });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.2 : 1 };
  const tone = columnTitle === "Erledigt" ? "done" : columnTitle === "In Review" ? "review" : columnTitle === "In Arbeit" ? "doing" : "todo";

  return (
    <article
      className={`ticket-card ticket-card--${tone}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === "Enter") onEdit(); }}
    >
      <div className="ticket-card__header">
        <span className="ticket-card__title">{ticket.title}</span>
        <div className="ticket-card__actions">
          <button
            type="button"
            className="ticket-card__action"
            aria-label="Ticket bearbeiten"
            title="Ticket bearbeiten"
            onClick={(event) => { event.stopPropagation(); onEdit(); }}
          >
            <Edit16Regular />
          </button>
          {canArchive && (
            <button
              type="button"
              className="ticket-card__action"
              aria-label="Ticket archivieren"
              title="Ticket archivieren"
              onClick={(event) => { event.stopPropagation(); onArchive(); }}
            >
              <Archive16Regular />
            </button>
          )}
          <button
            type="button"
            className="ticket-card__delete"
            aria-label="Ticket löschen"
            title="Ticket löschen"
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
          >
            <Delete16Regular />
          </button>
        </div>
      </div>
      {assignee && <Avatar name={assignee.name} size={24} color="colorful" />}
    </article>
  );
}

function ColumnCardPreview({ column }: { column: BoardColumn }) {
  return (
    <section className="board-column board-column--drag-overlay" aria-hidden="true" role="presentation">
      <header className="board-column__header">
        <h2>{column.title}</h2>
      </header>
    </section>
  );
}

function TicketCardPreview({
  ticket,
  columnTitle,
  assignee,
}: {
  ticket: Ticket;
  columnTitle: string;
  assignee: PortalUser | undefined;
}) {
  const tone = columnTitle === "Erledigt" ? "done" : columnTitle === "In Review" ? "review" : columnTitle === "In Arbeit" ? "doing" : "todo";

  return (
    <article className={`ticket-card ticket-card--${tone} ticket-card--drag-overlay`} role="presentation" aria-hidden="true">
      <div className="ticket-card__header">
        <span className="ticket-card__title">{ticket.title}</span>
        <div className="ticket-card__actions">
          <Edit16Regular />
          <Delete16Regular />
        </div>
      </div>
      {assignee && <Avatar name={assignee.name} size={24} color="colorful" />}
    </article>
  );
}

function EditTicketDialog({
  ticket,
  columns,
  users,
  onClose,
  onSave,
  onRequestDelete,
}: {
  ticket: Ticket;
  columns: BoardColumn[];
  users: PortalUser[];
  onClose: () => void;
  onSave: (patch: { title: string; description: string | null; assigneeId: string | null; columnId: string }) => void;
  onRequestDelete: () => void;
}) {
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description ?? "");
  const [assigneeId, setAssigneeId] = useState(ticket.assigneeId ?? "");
  const [columnId, setColumnId] = useState(ticket.columnId);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave({
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      assigneeId: assigneeId || null,
      columnId,
    });
  }

  const assigneeName = users.find((entry) => entry.id === assigneeId)?.name ?? "Niemand zugewiesen";
  const columnName = columns.find((entry) => entry.id === columnId)?.title ?? "";

  return (
    <Dialog open onOpenChange={(_event, data) => { if (!data.open) onClose(); }}>
      <DialogSurface>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <DialogTitle>Ticket bearbeiten</DialogTitle>
            <DialogContent className="ticket-dialog-content">
              <Field label="Titel">
                <Input className="ticket-dialog__input" value={title} onChange={(_event, data) => setTitle(data.value)} autoFocus />
              </Field>
              <Field label="Beschreibung">
                <textarea
                  className="ticket-dialog__textarea"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={10}
                  placeholder="Beschreibung eingeben"
                />
              </Field>
              <Field label="Zuweisung">
                <Dropdown
                  className="ticket-dialog__dropdown"
                  value={assigneeName}
                  selectedOptions={assigneeId ? [assigneeId] : []}
                  onOptionSelect={(_event, data) => setAssigneeId(data.optionValue ?? "")}
                >
                  <Option value="">Niemand zugewiesen</Option>
                  {users.map((entry) => (
                    <Option key={entry.id} value={entry.id}>{entry.name}</Option>
                  ))}
                </Dropdown>
              </Field>
              <Field label="Spalte">
                <Dropdown
                  className="ticket-dialog__dropdown"
                  value={columnName}
                  selectedOptions={[columnId]}
                  onOptionSelect={(_event, data) => { if (data.optionValue) setColumnId(data.optionValue); }}
                >
                  {columns.map((column) => (
                    <Option key={column.id} value={column.id}>{column.title}</Option>
                  ))}
                </Dropdown>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="outline" type="button" icon={<Delete16Regular />} onClick={onRequestDelete}>
                Löschen
              </Button>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" type="button">Abbrechen</Button>
              </DialogTrigger>
              <Button appearance="primary" type="submit">Speichern</Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
