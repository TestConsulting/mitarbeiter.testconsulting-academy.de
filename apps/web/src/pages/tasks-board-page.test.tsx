import { render, screen, waitFor, within } from "@testing-library/react";
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
      { id: "col-todo", title: "Zu erledigen", position: 0 },
      { id: "col-doing", title: "In Arbeit", position: 1 },
    ],
    tickets: [
      {
        id: "ticket-1",
        columnId: "col-todo",
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
  boardApi.updateTicket.mockReset();
  boardApi.deleteTicket.mockReset();
  boardApi.renameColumn.mockReset();
  boardApi.deleteColumn.mockReset();
  usersApi.list.mockReset();
  authApi.me.mockReset();
  boardApi.get.mockResolvedValue(buildBoard());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("tasks board page", () => {
  it("renders columns and tickets from the server", async () => {
    renderBoard(employeeUser);
    expect(await screen.findByText("Angebot schreiben")).toBeInTheDocument();
    expect(screen.getByText("Zu erledigen")).toBeInTheDocument();
    expect(screen.getByText("In Arbeit")).toBeInTheDocument();
  });

  it("creates a ticket via the column composer", async () => {
    const user = userEvent.setup();
    boardApi.createTicket.mockResolvedValue([
      ...buildBoard().tickets,
      {
        id: "ticket-2",
        columnId: "col-todo",
        title: "Neue Aufgabe",
        description: null,
        assigneeId: null,
        position: 1,
        createdBy: employeeUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");

    const todoColumn = screen.getByText("Zu erledigen").closest("section") as HTMLElement;
    const composer = within(todoColumn).getByPlaceholderText("+ Karte hinzufügen");
    await user.type(composer, "Neue Aufgabe{Enter}");

    await waitFor(() => expect(boardApi.createTicket).toHaveBeenCalledWith({
      columnId: "col-todo",
      title: "Neue Aufgabe",
      assigneeId: null,
    }));
    expect(await screen.findByText("Neue Aufgabe")).toBeInTheDocument();
  });

  it("opens the edit dialog and saves changes", async () => {
    const user = userEvent.setup();
    boardApi.updateTicket.mockResolvedValue([{ ...buildBoard().tickets[0], title: "Angebot überarbeiten" }]);
    renderBoard(employeeUser);
    const card = await screen.findByText("Angebot schreiben");
    await user.click(card);

    const dialog = await screen.findByRole("heading", { name: "Ticket bearbeiten" });
    const dialogSurface = dialog.closest("div")?.parentElement as HTMLElement;
    const titleInput = within(dialogSurface).getByDisplayValue("Angebot schreiben");
    await user.clear(titleInput);
    await user.type(titleInput, "Angebot überarbeiten");
    await user.click(within(dialogSurface).getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(boardApi.updateTicket).toHaveBeenCalledWith("ticket-1", expect.objectContaining({
      title: "Angebot überarbeiten",
    })));
  });

  it("deletes a ticket after confirmation", async () => {
    const user = userEvent.setup();
    boardApi.deleteTicket.mockResolvedValue([]);
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");

    await user.click(screen.getByRole("button", { name: "Ticket löschen" }));
    await user.click(await screen.findByRole("button", { name: "Löschen" }));

    await waitFor(() => expect(boardApi.deleteTicket).toHaveBeenCalledWith("ticket-1"));
  });

  it("only shows the add-column action for admins", async () => {
    const { unmount } = renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");
    expect(screen.queryByRole("button", { name: "Spalte hinzufügen" })).not.toBeInTheDocument();
    unmount();

    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");
    expect(screen.getByRole("button", { name: "Spalte hinzufügen" })).toBeInTheDocument();
  });

  it("only shows the column rename/delete actions for admins", async () => {
    const { unmount } = renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");
    expect(screen.queryByRole("button", { name: "Spalte umbenennen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Spalte löschen" })).not.toBeInTheDocument();
    unmount();

    renderBoard(adminUser);
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
    await user.click(within(todoColumn).getByRole("button", { name: "Spalte umbenennen" }));

    const dialogHeading = await screen.findByRole("heading", { name: "Spalte umbenennen" });
    const dialogSurface = dialogHeading.closest("div")?.parentElement as HTMLElement;
    const titleInput = within(dialogSurface).getByDisplayValue("Zu erledigen");
    await user.clear(titleInput);
    await user.type(titleInput, "Backlog");
    await user.click(within(dialogSurface).getByRole("button", { name: "Speichern" }));

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
    await user.click(within(doingColumn).getByRole("button", { name: "Spalte löschen" }));

    const dialogHeading = await screen.findByRole("heading", { name: "Spalte löschen?" });
    const dialogSurface = dialogHeading.closest("div")?.parentElement as HTMLElement;
    await user.click(within(dialogSurface).getByRole("button", { name: "Löschen" }));

    await waitFor(() => expect(boardApi.deleteColumn).toHaveBeenCalledWith("col-doing"));
    await waitFor(() => expect(screen.queryByText("In Arbeit")).not.toBeInTheDocument());
  });

  it("shows an error message when deleting a non-empty column is rejected", async () => {
    const user = userEvent.setup();
    const { ApiError } = await import("../api/client.js");
    boardApi.deleteColumn.mockRejectedValue(
      new ApiError("Die Spalte enthält noch Tickets. Bitte zuerst verschieben.", 409),
    );
    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");

    const todoColumn = screen.getByText("Zu erledigen").closest("section") as HTMLElement;
    await user.click(within(todoColumn).getByRole("button", { name: "Spalte löschen" }));

    const dialogHeading = await screen.findByRole("heading", { name: "Spalte löschen?" });
    const dialogSurface = dialogHeading.closest("div")?.parentElement as HTMLElement;
    await user.click(within(dialogSurface).getByRole("button", { name: "Löschen" }));

    expect(await screen.findByText("Die Spalte enthält noch Tickets. Bitte zuerst verschieben.")).toBeInTheDocument();
    expect(screen.getByText("Zu erledigen")).toBeInTheDocument();
  });
});
