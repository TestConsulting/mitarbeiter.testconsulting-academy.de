import type { BoardColumn, Ticket } from "@portal/shared";
import type { Pool, PoolClient } from "pg";

type ColumnRow = { id: string; title: string; position: number };
type TicketRow = {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  position: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

function mapColumn(row: ColumnRow): BoardColumn {
  return { id: row.id, title: row.title, position: row.position };
}

function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    assigneeId: row.assignee_id,
    position: row.position,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export type NewTicketInput = {
  columnId: string;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  createdBy: string;
};

export type TicketPatch = {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  columnId?: string;
  position?: number;
};

export type ColumnPatch = {
  title?: string;
  position?: number;
};

export type DeleteColumnResult = BoardColumn[] | "not-found" | "not-empty";

export type BoardRepository = {
  getBoard(): Promise<{ columns: BoardColumn[]; tickets: Ticket[] }>;
  createColumn(title: string): Promise<BoardColumn[]>;
  updateColumn(id: string, patch: ColumnPatch): Promise<BoardColumn[] | "not-found">;
  deleteColumn(id: string): Promise<DeleteColumnResult>;
  createTicket(input: NewTicketInput): Promise<Ticket[] | "column-not-found">;
  updateTicket(id: string, patch: TicketPatch): Promise<Ticket[] | "not-found" | "column-not-found">;
  deleteTicket(id: string): Promise<Ticket[] | "not-found">;
};

async function listAllColumns(client: Pick<PoolClient, "query">): Promise<BoardColumn[]> {
  const result = await client.query<ColumnRow>(
    `SELECT id, title, position FROM board_columns ORDER BY position ASC`,
  );
  return result.rows.map(mapColumn);
}

async function listAllTickets(client: Pick<PoolClient, "query">): Promise<Ticket[]> {
  const result = await client.query<TicketRow>(
    `SELECT * FROM tickets ORDER BY column_id ASC, position ASC`,
  );
  return result.rows.map(mapTicket);
}

async function renumberColumnTickets(client: PoolClient, columnId: string): Promise<void> {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM tickets WHERE column_id = $1 ORDER BY position ASC`,
    [columnId],
  );
  for (const [index, row] of result.rows.entries()) {
    await client.query(`UPDATE tickets SET position = $1 WHERE id = $2`, [index, row.id]);
  }
}

export function createBoardRepository(pool: Pool): BoardRepository {
  return {
    async getBoard() {
      const [columns, tickets] = await Promise.all([listAllColumns(pool), listAllTickets(pool)]);
      return { columns, tickets };
    },

    async createColumn(title) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const max = await client.query<{ max: number | null }>(
          `SELECT MAX(position) AS max FROM board_columns`,
        );
        const position = (max.rows[0]?.max ?? -1) + 1;
        await client.query(`INSERT INTO board_columns (title, position) VALUES ($1, $2)`, [title, position]);
        const columns = await listAllColumns(client);
        await client.query("COMMIT");
        return columns;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateColumn(id, patch) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query(`SELECT id FROM board_columns WHERE id = $1`, [id]);
        if (existing.rowCount === 0) {
          await client.query("ROLLBACK");
          return "not-found";
        }
        if (patch.title !== undefined) {
          await client.query(`UPDATE board_columns SET title = $1 WHERE id = $2`, [patch.title, id]);
        }
        if (patch.position !== undefined) {
          const ordered = await client.query<{ id: string }>(
            `SELECT id FROM board_columns ORDER BY position ASC`,
          );
          const ids = ordered.rows.map((row) => row.id).filter((columnId) => columnId !== id);
          const clamped = Math.max(0, Math.min(patch.position, ids.length));
          ids.splice(clamped, 0, id);
          for (const [index, columnId] of ids.entries()) {
            await client.query(`UPDATE board_columns SET position = $1 WHERE id = $2`, [index, columnId]);
          }
        }
        const columns = await listAllColumns(client);
        await client.query("COMMIT");
        return columns;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async deleteColumn(id) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query(`SELECT id FROM board_columns WHERE id = $1`, [id]);
        if (existing.rowCount === 0) {
          await client.query("ROLLBACK");
          return "not-found";
        }
        const hasTickets = await client.query(`SELECT 1 FROM tickets WHERE column_id = $1 LIMIT 1`, [id]);
        if ((hasTickets.rowCount ?? 0) > 0) {
          await client.query("ROLLBACK");
          return "not-empty";
        }
        await client.query(`DELETE FROM board_columns WHERE id = $1`, [id]);
        const ordered = await client.query<{ id: string }>(
          `SELECT id FROM board_columns ORDER BY position ASC`,
        );
        for (const [index, row] of ordered.rows.entries()) {
          await client.query(`UPDATE board_columns SET position = $1 WHERE id = $2`, [index, row.id]);
        }
        const columns = await listAllColumns(client);
        await client.query("COMMIT");
        return columns;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createTicket(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const column = await client.query(`SELECT id FROM board_columns WHERE id = $1`, [input.columnId]);
        if (column.rowCount === 0) {
          await client.query("ROLLBACK");
          return "column-not-found";
        }
        const max = await client.query<{ max: number | null }>(
          `SELECT MAX(position) AS max FROM tickets WHERE column_id = $1`,
          [input.columnId],
        );
        const position = (max.rows[0]?.max ?? -1) + 1;
        await client.query(
          `INSERT INTO tickets (column_id, title, description, assignee_id, position, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [input.columnId, input.title, input.description ?? null, input.assigneeId ?? null, position, input.createdBy],
        );
        const tickets = await listAllTickets(client);
        await client.query("COMMIT");
        return tickets;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateTicket(id, patch) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existingResult = await client.query<TicketRow>(`SELECT * FROM tickets WHERE id = $1`, [id]);
        const existing = existingResult.rows[0];
        if (!existing) {
          await client.query("ROLLBACK");
          return "not-found";
        }

        const targetColumnId = patch.columnId ?? existing.column_id;
        if (targetColumnId !== existing.column_id) {
          const column = await client.query(`SELECT id FROM board_columns WHERE id = $1`, [targetColumnId]);
          if (column.rowCount === 0) {
            await client.query("ROLLBACK");
            return "column-not-found";
          }
        }

        const title = patch.title ?? existing.title;
        const description = patch.description === undefined ? existing.description : patch.description;
        const assigneeId = patch.assigneeId === undefined ? existing.assignee_id : patch.assigneeId;
        await client.query(
          `UPDATE tickets SET title = $1, description = $2, assignee_id = $3, updated_at = now() WHERE id = $4`,
          [title, description, assigneeId, id],
        );

        if (patch.columnId !== undefined || patch.position !== undefined) {
          const sourceColumnId = existing.column_id;
          const sourceSiblings = await client.query<{ id: string }>(
            `SELECT id FROM tickets WHERE column_id = $1 AND id <> $2 ORDER BY position ASC`,
            [sourceColumnId, id],
          );

          let targetIds: string[];
          if (targetColumnId === sourceColumnId) {
            targetIds = sourceSiblings.rows.map((row) => row.id);
          } else {
            for (const [index, row] of sourceSiblings.rows.entries()) {
              await client.query(`UPDATE tickets SET position = $1 WHERE id = $2`, [index, row.id]);
            }
            const targetSiblings = await client.query<{ id: string }>(
              `SELECT id FROM tickets WHERE column_id = $1 ORDER BY position ASC`,
              [targetColumnId],
            );
            targetIds = targetSiblings.rows.map((row) => row.id);
          }

          const desiredIndex = patch.position === undefined
            ? targetIds.length
            : Math.max(0, Math.min(patch.position, targetIds.length));
          targetIds.splice(desiredIndex, 0, id);

          for (const [index, ticketId] of targetIds.entries()) {
            if (ticketId === id) {
              await client.query(
                `UPDATE tickets SET column_id = $1, position = $2 WHERE id = $3`,
                [targetColumnId, index, id],
              );
            } else {
              await client.query(`UPDATE tickets SET position = $1 WHERE id = $2`, [index, ticketId]);
            }
          }
        }

        const tickets = await listAllTickets(client);
        await client.query("COMMIT");
        return tickets;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async deleteTicket(id) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query<{ column_id: string }>(
          `SELECT column_id FROM tickets WHERE id = $1`,
          [id],
        );
        const row = existing.rows[0];
        if (!row) {
          await client.query("ROLLBACK");
          return "not-found";
        }
        await client.query(`DELETE FROM tickets WHERE id = $1`, [id]);
        await renumberColumnTickets(client, row.column_id);
        const tickets = await listAllTickets(client);
        await client.query("COMMIT");
        return tickets;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
