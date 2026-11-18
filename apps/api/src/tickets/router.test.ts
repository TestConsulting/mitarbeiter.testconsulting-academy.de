import { randomUUID } from "node:crypto";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import {
  MAX_TICKET_ATTACHMENT_COUNT,
  MAX_TICKET_ATTACHMENT_SIZE,
  MAX_TICKET_ATTACHMENT_TOTAL_SIZE,
  type StoredTicketAttachment,
  type TicketAttachmentRepository,
} from "../db/ticket-attachment-repository.js";
import { BOARD_FIXTURE_PASSWORD, createBoardFixture, type BoardFixture } from "../test-support/board-fixture.js";

let fixture: BoardFixture;
let app: ReturnType<typeof createApp>;
let attachments: TicketAttachmentRepository;

function createMemoryAttachmentRepository(board: BoardFixture["board"]): TicketAttachmentRepository {
  const files: Array<StoredTicketAttachment & { ticketId: string }> = [];
  async function ticketExists(ticketId: string): Promise<boolean> {
    const active = await board.getBoard();
    const archived = await board.listArchivedTickets();
    return active.tickets.some((ticket) => ticket.id === ticketId) ||
      archived.some((ticket) => ticket.id === ticketId);
  }
  return {
    async list(ticketId) {
      if (!(await ticketExists(ticketId))) return "ticket-not-found";
      return files.filter((file) => file.ticketId === ticketId).map(({ id, fileName, size, contentType }) => ({
        id, fileName, size, contentType,
      }));
    },
    async create(ticketId, fileName, contentType, content) {
      if (!(await ticketExists(ticketId))) return "ticket-not-found";
      const ticketFiles = files.filter((file) => file.ticketId === ticketId);
      if (ticketFiles.length >= MAX_TICKET_ATTACHMENT_COUNT) return "attachment-limit-reached";
      if (
        ticketFiles.reduce((total, file) => total + file.size, 0) + content.byteLength >
        MAX_TICKET_ATTACHMENT_TOTAL_SIZE
      ) {
        return "ticket-size-limit-reached";
      }
      const file: StoredTicketAttachment & { ticketId: string } = {
        id: randomUUID(), ticketId, fileName, size: content.byteLength, contentType, content,
      };
      files.push(file);
      const { ticketId: _ticketId, content: _content, ...metadata } = file;
      return metadata;
    },
    async read(ticketId, attachmentId) {
      const file = files.find((entry) => entry.ticketId === ticketId && entry.id === attachmentId);
      if (!file) return null;
      const { ticketId: _ticketId, ...stored } = file;
      return stored;
    },
    async delete(ticketId, attachmentId) {
      if (!(await ticketExists(ticketId))) return "ticket-not-found";
      const index = files.findIndex((entry) => entry.ticketId === ticketId && entry.id === attachmentId);
      if (index < 0) return false;
      files.splice(index, 1);
      return true;
    },
  };
}

beforeEach(async () => {
  fixture = await createBoardFixture();
  attachments = createMemoryAttachmentRepository(fixture.board);
  app = createApp({
    userRepository: fixture.users,
    boardRepository: fixture.board,
    ticketAttachmentRepository: attachments,
    sessionStore: new session.MemoryStore(),
    sessionSecret: "test-secret-with-more-than-thirty-two-characters",
    secureCookies: false,
    loginLimiter: (_request, _response, next) => next(),
  });
});

async function loginAs(email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: BOARD_FIXTURE_PASSWORD }).expect(200);
  return agent;
}

describe("tickets router", () => {
  it("rejects unauthenticated access", async () => {
    await request(app).post("/api/tickets").send({}).expect(401);
    await request(app).patch(`/api/tickets/${randomUUID()}`).send({ blocked: true }).expect(401);
  });

  it("lets any authenticated user create a ticket", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const columnId = fixture.columns[0].id;
    const response = await agent
      .post("/api/tickets")
      .send({ columnId, title: "Angebot prüfen", assigneeId: fixture.employeeUser.id })
      .expect(201);
    expect(response.body.tickets).toHaveLength(1);
    expect(response.body.createdTicketId).toBe(response.body.tickets[0].id);
    expect(response.body.tickets[0]).toMatchObject({
      columnId,
      title: "Angebot prüfen",
      assigneeId: fixture.employeeUser.id,
    });
  });

  it("lets authenticated employees block and unblock tickets without changing other fields", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const created = await agent.post("/api/tickets").send({
      columnId: fixture.columns[0].id, title: "Blockierbares Ticket",
    }).expect(201);
    const id = created.body.createdTicketId as string;
    expect(created.body.tickets[0].blocked).toBe(false);
    for (const blocked of [true, false]) {
      const response = await agent.patch(`/api/tickets/${id}`).send({ blocked }).expect(200);
      expect(response.body.tickets[0]).toMatchObject({ id, title: "Blockierbares Ticket", blocked });
    }
    for (const blocked of ["true", 1, null]) {
      await agent.patch(`/api/tickets/${id}`).send({ blocked }).expect(400);
    }
    await agent.patch(`/api/tickets/${randomUUID()}`).send({ blocked: true }).expect(404);
  });

  it("supports uploading, listing, safely downloading, previewing, and deleting attachments", async () => {
      const agent = await loginAs(fixture.employeeUser.email);
      const ticket = await agent.post("/api/tickets").send({
        columnId: fixture.columns[0].id,
        title: "Anhang",
      }).expect(201);
      const ticketId = ticket.body.createdTicketId as string;
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const uploaded = await agent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Content-Type", "application/octet-stream")
        .set("X-File-Name", encodeURIComponent('Übersicht "final".png'))
        .send(png)
        .expect(201);
      expect(uploaded.body.attachment).toMatchObject({
        fileName: 'Übersicht "final".png',
        size: png.byteLength,
        contentType: "image/png",
      });

      const listed = await agent.get(`/api/tickets/${ticketId}/attachments`).expect(200);
      expect(listed.body.attachments).toEqual([uploaded.body.attachment]);

      const downloadPath = `/api/tickets/${ticketId}/attachments/${uploaded.body.attachment.id}/download`;
      const download = await agent.get(downloadPath).expect(200);
      expect(download.headers["content-disposition"]).toContain('attachment; filename="_bersicht _final_.png"');
      expect(download.headers["x-content-type-options"]).toBe("nosniff");
      expect(download.body).toEqual(png);

      const preview = await agent.get(`${downloadPath}?preview=1`).expect(200);
      expect(preview.headers["content-disposition"]).toContain("inline;");
      expect(preview.body).toEqual(png);

      await agent
        .delete(`/api/tickets/${ticketId}/attachments/${uploaded.body.attachment.id}`)
        .expect(200, { success: true });
      await agent.get(`/api/tickets/${ticketId}/attachments`).expect(200, { attachments: [] });
    });

  it("keeps attachments available when a ticket is archived", async () => {
      const doneColumn = await fixture.board.createColumn("Erledigt");
      const agent = await loginAs(fixture.employeeUser.email);
      const ticket = await agent.post("/api/tickets").send({
        columnId: doneColumn.at(-1)!.id,
        title: "Archivierter Anhang",
      }).expect(201);
      const ticketId = ticket.body.createdTicketId as string;
      await agent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Content-Type", "application/octet-stream")
        .set("X-File-Name", "beleg.pdf")
        .send(Buffer.from("%PDF-1.7\n", "ascii"))
        .expect(201);

      await agent.post(`/api/tickets/${ticketId}/archive`).send({}).expect(200);
      const listed = await agent.get(`/api/tickets/${ticketId}/attachments`).expect(200);
      expect(listed.body.attachments).toHaveLength(1);
    });

  it("rejects attachment access without authentication", async () => {
      const ticketId = "33333333-3333-4333-8333-333333333333";
      await request(app).get(`/api/tickets/${ticketId}/attachments`).expect(401);
      await request(app).post(`/api/tickets/${ticketId}/attachments`).expect(401);
      await request(app).get(`/api/tickets/${ticketId}/attachments/${ticketId}/download`).expect(401);
      await request(app).delete(`/api/tickets/${ticketId}/attachments/${ticketId}`).expect(401);
    });

  it("rejects unsupported names, mismatched signatures, and non-image previews", async () => {
      const agent = await loginAs(fixture.employeeUser.email);
      const ticket = await agent.post("/api/tickets").send({
        columnId: fixture.columns[0].id, title: "Validierung",
      }).expect(201);
      const ticketId = ticket.body.createdTicketId as string;
      const upload = (fileName: string, content: Buffer) => agent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Content-Type", "application/octet-stream")
        .set("X-File-Name", encodeURIComponent(fileName))
        .send(content);
      await upload("script.html", Buffer.from("<script/>")).expect(400);
      await upload("report.pdf", Buffer.from("<html>")).expect(400);
      const pdf = await upload("report.pdf", Buffer.from("%PDF-1.7\n", "ascii")).expect(201);
      await agent
        .get(`/api/tickets/${ticketId}/attachments/${pdf.body.attachment.id}/download?preview=1`)
        .expect(400);
    });

  it("returns German 413 errors when either ticket quota is exhausted", async () => {
      const agent = await loginAs(fixture.employeeUser.email);
      const ticket = await agent.post("/api/tickets").send({
        columnId: fixture.columns[0].id, title: "Kontingent",
      }).expect(201);
      const ticketId = ticket.body.createdTicketId as string;
      const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      for (let index = 0; index < MAX_TICKET_ATTACHMENT_COUNT; index += 1) {
        await agent
          .post(`/api/tickets/${ticketId}/attachments`)
          .set("Content-Type", "application/octet-stream")
          .set("X-File-Name", `image-${index}.png`)
          .send(image)
          .expect(201);
      }
      const countLimit = await agent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Content-Type", "application/octet-stream")
        .set("X-File-Name", "next.png")
        .send(image)
        .expect(413);
      expect(countLimit.body.error).toContain("höchstens 10 Anhänge");

      const sizeLimitedAttachments: TicketAttachmentRepository = {
        ...attachments,
        async create() {
          return "ticket-size-limit-reached";
        },
      };
      const sizeLimitedApp = createApp({
        userRepository: fixture.users,
        boardRepository: fixture.board,
        ticketAttachmentRepository: sizeLimitedAttachments,
        sessionStore: new session.MemoryStore(),
        sessionSecret: "test-secret-with-more-than-thirty-two-characters",
        secureCookies: false,
        loginLimiter: (_request, _response, next) => next(),
      });
      const sizeLimitAgent = await loginAsWithApp(sizeLimitedApp, fixture.employeeUser.email);
      const sizeLimit = await sizeLimitAgent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Content-Type", "application/octet-stream")
        .set("X-File-Name", "large.png")
        .send(image)
        .expect(413);
      expect(sizeLimit.body.error).toContain("100 MiB");

      const fileLimit = await agent
        .post(`/api/tickets/${ticketId}/attachments`)
        .set("Content-Type", "application/octet-stream")
        .set("X-File-Name", "too-large.png")
        .send(Buffer.alloc(MAX_TICKET_ATTACHMENT_SIZE + 1, 0))
        .expect(413);
      expect(fileLimit.body.error).toContain("20 MiB");
    });

  async function loginAsWithApp(targetApp: ReturnType<typeof createApp>, email: string) {
    const agent = request.agent(targetApp);
    await agent.post("/api/auth/login").send({ email, password: BOARD_FIXTURE_PASSWORD }).expect(200);
    return agent;
  }

  it("rejects a ticket for an unknown column", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    await agent
      .post("/api/tickets")
      .send({ columnId: "33333333-3333-4333-8333-333333333333", title: "Test" })
      .expect(404);
  });

  it("rejects an invalid payload", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    await agent.post("/api/tickets").send({ columnId: "not-a-uuid", title: "" }).expect(400);
  });

  it("rejects an assignee that does not exist", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const columnId = fixture.columns[0].id;
    await agent
      .post("/api/tickets")
      .send({ columnId, title: "Test", assigneeId: "33333333-3333-4333-8333-333333333333" })
      .expect(400);
  });

  it("updates a ticket's title, description and assignee", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const columnId = fixture.columns[0].id;
    const created = await agent.post("/api/tickets").send({ columnId, title: "Initial" }).expect(201);
    const ticketId = created.body.tickets[0].id;

    const updated = await agent
      .patch(`/api/tickets/${ticketId}`)
      .send({ title: "Aktualisiert", description: "Details", assigneeId: fixture.adminUser.id })
      .expect(200);

    const ticket = updated.body.tickets.find((entry: { id: string }) => entry.id === ticketId);
    expect(ticket).toMatchObject({
      title: "Aktualisiert",
      description: "Details",
      assigneeId: fixture.adminUser.id,
    });
  });

  it("returns 404 when updating a missing ticket", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    await agent
      .patch("/api/tickets/33333333-3333-4333-8333-333333333333")
      .send({ title: "Egal" })
      .expect(404);
  });

  it("deletes a ticket", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const columnId = fixture.columns[0].id;
    const created = await agent.post("/api/tickets").send({ columnId, title: "Löschen" }).expect(201);
    const ticketId = created.body.tickets[0].id;

    const response = await agent.delete(`/api/tickets/${ticketId}`).expect(200);
    expect(response.body.tickets).toEqual([]);
  });

  it("lists archived tickets", async () => {
    const admin = await loginAs(fixture.adminUser.email);
    const doneColumn = await admin.post("/api/board/columns").send({ title: "Erledigt" }).expect(201);
    const doneColumnId = doneColumn.body.columns.at(-1).id as string;
    const agent = await loginAs(fixture.employeeUser.email);
    await agent.post("/api/tickets").send({ columnId: doneColumnId, title: "Altes Ticket" }).expect(201);
    await agent.post("/api/tickets/archive").send({ columnId: doneColumnId }).expect(200);

    const response = await agent.get("/api/tickets/archived").expect(200);
    expect(response.body.tickets).toHaveLength(1);
    expect(response.body.tickets[0].title).toBe("Altes Ticket");
  });

  it("restores an archived ticket", async () => {
    const admin = await loginAs(fixture.adminUser.email);
    const doneColumn = await admin.post("/api/board/columns").send({ title: "Erledigt" }).expect(201);
    const doneColumnId = doneColumn.body.columns.at(-1).id as string;
    const agent = await loginAs(fixture.employeeUser.email);
    await agent.post("/api/tickets").send({ columnId: doneColumnId, title: "Restore me" }).expect(201);
    await agent.post("/api/tickets/archive").send({ columnId: doneColumnId }).expect(200);

    const archived = await agent.get("/api/tickets/archived").expect(200);
    const archivedId = archived.body.tickets[0].id as string;
    const restored = await agent.post(`/api/tickets/${archivedId}/restore`).send({}).expect(200);

    expect(restored.body.tickets.some((ticket: { id: string }) => ticket.id === archivedId)).toBe(true);
  });

  it("archives a single done ticket", async () => {
    const admin = await loginAs(fixture.adminUser.email);
    const doneColumn = await admin.post("/api/board/columns").send({ title: "Erledigt" }).expect(201);
    const doneColumnId = doneColumn.body.columns.at(-1).id as string;
    const agent = await loginAs(fixture.employeeUser.email);
    const created = await agent.post("/api/tickets").send({ columnId: doneColumnId, title: "Only me" }).expect(201);
    const ticketId = created.body.tickets.find((entry: { title: string }) => entry.title === "Only me").id as string;

    const response = await agent.post(`/api/tickets/${ticketId}/archive`).send({}).expect(200);
    expect(response.body.tickets.some((ticket: { id: string }) => ticket.id === ticketId)).toBe(false);
  });

  it("allows employees to read archived tickets", async () => {
    const admin = await loginAs(fixture.adminUser.email);
    const doneColumn = await admin.post("/api/board/columns").send({ title: "Erledigt" }).expect(201);
    const doneColumnId = doneColumn.body.columns.at(-1).id as string;
    await admin.post("/api/tickets").send({ columnId: doneColumnId, title: "Archivtest" }).expect(201);
    await admin.post("/api/tickets/archive").send({ columnId: doneColumnId }).expect(200);

    const employee = await loginAs(fixture.employeeUser.email);
    const response = await employee.get("/api/tickets/archived").expect(200);
    expect(response.body.tickets).toHaveLength(1);
  });
});
