import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardState, PortalUser } from "@portal/shared";
import { AuthProvider } from "../app/auth-context.js";
import { TasksArchivePage } from "./tasks-archive-page.js";

const employeeUser: PortalUser = { id: "u1", email: "alex@example.test", name: "Alex Beispiel", role: "employee" };

const boardApi = vi.hoisted(() => ({
  get: vi.fn(),
  listArchivedTickets: vi.fn(),
  restoreTicket: vi.fn(),
}));
const usersApi = vi.hoisted(() => ({ list: vi.fn() }));
const authApi = vi.hoisted(() => ({ me: vi.fn(), login: vi.fn(), logout: vi.fn() }));

vi.mock("../api/client.js", () => ({
  api: {
    ...authApi,
    users: usersApi,
    board: {
      ...boardApi,
      createColumn: vi.fn(),
      createTicket: vi.fn(),
      archiveTickets: vi.fn(),
      archiveTicket: vi.fn(),
      updateTicket: vi.fn(),
      deleteTicket: vi.fn(),
      renameColumn: vi.fn(),
      deleteColumn: vi.fn(),
    },
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));

function buildBoard(): BoardState {
  return {
    columns: [
      { id: "col-backlog", title: "Backlog", position: 0 },
      { id: "col-done", title: "Erledigt", position: 1 },
    ],
    tickets: [],
  };
}

function renderArchive() {
  authApi.me.mockResolvedValue(employeeUser);
  usersApi.list.mockResolvedValue([employeeUser]);
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TasksArchivePage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  boardApi.get.mockReset();
  boardApi.listArchivedTickets.mockReset();
  boardApi.restoreTicket.mockReset();
  usersApi.list.mockReset();
  authApi.me.mockReset();

  boardApi.get.mockResolvedValue(buildBoard());
  boardApi.listArchivedTickets.mockResolvedValue([
    {
      id: "archived-1",
      columnId: "col-done",
      title: "Legacy Ticket",
      description: null,
      assigneeId: null,
      position: 0,
      createdBy: employeeUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: new Date().toISOString(),
    },
  ]);
  boardApi.restoreTicket.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("tasks archive page", () => {
  it("shows archived tickets", async () => {
    renderArchive();
    expect(await screen.findByText("Legacy Ticket")).toBeInTheDocument();
  });

  it("filters archived tickets", async () => {
    const user = userEvent.setup();
    renderArchive();
    expect(await screen.findByText("Legacy Ticket")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Archiv durchsuchen"), "xyz");
    expect(screen.queryByText("Legacy Ticket")).not.toBeInTheDocument();
  });

  it("restores an archived ticket", async () => {
    const user = userEvent.setup();
    renderArchive();
    await screen.findByText("Legacy Ticket");

    await user.click(screen.getByRole("button", { name: "Wiederherstellen" }));
    await waitFor(() => expect(boardApi.restoreTicket).toHaveBeenCalledWith("archived-1"));
  });
});
