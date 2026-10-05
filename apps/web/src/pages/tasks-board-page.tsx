import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
  Textarea,
} from "@fluentui/react-components";
import { Add20Regular, CheckmarkCircle24Regular, Delete16Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { BoardColumn, BoardState, PortalUser, Ticket } from "@portal/shared";
import { api } from "../api/client.js";
import { useAuth } from "../app/auth-context.js";

type ComposerState = { title: string; assigneeId: string };

const emptyComposer: ComposerState = { title: "", assigneeId: "" };

export function TasksBoardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [board, setBoard] = useState<BoardState | null>(null);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [composers, setComposers] = useState<Record<string, ComposerState>>({});
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [isAddColumnOpen, setAddColumnOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);

  const usersById = useMemo(() => new Map(users.map((entry) => [entry.id, entry])), [users]);

  useEffect(() => {
    let active = true;
    Promise.all([api.board.get(), api.users.list()])
      .then(([boardState, userList]) => {
        if (!active) return;
        setBoard(boardState);
        setUsers(userList);
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

  async function handleCreateColumn(event: FormEvent) {
    event.preventDefault();
    const title = newColumnTitle.trim();
    if (!title) return;
    const columns = await api.board.createColumn(title);
    setBoard((current) => (current ? { ...current, columns } : current));
    setNewColumnTitle("");
    setAddColumnOpen(false);
  }

  async function handleCreateTicket(columnId: string, event: FormEvent) {
    event.preventDefault();
    const composer = composers[columnId] ?? emptyComposer;
    const title = composer.title.trim();
    if (!title) return;
    const tickets = await api.board.createTicket({
      columnId,
      title,
      assigneeId: composer.assigneeId || null,
    });
    setBoard((current) => (current ? { ...current, tickets } : current));
    setComposers((current) => ({ ...current, [columnId]: emptyComposer }));
  }

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !board) return;

    const ticket = board.tickets.find((entry) => entry.id === active.id);
    if (!ticket) return;

    const overId = String(over.id);
    const targetColumnId = overId.startsWith("column:")
      ? overId.slice("column:".length)
      : board.tickets.find((entry) => entry.id === overId)?.columnId;
    if (!targetColumnId) return;

    const siblings = (ticketsByColumn.get(targetColumnId) ?? []).filter((entry) => entry.id !== ticket.id);
    const overTicketIndex = siblings.findIndex((entry) => entry.id === overId);
    const targetIndex = overTicketIndex === -1 ? siblings.length : overTicketIndex;

    if (targetColumnId === ticket.columnId && targetIndex === ticket.position) return;

    void handleUpdateTicket(ticket.id, { columnId: targetColumnId, position: targetIndex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, ticketsByColumn]);

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
        {isAdmin && (
          <Button appearance="secondary" icon={<Add20Regular />} onClick={() => setAddColumnOpen(true)}>
            Spalte hinzufügen
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="board">
          {columnsSorted.map((column) => (
            <BoardColumnView
              key={column.id}
              column={column}
              tickets={ticketsByColumn.get(column.id) ?? []}
              users={usersById}
              composer={composers[column.id] ?? emptyComposer}
              onComposerChange={(next) => setComposers((current) => ({ ...current, [column.id]: next }))}
              onCreateTicket={(event) => handleCreateTicket(column.id, event)}
              onEditTicket={setEditingTicket}
              onDeleteTicket={setDeletingTicketId}
            />
          ))}
        </div>
      </DndContext>

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
  users,
  composer,
  onComposerChange,
  onCreateTicket,
  onEditTicket,
  onDeleteTicket,
}: {
  column: BoardColumn;
  tickets: Ticket[];
  users: Map<string, PortalUser>;
  composer: ComposerState;
  onComposerChange: (next: ComposerState) => void;
  onCreateTicket: (event: FormEvent) => void;
  onEditTicket: (ticket: Ticket) => void;
  onDeleteTicket: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });

  return (
    <section className={`board-column${isOver ? " board-column--over" : ""}`} ref={setNodeRef}>
      <header className="board-column__header">
        <h2>{column.title}</h2>
        <Badge appearance="tint" color="informative">{tickets.length}</Badge>
      </header>

      <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
        <div className="board-column__cards">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              assignee={ticket.assigneeId ? users.get(ticket.assigneeId) : undefined}
              onEdit={() => onEditTicket(ticket)}
              onDelete={() => onDeleteTicket(ticket.id)}
            />
          ))}
        </div>
      </SortableContext>

      <form className="board-column__composer" onSubmit={onCreateTicket}>
        <Input
          value={composer.title}
          placeholder="+ Karte hinzufügen"
          onChange={(_event, data) => onComposerChange({ ...composer, title: data.value })}
        />
      </form>
    </section>
  );
}

function TicketCard({
  ticket,
  assignee,
  onEdit,
  onDelete,
}: {
  ticket: Ticket;
  assignee: PortalUser | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ticket.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <article
      className="ticket-card"
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
                <Input value={title} onChange={(_event, data) => setTitle(data.value)} autoFocus />
              </Field>
              <Field label="Beschreibung">
                <Textarea value={description} onChange={(_event, data) => setDescription(data.value)} rows={4} />
              </Field>
              <Field label="Zuweisung">
                <Dropdown
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
