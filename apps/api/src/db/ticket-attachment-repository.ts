import type { Pool, PoolClient } from "pg";

export const MAX_TICKET_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const MAX_TICKET_ATTACHMENT_COUNT = 10;
export const MAX_TICKET_ATTACHMENT_TOTAL_SIZE = 100 * 1024 * 1024;

export type TicketAttachment = {
  id: string;
  fileName: string;
  size: number;
  contentType: string;
};

export type StoredTicketAttachment = TicketAttachment & { content: Buffer };
export type CreateTicketAttachmentResult =
  | TicketAttachment
  | "ticket-not-found"
  | "file-size-limit-reached"
  | "attachment-limit-reached"
  | "ticket-size-limit-reached";

export type TicketAttachmentRepository = {
  list(ticketId: string): Promise<TicketAttachment[] | "ticket-not-found">;
  create(
    ticketId: string,
    fileName: string,
    contentType: string,
    content: Buffer,
  ): Promise<CreateTicketAttachmentResult>;
  read(ticketId: string, attachmentId: string): Promise<StoredTicketAttachment | null>;
  delete(ticketId: string, attachmentId: string): Promise<boolean | "ticket-not-found">;
};

type AttachmentRow = {
  id: string;
  file_name: string;
  file_size: string | number;
  content_type: string;
  content?: Buffer;
};

function mapAttachment(row: AttachmentRow): TicketAttachment {
  return {
    id: row.id,
    fileName: row.file_name,
    size: Number(row.file_size),
    contentType: row.content_type,
  };
}

async function lockTicket(client: Pick<PoolClient, "query">, ticketId: string): Promise<boolean> {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM tickets WHERE id = $1 FOR UPDATE",
    [ticketId],
  );
  return result.rows.length > 0;
}

export function createTicketAttachmentRepository(
  database: Pick<Pool, "query" | "connect">,
): TicketAttachmentRepository {
  return {
    async list(ticketId) {
      const ticket = await database.query<{ id: string }>(
        "SELECT id FROM tickets WHERE id = $1",
        [ticketId],
      );
      if (ticket.rows.length === 0) return "ticket-not-found";

      const result = await database.query<AttachmentRow>(
        `SELECT id, file_name, file_size, content_type
         FROM ticket_attachments
         WHERE ticket_id = $1
         ORDER BY created_at ASC, id ASC`,
        [ticketId],
      );
      return result.rows.map(mapAttachment);
    },

    async create(ticketId, fileName, contentType, content) {
      if (content.byteLength > MAX_TICKET_ATTACHMENT_SIZE) return "file-size-limit-reached";
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        if (!(await lockTicket(client, ticketId))) {
          await client.query("ROLLBACK");
          return "ticket-not-found";
        }

        const quota = await client.query<{ file_count: number; total_size: string | number }>(
          `SELECT COUNT(*)::int AS file_count, COALESCE(SUM(file_size), 0)::bigint AS total_size
           FROM ticket_attachments
           WHERE ticket_id = $1`,
          [ticketId],
        );
        const { file_count: fileCount, total_size: totalSize } = quota.rows[0];
        if (fileCount >= MAX_TICKET_ATTACHMENT_COUNT) {
          await client.query("ROLLBACK");
          return "attachment-limit-reached";
        }
        if (Number(totalSize) + content.byteLength > MAX_TICKET_ATTACHMENT_TOTAL_SIZE) {
          await client.query("ROLLBACK");
          return "ticket-size-limit-reached";
        }

        const inserted = await client.query<AttachmentRow>(
          `INSERT INTO ticket_attachments (ticket_id, file_name, file_size, content_type, content)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, file_name, file_size, content_type`,
          [ticketId, fileName, content.byteLength, contentType, content],
        );
        await client.query("COMMIT");
        return mapAttachment(inserted.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async read(ticketId, attachmentId) {
      const result = await database.query<AttachmentRow>(
        `SELECT id, file_name, file_size, content_type, content
         FROM ticket_attachments
         WHERE ticket_id = $1 AND id = $2`,
        [ticketId, attachmentId],
      );
      const row = result.rows[0];
      return row?.content ? { ...mapAttachment(row), content: row.content } : null;
    },

    async delete(ticketId, attachmentId) {
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        if (!(await lockTicket(client, ticketId))) {
          await client.query("ROLLBACK");
          return "ticket-not-found";
        }
        const deleted = await client.query(
          "DELETE FROM ticket_attachments WHERE ticket_id = $1 AND id = $2",
          [ticketId, attachmentId],
        );
        await client.query("COMMIT");
        return deleted.rowCount === 1;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
