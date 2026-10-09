import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { BOARD_FIXTURE_PASSWORD, createBoardFixture, type BoardFixture } from "../test-support/board-fixture.js";

const sessionStore = new session.MemoryStore();

let fixture: BoardFixture;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  fixture = await createBoardFixture();
  app = createApp({
    userRepository: fixture.users,
    boardRepository: fixture.board,
    sessionStore,
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
  });

  it("lets any authenticated user create a ticket", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const columnId = fixture.columns[0].id;
    const response = await agent
      .post("/api/tickets")
      .send({ columnId, title: "Angebot prüfen", assigneeId: fixture.employeeUser.id })
      .expect(201);
    expect(response.body.tickets).toHaveLength(1);
    expect(response.body.tickets[0]).toMatchObject({
      columnId,
      title: "Angebot prüfen",
      assigneeId: fixture.employeeUser.id,
    });
  });

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
    const agent = await loginAs(fixture.employeeUser.email);
    const doneColumn = await agent.post("/api/board/columns").send({ title: "Erledigt" }).expect(201);
    const doneColumnId = doneColumn.body.columns.at(-1).id as string;
    await agent.post("/api/tickets").send({ columnId: doneColumnId, title: "Altes Ticket" }).expect(201);
    await agent.post("/api/tickets/archive").send({ columnId: doneColumnId }).expect(200);

    const response = await agent.get("/api/tickets/archived").expect(200);
    expect(response.body.tickets).toHaveLength(1);
    expect(response.body.tickets[0].title).toBe("Altes Ticket");
  });

  it("restores an archived ticket", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const doneColumn = await agent.post("/api/board/columns").send({ title: "Erledigt" }).expect(201);
    const doneColumnId = doneColumn.body.columns.at(-1).id as string;
    await agent.post("/api/tickets").send({ columnId: doneColumnId, title: "Restore me" }).expect(201);
    await agent.post("/api/tickets/archive").send({ columnId: doneColumnId }).expect(200);

    const archived = await agent.get("/api/tickets/archived").expect(200);
    const archivedId = archived.body.tickets[0].id as string;
    const restored = await agent.post(`/api/tickets/${archivedId}/restore`).send({}).expect(200);

    expect(restored.body.tickets.some((ticket: { id: string }) => ticket.id === archivedId)).toBe(true);
  });

  it("archives a single done ticket", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const doneColumn = await agent.post("/api/board/columns").send({ title: "Erledigt" }).expect(201);
    const doneColumnId = doneColumn.body.columns.at(-1).id as string;
    const created = await agent.post("/api/tickets").send({ columnId: doneColumnId, title: "Only me" }).expect(201);
    const ticketId = created.body.tickets.find((entry: { title: string }) => entry.title === "Only me").id as string;

    const response = await agent.post(`/api/tickets/${ticketId}/archive`).send({}).expect(200);
    expect(response.body.tickets.some((ticket: { id: string }) => ticket.id === ticketId)).toBe(false);
  });
});
