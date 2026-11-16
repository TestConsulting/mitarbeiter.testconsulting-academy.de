import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_TICKET_ATTACHMENT_COUNT,
  MAX_TICKET_ATTACHMENT_SIZE,
  MAX_TICKET_ATTACHMENT_TOTAL_SIZE,
  createTicketAttachmentRepository,
} from "./ticket-attachment-repository.js";

const ticketId = "11111111-1111-4111-8111-111111111111";

function createDatabase(options: { ticketExists?: boolean; count?: number; totalSize?: number } = {}) {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("SELECT id FROM tickets")) {
        return { rows: options.ticketExists === false ? [] : [{ id: ticketId }] };
      }
      if (sql.includes("COUNT(*)")) {
        return { rows: [{ file_count: options.count ?? 0, total_size: options.totalSize ?? 0 }] };
      }
      if (sql.includes("INSERT INTO ticket_attachments")) {
        return {
          rows: [{
            id: "22222222-2222-4222-8222-222222222222",
            file_name: "bericht.pdf",
            file_size: 8,
            content_type: "application/pdf",
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const database = {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(client),
  };
  return {
    client,
    repository: createTicketAttachmentRepository(database as never),
  };
}

describe("ticket attachment repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks the ticket before reading quotas and inserting an attachment", async () => {
    const { client, repository } = createDatabase();
    const result = await repository.create(
      ticketId,
      "bericht.pdf",
      "application/pdf",
      Buffer.from("%PDF-1.7", "ascii"),
    );
    expect(result).toMatchObject({
      fileName: "bericht.pdf",
      size: 8,
      contentType: "application/pdf",
    });

    const sql = client.query.mock.calls.map(([statement]) => statement);
    expect(sql[0]).toBe("BEGIN");
    expect(sql[1]).toContain("SELECT id FROM tickets WHERE id = $1 FOR UPDATE");
    expect(sql[2]).toContain("COUNT(*)::int AS file_count");
    expect(sql[3]).toContain("INSERT INTO ticket_attachments");
    expect(sql[4]).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back if the ticket does not exist or the file-count quota is full", async () => {
    const missing = createDatabase({ ticketExists: false });
    await expect(missing.repository.create(ticketId, "a.pdf", "application/pdf", Buffer.from("x")))
      .resolves.toBe("ticket-not-found");
    expect(missing.client.query.mock.calls.map(([statement]) => statement)).toEqual([
      "BEGIN",
      "SELECT id FROM tickets WHERE id = $1 FOR UPDATE",
      "ROLLBACK",
    ]);

    const full = createDatabase({ count: MAX_TICKET_ATTACHMENT_COUNT });
    await expect(full.repository.create(ticketId, "a.pdf", "application/pdf", Buffer.from("x")))
      .resolves.toBe("attachment-limit-reached");
    expect(full.client.query.mock.calls.some(([statement]) => statement.includes("INSERT INTO"))).toBe(false);
    expect(full.client.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });

  it("rejects a file above the individual size limit before opening a transaction", async () => {
    const { client, repository } = createDatabase();
    const result = await repository.create(
      ticketId,
      "large.pdf",
      "application/pdf",
      Buffer.alloc(MAX_TICKET_ATTACHMENT_SIZE + 1),
    );
    expect(result).toBe("file-size-limit-reached");
    expect(client.query).not.toHaveBeenCalled();
  });

  it("rolls back when a file would exceed the per-ticket byte quota", async () => {
    const { client, repository } = createDatabase({
      totalSize: MAX_TICKET_ATTACHMENT_TOTAL_SIZE - 4,
    });
    await expect(repository.create(
      ticketId,
      "a.pdf",
      "application/pdf",
      Buffer.alloc(5),
    )).resolves.toBe("ticket-size-limit-reached");
    expect(client.query.mock.calls.some(([statement]) => statement.includes("INSERT INTO"))).toBe(false);
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });
});
