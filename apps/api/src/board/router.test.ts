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

describe("board router", () => {
  it("rejects unauthenticated access", async () => {
    await request(app).get("/api/board").expect(401);
  });

  it("returns the board state for authenticated users", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const response = await agent.get("/api/board").expect(200);
    expect(response.body.columns).toHaveLength(1);
    expect(response.body.tickets).toEqual([]);
  });

  it("allows authenticated users to create columns", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const created = await agent.post("/api/board/columns").send({ title: "Neu" }).expect(201);
    expect(created.body.columns.at(-1).title).toBe("Neu");
  });

  it.each(["admin", "user"] as const)("allows %s accounts to create, rename and delete empty columns", async (role) => {
    fixture.adminUser.role = role;
    const agent = await loginAs(fixture.adminUser.email);
    const created = await agent.post("/api/board/columns").send({ title: "Review" }).expect(201);
    const newColumn = created.body.columns.at(-1);
    expect(newColumn.title).toBe("Review");

    const renamed = await agent
      .patch(`/api/board/columns/${newColumn.id}`)
      .send({ title: "Review & Test" })
      .expect(200);
    expect(renamed.body.columns.at(-1).title).toBe("Review & Test");

    await agent.delete(`/api/board/columns/${newColumn.id}`).expect(200);
  });

  it("validates column creation payloads", async () => {
    const agent = await loginAs(fixture.adminUser.email);
    await agent.post("/api/board/columns").send({ title: "" }).expect(400);
  });

  it("refuses to delete a column that still contains tickets", async () => {
    const agent = await loginAs(fixture.adminUser.email);
    const columnId = fixture.columns[0].id;
    await agent.post("/api/tickets").send({ columnId, title: "Beispiel" }).expect(201);
    await agent.delete(`/api/board/columns/${columnId}`).expect(409);
  });
});
