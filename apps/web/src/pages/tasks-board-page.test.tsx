import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardState, PortalUser } from "@portal/shared";
import { AuthProvider } from "../app/auth-context.js";
import { TasksBoardPage } from "./tasks-board-page.js";

const employeeUser: PortalUser = { id: "u1", email: "alex@example.test", name: "Alex Beispiel", role: "employee" };
const adminUser: PortalUser = { id: "u2", email: "admina@example.test", name: "Admina Beispiel", role: "admin" };

const boardApi = vi.hoisted(() => ({
  get: vi.fn(),
  createColumn: vi.fn(),
  createTicket: vi.fn(),
  archiveTickets: vi.fn(),
  listArchivedTickets: vi.fn(),
  restoreTicket: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
  renameColumn: vi.fn(),
  deleteColumn: vi.fn(),
}));
const usersApi = vi.hoisted(() => ({ list: vi.fn() }));
const authApi = vi.hoisted(() => ({ me: vi.fn(), login: vi.fn(), logout: vi.fn() }));

vi.mock("../api/client.js", () => ({
  api: { ...authApi, board: boardApi, users: usersApi },
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));

function buildBoard(): BoardState {
  return {
    columns: [
      { id: "col-backlog", title: "Backlog", position: 0 },
      { id: "col-todo", title: "Zu erledigen", position: 1 },
      { id: "col-doing", title: "In Arbeit", position: 2 },
      { id: "col-review", title: "In Review", position: 3 },
      { id: "col-done", title: "Erledigt", position: 4 },
    ],
    tickets: [
      {
        id: "ticket-1",
        columnId: "col-backlog",
        title: "Angebot schreiben",
        description: null,
        assigneeId: employeeUser.id,
        position: 0,
        createdBy: employeeUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

function renderBoard(currentUser: PortalUser) {
  authApi.me.mockResolvedValue(currentUser);
  usersApi.list.mockResolvedValue([employeeUser, adminUser]);
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TasksBoardPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  boardApi.get.mockReset();
  boardApi.createColumn.mockReset();
  boardApi.createTicket.mockReset();
  boardApi.archiveTickets.mockReset();
  boardApi.listArchivedTickets.mockReset();
  boardApi.restoreTicket.mockReset();
  boardApi.updateTicket.mockReset();
  boardApi.deleteTicket.mockReset();
  boardApi.renameColumn.mockReset();
  boardApi.deleteColumn.mockReset();
  usersApi.list.mockReset();
  authApi.me.mockReset();
  boardApi.get.mockResolvedValue(buildBoard());
  boardApi.listArchivedTickets.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("tasks board page", () => {
  it("renders columns and tickets from the server", async () => {
    renderBoard(employeeUser);
    expect(await screen.findByText("Angebot schreiben")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("Zu erledigen")).toBeInTheDocument();
    expect(screen.getByText("In Arbeit")).toBeInTheDocument();
    expect(screen.getByText("In Review")).toBeInTheDocument();
  });

  it("creates a ticket in a column via the column action", async () => {
    const user = userEvent.setup();
    boardApi.createTicket.mockResolvedValue([
      ...buildBoard().tickets,
      {
        id: "ticket-2",
        columnId: "col-todo",
        title: "Neue Aufgabe",
        description: null,
        assigneeId: null,
        position: 0,
        createdBy: employeeUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");

    const todoColumn = screen.getByText("Zu erledigen").closest("section") as HTMLElement;
    fireEvent.click(within(todoColumn).getByRole("button", { name: "Ticket hinzufügen" }));
    const dialog = await screen.findByRole("dialog");
    const titleInput = within(dialog).getByLabelText("Titel");
    await user.type(titleInput, "Neue Aufgabe");
    await user.click(within(dialog).getByRole("button", { name: "Anlegen" }));

    await waitFor(() => expect(boardApi.createTicket).toHaveBeenCalledWith({
      columnId: "col-todo",
      title: "Neue Aufgabe",
      description: null,
    }));
    expect(await screen.findByText("Neue Aufgabe")).toBeInTheDocument();
  });

  it("opens the edit dialog and saves changes", async () => {
    const user = userEvent.setup();
    boardApi.updateTicket.mockResolvedValue([{ ...buildBoard().tickets[0], title: "Angebot überarbeiten" }]);
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");
    const ticketCard = screen.getByText("Angebot schreiben").closest("article");
    expect(ticketCard).not.toBeNull();
    fireEvent.click(ticketCard as HTMLElement);

    const dialog = await screen.findByRole("dialog");
    const titleInput = within(dialog).getByDisplayValue("Angebot schreiben");
    await user.clear(titleInput);
    await user.type(titleInput, "Angebot überarbeiten");
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(boardApi.updateTicket).toHaveBeenCalledWith("ticket-1", expect.objectContaining({
      title: "Angebot überarbeiten",
    })));
  });

  it("deletes a ticket after confirmation", async () => {
    boardApi.deleteTicket.mockResolvedValue([]);
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");

    await screen.findByText("Angebot schreiben");
    fireEvent.click(screen.getByRole("button", { name: "Ticket löschen" }));
    const deleteDialogTitle = await screen.findByText("Ticket löschen?");
    const deleteDialog = deleteDialogTitle.closest('[role="dialog"]') as HTMLElement;
    const confirmDeleteButton = within(deleteDialog)
      .getAllByRole("button", { hidden: true })
      .find((button) => button.textContent === "Löschen");
    expect(confirmDeleteButton).toBeDefined();
    fireEvent.click(confirmDeleteButton as HTMLElement);

    await waitFor(() => expect(boardApi.deleteTicket).toHaveBeenCalledWith("ticket-1"));
  });

  it("shows the add-column action for authenticated users", async () => {
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");
    expect(screen.getByRole("button", { name: "Spalte hinzufügen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Archiv anzeigen \(0\)/ })).toBeInTheDocument();
  });

  it("filters tickets via the search field", async () => {
    const user = userEvent.setup();
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");

    await user.type(screen.getByPlaceholderText("Tickets durchsuchen"), "Feedback");

    expect(screen.queryByText("Angebot schreiben")).not.toBeInTheDocument();
  });

  it("shows the column rename/delete actions for authenticated users", async () => {
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");
    expect(screen.getAllByRole("button", { name: "Spalte umbenennen" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Spalte löschen" }).length).toBeGreaterThan(0);
  });

  it("renames a column via the rename dialog", async () => {
    const user = userEvent.setup();
    const board = buildBoard();
    boardApi.renameColumn.mockResolvedValue([
      { ...board.columns[0], title: "Backlog" },
      board.columns[1],
    ]);
    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");

    const todoColumn = screen.getByText("Zu erledigen").closest("section") as HTMLElement;
    fireEvent.click(within(todoColumn).getByRole("button", { name: "Spalte umbenennen" }));

    const dialog = await screen.findByRole("dialog");
    const titleInput = within(dialog).getByDisplayValue("Zu erledigen");
    await user.clear(titleInput);
    await user.type(titleInput, "Backlog");
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(boardApi.renameColumn).toHaveBeenCalledWith("col-todo", "Backlog"));
    expect(await screen.findByText("Backlog")).toBeInTheDocument();
  });

  it("deletes an empty column after confirmation", async () => {
    const user = userEvent.setup();
    const board = buildBoard();
    boardApi.deleteColumn.mockResolvedValue([board.columns[0]]);
    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");

    const doingColumn = screen.getByText("In Arbeit").closest("section") as HTMLElement;
    fireEvent.click(within(doingColumn).getByRole("button", { name: "Spalte löschen" }));

    const deleteDialog = await screen.findByRole("dialog");
    const deleteButton = within(deleteDialog).getAllByRole("button").find((button) => button.textContent === "Löschen");
    await user.click(deleteButton as HTMLElement);

    await waitFor(() => expect(boardApi.deleteColumn).toHaveBeenCalledWith("col-doing"));
    await waitFor(() => expect(screen.queryByText("In Arbeit")).not.toBeInTheDocument());
  });

  it("disables deleting a non-empty column", async () => {
    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");

    const backlogColumn = screen.getByText("Backlog").closest("section") as HTMLElement;
    const deleteButton = within(backlogColumn).getByRole("button", { name: "Spalte löschen" });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("title", "Spalte kann nur gelöscht werden, wenn sie leer ist.");
  });

  it("archives finished tickets from the done column", async () => {
    const user = userEvent.setup();
    const board = buildBoard();
    board.tickets.push({
      id: "ticket-2",
      columnId: "col-done",
      title: "Abgeschlossen",
      description: null,
      assigneeId: null,
      position: 0,
      createdBy: employeeUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    boardApi.get.mockResolvedValue(board);
    boardApi.archiveTickets.mockResolvedValue([buildBoard().tickets[0]]);
    renderBoard(employeeUser);
    await screen.findByText("Abgeschlossen");

    const doneColumn = screen.getByText("Erledigt").closest("section") as HTMLElement;
    await user.click(within(doneColumn).getByRole("button", { name: "Archivieren" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Bestätigen" }));

    await waitFor(() => expect(boardApi.archiveTickets).toHaveBeenCalledWith("col-done"));
  });

});
