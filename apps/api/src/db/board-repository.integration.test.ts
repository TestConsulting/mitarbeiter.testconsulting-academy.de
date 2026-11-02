import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBoardRepository } from "./board-repository.js";

describe.skipIf(process.env.RUN_BOARD_DB_TESTS !== "1")("tickets with PostgreSQL", () => {
  const schema = `board_test_${randomUUID().replaceAll("-", "")}`;
  const userId = randomUUID();
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const database = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema},public -c timezone=Pacific/Honolulu -c datestyle=ISO,MDY`,
  });
  const repository = createBoardRepository(database);

  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await database.query("CREATE TABLE users (id uuid PRIMARY KEY)");
    await database.query("INSERT INTO users (id) VALUES ($1)", [userId]);
    for (const migration of ["002_create_board.sql", "003_add_ticket_archiving.sql", "012_add_ticket_priority.sql"]) {
      await database.query(await readFile(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
    }
    await database.query(
      "INSERT INTO tickets (column_id, title, position, created_by) SELECT id, 'Existing ticket', 0, $1 FROM board_columns WHERE title = 'Backlog'",
      [userId],
    );
    const migration = await readFile(new URL("../../migrations/014_add_ticket_due_date.sql", import.meta.url), "utf8");
    await database.query(migration);
    await database.query(migration);
  });

  afterAll(async () => {
    await database.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });

  it.each([0, 1, 2])("preserves ticket order when editing position %i", async (position) => {
    const columns = await repository.createColumn(`Edit position ${position}`);
    const columnId = columns.at(-1)!.id;
    for (const title of ["First", "Middle", "Last"]) {
      await repository.createTicket({ columnId, title, createdBy: userId });
    }
    const before = (await repository.getBoard()).tickets.filter((ticket) => ticket.columnId === columnId);
    const ticketId = before[position].id;
    const expectedOrder = before.map(({ id, position }) => ({ id, position }));

    for (const columnPatch of [{}, { columnId }]) {
      const updated = await repository.updateTicket(ticketId, {
        title: "Edited ticket",
        description: "Updated details",
        assigneeId: userId,
        priority: "urgent",
        dueDate: "2030-11-05",
        ...columnPatch,
      });
      if (typeof updated === "string") throw new Error(updated);
      expect(updated.find((ticket) => ticket.id === ticketId)).toMatchObject({
        title: "Edited ticket",
        description: "Updated details",
        assigneeId: userId,
        priority: "urgent",
        dueDate: "2030-11-05",
      });
      expect(updated.filter((ticket) => ticket.columnId === columnId).map(({ id, position }) => ({ id, position })))
        .toEqual(expectedOrder);
      expect((await repository.getBoard()).tickets.filter((ticket) => ticket.columnId === columnId)
        .map(({ id, position }) => ({ id, position }))).toEqual(expectedOrder);
    }
  });

  it("still reorders tickets explicitly and appends tickets moved to another column", async () => {
    const columns = await repository.createColumn("Reordering");
    const columnId = columns.at(-1)!.id;
    const targetColumnId = columns.find((column) => column.title === "Backlog")!.id;
    for (const title of ["First", "Middle", "Last"]) {
      await repository.createTicket({ columnId, title, createdBy: userId });
    }
    const before = (await repository.getBoard()).tickets.filter((ticket) => ticket.columnId === columnId);
    const ticketId = before[0].id;
    const reordered = await repository.updateTicket(ticketId, { columnId, position: 1 });
    if (typeof reordered === "string") throw new Error(reordered);
    expect(reordered.filter((ticket) => ticket.columnId === columnId).map((ticket) => ticket.id))
      .toEqual([before[1].id, ticketId, before[2].id]);

    const moved = await repository.updateTicket(ticketId, { columnId: targetColumnId });
    if (typeof moved === "string") throw new Error(moved);
    const targetTickets = moved.filter((ticket) => ticket.columnId === targetColumnId);
    expect(targetTickets.at(-1)).toMatchObject({ id: ticketId, position: targetTickets.length - 1 });
    expect(moved.filter((ticket) => ticket.columnId === columnId).map(({ id, position }) => ({ id, position })))
      .toEqual([{ id: before[1].id, position: 0 }, { id: before[2].id, position: 1 }]);
  });

  it("migrates existing tickets without a default and preserves dates through the ticket lifecycle", async () => {
    const board = await repository.getBoard();
    expect(board.tickets.find((ticket) => ticket.title === "Existing ticket")?.dueDate).toBeNull();
    const backlog = board.columns.find((column) => column.title === "Backlog")!;
    const done = board.columns.find((column) => column.title === "Erledigt")!;
    const created = await repository.createTicket({
      columnId: backlog.id, title: "Dated ticket", createdBy: userId, dueDate: "2028-02-29",
    });
    if (typeof created === "string") throw new Error(created);
    const ticket = created.find((entry) => entry.title === "Dated ticket")!;
    expect(ticket.dueDate).toBe("2028-02-29");
    expect((await repository.getBoard()).tickets.find((entry) => entry.id === ticket.id)?.dueDate).toBe("2028-02-29");
    await repository.updateTicket(ticket.id, { dueDate: "2030-11-05" });
    await repository.updateTicket(ticket.id, { columnId: done.id, position: 0 });
    await repository.archiveTicket(ticket.id);
    expect((await repository.listArchivedTickets())[0]).toMatchObject({ id: ticket.id, dueDate: "2030-11-05" });
    const restored = await repository.restoreTicket(ticket.id, backlog.id);
    if (typeof restored === "string") throw new Error(restored);
    expect(restored.find((entry) => entry.id === ticket.id)?.dueDate).toBe("2030-11-05");
    const cleared = await repository.updateTicket(ticket.id, { dueDate: null });
    if (typeof cleared === "string") throw new Error(cleared);
    expect(cleared.find((entry) => entry.id === ticket.id)?.dueDate).toBeNull();
  });
});
