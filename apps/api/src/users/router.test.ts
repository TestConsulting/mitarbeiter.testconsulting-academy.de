import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import type { UserRepository } from "../db/user-repository.js";
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

describe("users router", () => {
  it("allows authenticated users to list users", async () => {
    const agent = await loginAs(fixture.employeeUser.email);
    const response = await agent.get("/api/users").expect(200);
    expect(response.body.users).toHaveLength(2);
    expect(response.body.users[0]).not.toHaveProperty("passwordHash");
  });

  it("rejects create/update/delete for employees", async () => {
    const agent = await loginAs(fixture.employeeUser.email);

    await agent.post("/api/users").send({
      name: "Neue Person",
      email: "new@example.test",
      password: "new-password-12345",
      role: "employee",
    }).expect(403);

    await agent.patch(`/api/users/${fixture.adminUser.id}`).send({ name: "Renamed" }).expect(403);
    await agent.delete(`/api/users/${fixture.adminUser.id}`).expect(403);
  });

  it("allows admin to create, update and delete a user", async () => {
    const agent = await loginAs(fixture.adminUser.email);

    const created = await agent.post("/api/users").send({
      name: "Neue Person",
      email: "new@example.test",
      password: "new-password-12345",
      role: "employee",
    }).expect(201);

    expect(created.body.user).toMatchObject({
      name: "Neue Person",
      email: "new@example.test",
      role: "employee",
    });

    const updated = await agent.patch(`/api/users/${created.body.user.id}`).send({
      name: "Neue Person Umbenannt",
      role: "admin",
    }).expect(200);

    expect(updated.body.user).toMatchObject({
      name: "Neue Person Umbenannt",
      role: "admin",
    });

    await agent.delete(`/api/users/${created.body.user.id}`).expect(200, { success: true });
  });

  it("prevents deleting the currently signed-in admin account", async () => {
    const agent = await loginAs(fixture.adminUser.email);
    await agent.delete(`/api/users/${fixture.adminUser.id}`).expect(400);
  });

  it("returns field-specific validation hints when create payload is invalid", async () => {
    const agent = await loginAs(fixture.adminUser.email);

    const response = await agent.post("/api/users").send({
      name: "",
      email: "not-an-email",
      password: "short",
      role: "employee",
    }).expect(400);

    expect(response.body.error).toContain("name:");
    expect(response.body.error).toContain("email:");
    expect(response.body.error).toContain("password:");
  });

  it("returns a clear error when legacy single-account constraint blocks user creation", async () => {
    const baseUsers = fixture.users;
    const singleAccountUsers: UserRepository = {
      ...baseUsers,
      create: async () => {
        const error = { code: "23505", constraint: "users_single_account" };
        throw error;
      },
    };
    const constrainedApp = createApp({
      userRepository: singleAccountUsers,
      boardRepository: fixture.board,
      sessionStore,
      sessionSecret: "test-secret-with-more-than-thirty-two-characters",
      secureCookies: false,
      loginLimiter: (_request, _response, next) => next(),
    });

    const agent = request.agent(constrainedApp);
    await agent.post("/api/auth/login").send({ email: fixture.adminUser.email, password: BOARD_FIXTURE_PASSWORD }).expect(200);

    const response = await agent.post("/api/users").send({
      name: "Neue Person",
      email: "new2@example.test",
      password: "new-password-12345",
      role: "employee",
    }).expect(409);

    expect(response.body.error).toContain("Single-Account-Modus");
  });
});
