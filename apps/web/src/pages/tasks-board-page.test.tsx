import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardState, PortalUser } from "@portal/shared";
import { AuthProvider } from "../app/auth-context.js";
import { TasksBoardPage } from "./tasks-board-page.js";
import { localDateKey } from "./ticket-due-date.js";

const employeeUser: PortalUser = { id: "u1", email: "alex@example.test", name: "Alex Beispiel", role: "employee" };
const adminUser: PortalUser = { id: "u2", email: "admina@example.test", name: "Admina Beispiel", role: "admin" };

const boardApi = vi.hoisted(() => ({
  get: vi.fn(),
  createColumn: vi.fn(),
  createTicket: vi.fn(),
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
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
  boardApi.listAttachments.mockReset();
  boardApi.uploadAttachment.mockReset();
  boardApi.deleteAttachment.mockReset();
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
  boardApi.listAttachments.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1024 });
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

  it.each([1024, 390])("combines ownership, priority and the existing search at width %i", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
    const board = buildBoard();
    const ticket = board.tickets[0];
    board.tickets = [
      { ...ticket, id: "own-high", title: "Eigene Analyse", description: "Suchbegriff", priority: "high" },
      { ...ticket, id: "own-normal", title: "Eigene Aufgabe" },
      { ...ticket, id: "other-high", title: "Andere Analyse", assigneeId: adminUser.id, priority: "high" },
      { ...ticket, id: "unassigned", title: "Unzugewiesene Analyse", assigneeId: null, priority: "urgent" },
    ];
    boardApi.get.mockResolvedValue(board);
    renderBoard(employeeUser);
    await screen.findByText("Eigene Analyse");

    fireEvent.click(screen.getByRole("button", { name: "Meine Tickets" }));
    expect(screen.getByText("Eigene Aufgabe")).toBeInTheDocument();
    expect(screen.queryByText("Andere Analyse")).not.toBeInTheDocument();
    expect(screen.queryByText("Unzugewiesene Analyse")).not.toBeInTheDocument();

    const priority = screen.getByRole("combobox", { name: "Priorität" });
    fireEvent.change(priority, { target: { value: "high" } });
    expect(screen.getByText("Eigene Analyse")).toBeInTheDocument();
    expect(screen.queryByText("Eigene Aufgabe")).not.toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "Tickets durchsuchen" });
    fireEvent.change(search, { target: { value: "Suchbegriff" } });
    expect(screen.getByText("Eigene Analyse")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "Nicht vorhanden" } });
    expect(screen.queryByText("Eigene Analyse")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Alle Tickets" }));
    expect(screen.getByText("Andere Analyse")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: adminUser.name } });
    expect(screen.getByText("Andere Analyse")).toBeInTheDocument();
    expect(screen.queryByText("Eigene Analyse")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(priority, { target: { value: "normal" } });
    expect(screen.getByText("Eigene Aufgabe")).toBeInTheDocument();
    expect(screen.queryByText("Eigene Analyse")).not.toBeInTheDocument();
    if (width < 768) {
      expect(screen.getByRole("button", { name: "Ticket verschieben" })).toBeDisabled();
      expect(screen.getAllByRole("tab")).toHaveLength(board.columns.length);
    } else {
      expect(screen.getByText("Eigene Aufgabe").closest(".ticket-card")).toHaveAttribute("aria-disabled", "true");
      for (const column of board.columns) {
        expect(screen.getByRole("heading", { name: column.title })).toBeInTheDocument();
      }
    }

    fireEvent.change(priority, { target: { value: "all" } });
    for (const item of board.tickets) expect(screen.getByText(item.title)).toBeInTheDocument();
    if (width < 768) {
      for (const handle of screen.getAllByRole("button", { name: "Ticket verschieben" })) {
        expect(handle).toBeEnabled();
      }
    }
    expect(boardApi.updateTicket).not.toHaveBeenCalled();
  });

  it.each([1024, 390])("filters only unfinished overdue tickets and keeps the global count at width %i", async (width) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2030, 10, 5, 12));
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
    const board = buildBoard();
    const ticket = board.tickets[0];
    board.columns[4].title = " Fertig ";
    board.tickets = [
      { ...ticket, id: "late-own", title: "Eigene überfällige Aufgabe", dueDate: "2030-11-04", priority: "high" },
      { ...ticket, id: "late-other", title: "Andere überfällige Aufgabe", dueDate: "2030-11-03", assigneeId: adminUser.id },
      { ...ticket, id: "today", title: "Heute bearbeiten", dueDate: localDateKey(new Date()) },
      { ...ticket, id: "future", title: "Morgen bearbeiten", dueDate: "2030-11-06" },
      { ...ticket, id: "undated", title: "Ohne Termin", dueDate: null },
      { ...ticket, id: "done", title: "Bereits abgeschlossen", dueDate: "2030-11-01", columnId: "col-done" },
    ];
    boardApi.get.mockResolvedValue(board);
    renderBoard(employeeUser);
    const overdue = await screen.findByRole("button", { name: "Überfällig (2)" });
    fireEvent.click(overdue);
    expect(overdue).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Eigene überfällige Aufgabe")).toBeInTheDocument();
    expect(screen.getByText("Andere überfällige Aufgabe")).toBeInTheDocument();
    for (const title of ["Heute bearbeiten", "Morgen bearbeiten", "Ohne Termin", "Bereits abgeschlossen"]) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
    fireEvent.change(screen.getByRole("combobox", { name: "Priorität" }), { target: { value: "high" } });
    expect(screen.queryByText("Andere überfällige Aufgabe")).not.toBeInTheDocument();
    expect(overdue).toHaveAccessibleName("Überfällig (2)");
    expect(screen.getByText("Eigene überfällige Aufgabe")).toBeInTheDocument();
  });

  it("updates the overdue filter at local midnight without reloading the board", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 10, 5, 23, 59, 59));
    const board = buildBoard();
    board.tickets[0].dueDate = "2030-11-05";
    boardApi.get.mockResolvedValue(board);
    await act(async () => { renderBoard(employeeUser); });
    fireEvent.click(screen.getByRole("button", { name: "Überfällig (0)" }));
    expect(screen.queryByText("Angebot schreiben")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("button", { name: "Überfällig (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Angebot schreiben")).toBeInTheDocument();
    expect(boardApi.get).toHaveBeenCalledTimes(1);
  });

  it("does not allow deleting a populated mobile column when filters hide its tickets", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");
    fireEvent.click(screen.getByRole("button", { name: "Meine Tickets" }));
    expect(screen.queryByText("Angebot schreiben")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Spalte Backlog löschen" })).toBeDisabled();
  });

  it.each([1024, 390])("toggles the persisted blocked flag without opening the dialog and restores it after remount at width %i", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
    const user = userEvent.setup();
    const board = buildBoard();
    boardApi.updateTicket.mockImplementation(async (id: string, patch: { blocked: boolean }) => {
      board.tickets = board.tickets.map((ticket) => ticket.id === id ? { ...ticket, ...patch } : ticket);
      return [...board.tickets];
    });
    const view = renderBoard(employeeUser);
    const blockButton = await screen.findByRole("button", { name: "Ticket blockieren" });
    const card = blockButton.closest<HTMLElement>(".ticket-card, .mobile-ticket-card")!;
    expect(blockButton.nextElementSibling).toHaveAttribute("aria-label", width < 768 ? "Ticket verschieben" : "Ticket bearbeiten");
    blockButton.focus();
    await user.keyboard("{Enter}");
    expect(await within(card).findByText("Blockiert")).toBeInTheDocument();
    expect(boardApi.updateTicket).toHaveBeenLastCalledWith("ticket-1", { blocked: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.unmount();
    boardApi.get.mockResolvedValue(board);
    renderBoard(employeeUser);
    expect(await screen.findByText("Blockiert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Blockierung aufheben" }));
    await waitFor(() => expect(screen.queryByText("Blockiert")).not.toBeInTheDocument());
    expect(boardApi.updateTicket).toHaveBeenLastCalledWith("ticket-1", { blocked: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([1024, 390])("shows failed blocking on the card, preserves the status and permits retry at width %i", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
    boardApi.updateTicket.mockRejectedValueOnce(new Error("offline"));
    renderBoard(employeeUser);
    fireEvent.click(await screen.findByRole("button", { name: "Ticket blockieren" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Die Blockierung konnte nicht gespeichert werden.");
    expect(screen.queryByText("Blockiert")).not.toBeInTheDocument();
    const board = buildBoard();
    board.tickets[0].blocked = true;
    let finish!: (tickets: BoardState["tickets"]) => void;
    boardApi.updateTicket.mockReturnValueOnce(new Promise<BoardState["tickets"]>((resolve) => { finish = resolve; }));
    const retry = screen.getByRole("button", { name: "Ticket blockieren" });
    fireEvent.click(retry);
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(boardApi.updateTicket).toHaveBeenCalledTimes(2);
    finish(board.tickets);
    expect(await screen.findByText("Blockiert")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens the edit dialog from a mobile ticket card and keeps the ticket metadata visible", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
    const board = buildBoard();
    board.tickets = [{
      ...board.tickets[0],
      title: "Angebot schreiben",
      description: "Vertrag prüfen und überarbeiten",
      type: "feature",
      priority: "high",
      dueDate: "2026-11-25",
      assigneeId: employeeUser.id,
      blocked: true,
    }];
    boardApi.get.mockResolvedValue(board);

    renderBoard(adminUser);
    expect(await screen.findByRole("tab", { name: /Backlog/i })).toBeInTheDocument();
    expect(await screen.findByText("Vertrag prüfen und überarbeiten")).toBeInTheDocument();
    expect(screen.getByText("Blockiert")).toBeInTheDocument();

    const card = screen.getByText("Angebot schreiben").closest(".mobile-ticket-card");
    expect(card).not.toBeNull();
    fireEvent.click(card as HTMLElement);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByDisplayValue("Angebot schreiben")).toBeInTheDocument();
    expect(within(dialog).getByText("Feature")).toBeInTheDocument();
    expect(within(dialog).getByText("Hoch")).toBeInTheDocument();
  });

  it("scrolls the selected mobile tab into view", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    renderBoard(adminUser);
    const tab = await screen.findByRole("tab", { name: /Zu erledigen/i });
    fireEvent.click(tab);

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it.each([
    { endEvent: "pointerup", emitsClick: false },
    { endEvent: "pointercancel", emitsClick: false },
    { endEvent: "pointerup", emitsClick: true },
  ])("selects a mobile column on the first tap after a swipe ending with $endEvent (click: $emitsClick)", async ({ endEvent, emitsClick }) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 390 });
    renderBoard(employeeUser);
    const tab = await screen.findByRole("tab", { name: /^Zu erledigen/ });
    const tablist = screen.getByRole("tablist", { name: "Board-Spalten" });
    const dispatchPointer = (type: string, clientX: number) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        pointerType: { value: "touch" },
      });
      fireEvent(tab, event);
    };

    dispatchPointer("pointerdown", 200);
    dispatchPointer("pointermove", 80);
    dispatchPointer(endEvent, 80);
    if (emitsClick) fireEvent.click(tab, { detail: 1 });
    expect(tablist.scrollLeft).toBe(120);
    expect(tab).toHaveAttribute("aria-selected", "false");

    dispatchPointer("pointerdown", 80);
    dispatchPointer("pointerup", 80);
    fireEvent.click(tab, { detail: 1 });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Zu erledigen" })).toBeInTheDocument();
  });

  it("applies the shared search filter to the visible mobile ticket list", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
    const board = buildBoard();
    board.tickets = [
      { ...board.tickets[0], id: "ticket-alpha", title: "Alpha Aufgabe", description: "Erste Aufgabe", columnId: "col-backlog" },
      { ...board.tickets[0], id: "ticket-beta", title: "Beta Aufgabe", description: "Zweite Aufgabe", columnId: "col-backlog" },
    ];
    boardApi.get.mockResolvedValue(board);

    renderBoard(adminUser);
    const searchInput = await screen.findByPlaceholderText("Tickets durchsuchen");
    fireEvent.change(searchInput, { target: { value: "Zweite" } });

    await waitFor(() => {
      expect(screen.getByText("Beta Aufgabe")).toBeInTheDocument();
    });
    expect(screen.queryByText("Alpha Aufgabe")).not.toBeInTheDocument();
  });

  it("shows the compact column actions in the mobile board for admins", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
    renderBoard(adminUser);

    const renameButton = await screen.findByRole("button", { name: /Spalte Backlog umbenennen/i });
    const deleteButton = screen.getByRole("button", { name: /Spalte Backlog löschen/i });

    expect(renameButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it("keeps the mobile tab strip horizontally scrollable and prevents tabs from shrinking", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
    const board = buildBoard();
    board.columns = Array.from({ length: 10 }, (_, index) => ({
      id: `col-${index}`,
      title: `Status ${index + 1}`,
      position: index,
    }));
    board.tickets = [];
    boardApi.get.mockResolvedValue(board);

    renderBoard(adminUser);
    const tablist = await screen.findByRole("tablist", { name: /Board-Spalten/i });
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));

    expect(window.getComputedStyle(tablist).overflowX).toBe("auto");
    expect(Array.from(tabs).every((tab) => window.getComputedStyle(tab).flex === "0 0 auto")).toBe(true);
    expect(tabs.length).toBeGreaterThanOrEqual(10);
  });

  it("registers every mobile status tab as a valid column drop target", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
    const board = buildBoard();
    board.columns = Array.from({ length: 10 }, (_, index) => ({
      id: `drop-col-${index}`,
      title: `Status ${index + 1}`,
      position: index,
    }));
    board.tickets = [];
    boardApi.get.mockResolvedValue(board);

    renderBoard(adminUser);
    const tablist = await screen.findByRole("tablist", { name: /Board-Spalten/i });
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));

    expect(tabs.length).toBeGreaterThanOrEqual(10);
    expect(tabs.every((tab) => tab.getAttribute("data-column-id") !== null)).toBe(true);
  });

  it("creates a ticket in a column via the column action", async () => {
    const user = userEvent.setup();
    boardApi.createTicket.mockResolvedValue({ createdTicketId: "ticket-2", tickets: [
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
    ] });
    renderBoard(adminUser);
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

  it("uploads selected files when creating a ticket and rejects oversized files", async () => {
    const user = userEvent.setup();
    boardApi.createTicket.mockResolvedValue({ createdTicketId: "ticket-2", tickets: buildBoard().tickets });
    boardApi.uploadAttachment.mockResolvedValue({ id: "a1", fileName: "test.pdf", size: 5, contentType: "application/pdf" });
    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");
    const column = screen.getByText("Zu erledigen").closest("section") as HTMLElement;
    await user.click(within(column).getByRole("button", { name: "Ticket hinzufügen" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Titel"), "Ticket");
    const input = within(dialog).getByLabelText("Anhänge auswählen");
    await user.upload(input, new File([new Uint8Array(20 * 1024 * 1024 + 1)], "gross.pdf", { type: "application/pdf" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("maximal 20 MB");
    const file = new File(["%PDF-"], "test.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    await user.click(within(dialog).getByRole("button", { name: "Anlegen" }));
    await waitFor(() => expect(boardApi.uploadAttachment).toHaveBeenCalledWith("ticket-2", file));
  });

  it("removes existing attachments only when saving the edited ticket", async () => {
    const user = userEvent.setup();
    boardApi.listAttachments.mockResolvedValue([{ id: "a1", fileName: "datei.pdf", size: 5, contentType: "application/pdf" }]);
    boardApi.updateTicket.mockResolvedValue(buildBoard().tickets);
    boardApi.deleteAttachment.mockResolvedValue({ success: true });
    renderBoard(employeeUser);
    fireEvent.click((await screen.findByText("Angebot schreiben")).closest("article") as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: "datei.pdf entfernen" }));
    expect(boardApi.deleteAttachment).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(boardApi.deleteAttachment).toHaveBeenCalledWith("ticket-1", "a1"));
  });

  it("discards attachment removal when the edit dialog is cancelled", async () => {
    const user = userEvent.setup();
    boardApi.listAttachments.mockResolvedValue([{ id: "a1", fileName: "datei.pdf", size: 5, contentType: "application/pdf" }]);
    renderBoard(adminUser);
    fireEvent.click((await screen.findByText("Angebot schreiben")).closest("article") as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: "datei.pdf entfernen" }));
    await user.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(boardApi.deleteAttachment).not.toHaveBeenCalled();
  });

  it("retries a failed attachment upload without creating another ticket or uploading completed files again", async () => {
    const user = userEvent.setup();
    boardApi.createTicket.mockResolvedValue({ createdTicketId: "ticket-2", tickets: buildBoard().tickets });
    boardApi.updateTicket.mockResolvedValue(buildBoard().tickets);
    boardApi.uploadAttachment
      .mockResolvedValueOnce({ id: "a1", fileName: "eins.pdf", size: 5, contentType: "application/pdf" })
      .mockRejectedValueOnce(new Error("Upload fehlgeschlagen"))
      .mockResolvedValueOnce({ id: "a2", fileName: "zwei.pdf", size: 5, contentType: "application/pdf" });
    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");
    const column = screen.getByText("Zu erledigen").closest("section") as HTMLElement;
    await user.click(within(column).getByRole("button", { name: "Ticket hinzufügen" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Titel"), "Ticket");
    const first = new File(["%PDF-"], "eins.pdf", { type: "application/pdf" });
    const second = new File(["%PDF-"], "zwei.pdf", { type: "application/pdf" });
    await user.upload(within(dialog).getByLabelText("Anhänge auswählen"), [first, second]);
    await user.click(within(dialog).getByRole("button", { name: "Anlegen" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ticket wurde angelegt");
    await user.click(within(dialog).getByRole("button", { name: "Erneut speichern" }));
    await waitFor(() => expect(boardApi.uploadAttachment).toHaveBeenCalledTimes(3));
    expect(boardApi.createTicket).toHaveBeenCalledTimes(1);
    expect(boardApi.uploadAttachment.mock.calls.map((call) => call[1])).toEqual([first, second, second]);
  });

  it("enforces the per-ticket attachment count and total size", async () => {
    const user = userEvent.setup();
    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");
    const column = screen.getByText("Zu erledigen").closest("section") as HTMLElement;
    await user.click(within(column).getByRole("button", { name: "Ticket hinzufügen" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Anhänge auswählen");
    await user.upload(input, Array.from({ length: 11 }, (_, i) => new File(["x"], `${i}.pdf`, { type: "application/pdf" })));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("höchstens 10 Anhänge");
    const largeFiles = Array.from({ length: 6 }, (_, i) => {
      const file = new File(["x"], `${i}.pdf`, { type: "application/pdf" });
      Object.defineProperty(file, "size", { value: 20 * 1024 * 1024 });
      return file;
    });
    await user.upload(input, largeFiles);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("höchstens 100 MB");
  });

  it("opens the edit dialog and saves changes", async () => {
    const user = userEvent.setup();
    boardApi.updateTicket.mockResolvedValue([{ ...buildBoard().tickets[0], title: "Angebot überarbeiten" }]);
    renderBoard(adminUser);
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
    renderBoard(adminUser);
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

  it("shows the add-column action for admins", async () => {
    renderBoard(adminUser);
    await screen.findByText("Angebot schreiben");
    expect(screen.getByRole("button", { name: "Spalte hinzufügen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Archiv anzeigen \(0\)/ })).toBeInTheDocument();
  });

  it("hides mutation actions for employees", async () => {
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");
    expect(screen.queryByRole("button", { name: "Spalte hinzufügen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ticket hinzufügen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Spalte umbenennen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ticket löschen" })).not.toBeInTheDocument();
  });

  it("filters tickets via the search field", async () => {
    const user = userEvent.setup();
    renderBoard(employeeUser);
    await screen.findByText("Angebot schreiben");

    await user.type(screen.getByPlaceholderText("Tickets durchsuchen"), "Feedback");

    expect(screen.queryByText("Angebot schreiben")).not.toBeInTheDocument();
  });

  it("shows the column rename/delete actions for admins", async () => {
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
      title: "Fertige Aufgabe",
      description: null,
      assigneeId: null,
      position: 0,
      createdBy: employeeUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    boardApi.get.mockResolvedValue(board);
    boardApi.archiveTickets.mockResolvedValue([buildBoard().tickets[0]]);
    renderBoard(adminUser);
    await screen.findByText("Fertige Aufgabe");
    expect(screen.getByText("Abgeschlossen")).toBeInTheDocument();

    const doneColumn = screen.getByText("Erledigt").closest("section") as HTMLElement;
    await user.click(within(doneColumn).getByRole("button", { name: "Archivieren" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Bestätigen" }));

    await waitFor(() => expect(boardApi.archiveTickets).toHaveBeenCalledWith("col-done"));
  });

});
