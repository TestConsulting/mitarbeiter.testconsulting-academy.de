import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import type { ArchivedTicket, BoardColumn, Ticket } from "@portal/shared";
import type { BoardRepository } from "../db/board-repository.js";
import type { StoredUser, UserRepository } from "../db/user-repository.js";

export type BoardFixture = {
  adminUser: StoredUser;
  employeeUser: StoredUser;
  users: UserRepository;
  columns: BoardColumn[];
  tickets: Ticket[];
  board: BoardRepository;
};

const SHARED_PASSWORD = "correct-horse-battery";

export async function createBoardFixture(): Promise<BoardFixture> {
  const passwordHash = await argon2.hash(SHARED_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const adminUser: StoredUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.test",
    name: "Admina Example",
    role: "admin",
    passwordHash,
  };
  const employeeUser: StoredUser = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "employee@example.test",
    name: "Employa Example",
    role: "employee",
    passwordHash,
  };

  let columns: BoardColumn[] = [{ id: randomUUID(), title: "Zu erledigen", position: 0 }];
  let tickets: Ticket[] = [];
  let archivedTickets: ArchivedTicket[] = [];
  const allUsers: StoredUser[] = [adminUser, employeeUser];

  const users: UserRepository = {
    async findByEmail(email) {
      return allUsers.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    async findById(id) {
      const match = allUsers.find((user) => user.id === id);
      if (!match) return null;
      const { passwordHash: _passwordHash, ...publicUser } = match;
      return publicUser;
    },
    async findByIdWithPasswordHash(id) {
      return allUsers.find((user) => user.id === id) ?? null;
    },
    async updatePasswordHash(id, passwordHash) {
      const match = allUsers.find((user) => user.id === id);
      if (!match) return false;
      match.passwordHash = passwordHash;
      return true;
    },
    async listAll() {
      return allUsers.map(({ passwordHash: _passwordHash, ...publicUser }) => publicUser);
    },
    async create(input) {
      const stored: StoredUser = {
        id: randomUUID(),
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: input.passwordHash,
      };
      allUsers.push(stored);
      const { passwordHash: _passwordHash, ...publicUser } = stored;
      return publicUser;
    },
    async update(id, input) {
      const match = allUsers.find((user) => user.id === id);
      if (!match) return null;
      if (input.email !== undefined) match.email = input.email;
      if (input.name !== undefined) match.name = input.name;
      if (input.role !== undefined) match.role = input.role;
      if (input.passwordHash !== undefined) match.passwordHash = input.passwordHash;
      const { passwordHash: _passwordHash, ...publicUser } = match;
      return publicUser;
    },
    async delete(id) {
      const index = allUsers.findIndex((user) => user.id === id);
      if (index === -1) return false;
      allUsers.splice(index, 1);
      return true;
    },
  };

  const board: BoardRepository = {
    async getBoard() {
      return {
        columns: columns.map((column) => ({ ...column })),
        tickets: tickets.map((ticket) => ({ ...ticket })),
      };
    },
    async createColumn(title) {
      columns.push({ id: randomUUID(), title, position: columns.length });
      return columns.map((column) => ({ ...column }));
    },
    async updateColumn(id, patch) {
      const column = columns.find((entry) => entry.id === id);
      if (!column) return "not-found";
      if (patch.title !== undefined) column.title = patch.title;
      return columns.map((entry) => ({ ...entry }));
    },
    async deleteColumn(id) {
      const column = columns.find((entry) => entry.id === id);
      if (!column) return "not-found";
      if (tickets.some((ticket) => ticket.columnId === id)) return "not-empty";
      columns = columns.filter((entry) => entry.id !== id);
      return columns.map((entry) => ({ ...entry }));
    },
    async createTicket(input) {
      if (!columns.some((column) => column.id === input.columnId)) return "column-not-found";
      const now = new Date().toISOString();
      tickets.push({
        id: randomUUID(),
        columnId: input.columnId,
        title: input.title,
        description: input.description ?? null,
        assigneeId: input.assigneeId ?? null,
        priority: input.priority ?? "normal",
        position: tickets.filter((ticket) => ticket.columnId === input.columnId).length,
        createdBy: input.createdBy,
        createdAt: now,
        updatedAt: now,
      });
      return tickets.map((ticket) => ({ ...ticket }));
    },
    async listArchivedTickets() {
      return archivedTickets.map((ticket) => ({ ...ticket }));
    },
    async archiveTickets(columnId) {
      const column = columns.find((entry) => entry.id === columnId);
      if (!column) return "column-not-found";
      const normalized = column.title.trim().toLowerCase();
      if (!["erledigt", "done", "fertig"].includes(normalized)) return "invalid-column";
      const now = new Date().toISOString();
      const toArchive = tickets
        .filter((ticket) => ticket.columnId === columnId)
        .map((ticket) => ({ ...ticket, archivedAt: now }));
      archivedTickets = [...toArchive, ...archivedTickets];
      tickets = tickets.filter((ticket) => ticket.columnId !== columnId);
      return tickets.map((ticket) => ({ ...ticket }));
    },
    async archiveTicket(id) {
      const ticket = tickets.find((entry) => entry.id === id);
      if (!ticket) return "not-found";
      const column = columns.find((entry) => entry.id === ticket.columnId);
      const normalized = column?.title.trim().toLowerCase() ?? "";
      if (!["erledigt", "done", "fertig"].includes(normalized)) return "invalid-column";
      const archivedAt = new Date().toISOString();
      archivedTickets = [{ ...ticket, archivedAt }, ...archivedTickets];
      tickets = tickets.filter((entry) => entry.id !== id);
      return tickets.map((entry) => ({ ...entry }));
    },
    async restoreTicket(id, columnId) {
      const archived = archivedTickets.find((entry) => entry.id === id);
      if (!archived) return "not-found";
      const targetColumnId = columnId ?? columns[0]?.id;
      if (!targetColumnId || !columns.some((column) => column.id === targetColumnId)) return "column-not-found";
      archivedTickets = archivedTickets.filter((entry) => entry.id !== id);
      tickets.push({
        id: archived.id,
        columnId: targetColumnId,
        title: archived.title,
        description: archived.description,
        assigneeId: archived.assigneeId,
        priority: archived.priority,
        position: tickets.filter((ticket) => ticket.columnId === targetColumnId).length,
        createdBy: archived.createdBy,
        createdAt: archived.createdAt,
        updatedAt: new Date().toISOString(),
      });
      return tickets.map((ticket) => ({ ...ticket }));
    },
    async updateTicket(id, patch) {
      const ticket = tickets.find((entry) => entry.id === id);
      if (!ticket) return "not-found";
      if (patch.columnId !== undefined && !columns.some((column) => column.id === patch.columnId)) {
        return "column-not-found";
      }
      if (patch.title !== undefined) ticket.title = patch.title;
      if (patch.description !== undefined) ticket.description = patch.description;
      if (patch.assigneeId !== undefined) ticket.assigneeId = patch.assigneeId;
      if (patch.priority !== undefined) ticket.priority = patch.priority;
      if (patch.columnId !== undefined) ticket.columnId = patch.columnId;
      if (patch.position !== undefined) ticket.position = patch.position;
      ticket.updatedAt = new Date().toISOString();
      return tickets.map((entry) => ({ ...entry }));
    },
    async deleteTicket(id) {
      if (!tickets.some((entry) => entry.id === id)) return "not-found";
      tickets = tickets.filter((entry) => entry.id !== id);
      return tickets.map((entry) => ({ ...entry }));
    },
  };

  return {
    adminUser,
    employeeUser,
    users,
    get columns() {
      return columns;
    },
    get tickets() {
      return tickets;
    },
    board,
  };
}

export const BOARD_FIXTURE_PASSWORD = SHARED_PASSWORD;
