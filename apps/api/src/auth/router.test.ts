import argon2 from "argon2";
import session from "express-session";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import type { StoredUser, UserRepository } from "../db/user-repository.js";

const sessionStore = new session.MemoryStore();
let storedUser: StoredUser;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  storedUser = {
    id: "47cc8a67-79c1-4b4b-b9c1-0e4e56c71d06",
    email: "alex@example.test",
    name: "Alex Example",
    role: "employee",
    passwordHash: await argon2.hash("correct-horse-battery", {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }),
  };
  const users: UserRepository = {
    async findByEmail(email) {
      return email.toLowerCase() === storedUser.email ? storedUser : null;
    },
    async findById(id) {
      if (id !== storedUser.id) return null;
      const { passwordHash: _passwordHash, ...publicUser } = storedUser;
      return publicUser;
    },
  };
  app = createApp({
    userRepository: users,
    sessionStore,
    sessionSecret: "test-secret-with-more-than-thirty-two-characters",
    secureCookies: false,
    loginLimiter: (_request, _response, next) => next(),
  });
});

describe("portal authentication", () => {
  it("rejects unauthenticated session restoration and logout", async () => {
    await request(app).get("/api/auth/me").expect(401);
    await request(app).post("/api/auth/logout").expect(401);
  });

  it("validates the login payload and returns a generic credential error", async () => {
    await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "x" }).expect(400);
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: storedUser.email, password: "wrong-password" })
      .expect(401);
    expect(response.body.error).toBe("E-Mail oder Passwort ist nicht korrekt.");
  });

  it("creates a protected server-side session and destroys it on logout", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .send({ email: " ALEX@example.test ", password: "correct-horse-battery" })
      .expect(200);

    expect(login.body.user).toEqual({
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      role: "employee",
    });
    expect(JSON.stringify(login.body)).not.toContain("passwordHash");
    expect(login.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(login.headers["set-cookie"][0]).toContain("SameSite=Lax");
    await agent.get("/api/auth/me").expect(200, { user: {
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      role: "employee",
    } });
    await agent.post("/api/auth/logout").expect(200, { success: true });
    await agent.get("/api/auth/me").expect(401);
  });
});