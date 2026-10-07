import { randomUUID } from "node:crypto";
import type { AppLink } from "@portal/shared";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { AppLinkRepository } from "../db/app-link-repository.js";
import { BOARD_FIXTURE_PASSWORD, createBoardFixture, type BoardFixture } from "../test-support/board-fixture.js";

const input = { name: "Microsoft 365", description: "Outlook, Teams, OneDrive", icon: "M365", url: "https://www.microsoft365.com/", sortOrder: 0 };
let fixture: BoardFixture;
let app: ReturnType<typeof createApp>;
let links: AppLink[];
let repository: AppLinkRepository;

beforeEach(async () => {
  fixture = await createBoardFixture();
  links = [];
  repository = {
    list: vi.fn(async () => [...links].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))),
    create: vi.fn(async (data) => {
      const link = { id: randomUUID(), ...data };
      links.push(link);
      return link;
    }),
    update: vi.fn(async (id, data) => {
      const index = links.findIndex((link) => link.id === id);
      if (index < 0) return null;
      links[index] = { id, ...data };
      return links[index];
    }),
    delete: vi.fn(async (id) => {
      const index = links.findIndex((link) => link.id === id);
      if (index < 0) return false;
      links.splice(index, 1);
      return true;
    }),
    reorder: vi.fn(async (ids) => {
      if (ids.length !== links.length || ids.some((id) => !links.some((link) => link.id === id))) return null;
      links = ids.map((id, sortOrder) => ({ ...links.find((link) => link.id === id)!, sortOrder }));
      return links;
    }),
  };
  app = createApp({
    userRepository: fixture.users,
    appLinkRepository: repository,
    sessionStore: new session.MemoryStore(),
    sessionSecret: "test-secret-with-more-than-thirty-two-characters",
    secureCookies: false,
    loginLimiter: (_request, _response, next) => next(),
  });
});

async function loginAs(role: "employee" | "admin") {
  const agent = request.agent(app);
  const user = role === "admin" ? fixture.adminUser : fixture.employeeUser;
  await agent.post("/api/auth/login").send({ email: user.email, password: BOARD_FIXTURE_PASSWORD }).expect(200);
  return agent;
}

describe("application links API", () => {
  it("requires authentication for every endpoint", async () => {
    const id = randomUUID();
    await request(app).get("/api/links").expect(401);
    await request(app).post("/api/links").send(input).expect(401);
    await request(app).put(`/api/links/${id}`).send(input).expect(401);
    await request(app).delete(`/api/links/${id}`).expect(401);
    await request(app).put("/api/links/order").send({ ids: [id] }).expect(401);
  });

  it("lets employees read ordered links but not change them", async () => {
    links.push({ ...input, id: randomUUID(), sortOrder: 10 }, { ...input, id: randomUUID(), name: "Erster Link" });
    const agent = await loginAs("employee");
    const list = await agent.get("/api/links").expect(200);
    expect(list.body.links.map((link: AppLink) => link.sortOrder)).toEqual([0, 10]);
    await agent.post("/api/links").send(input).expect(403);
    await agent.put(`/api/links/${links[0].id}`).send(input).expect(403);
    await agent.delete(`/api/links/${links[0].id}`).expect(403);
    await agent.put("/api/links/order").send({ ids: links.map((link) => link.id) }).expect(403);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.reorder).not.toHaveBeenCalled();
  });

  it("allows admins to create, edit, reorder and delete links", async () => {
    const agent = await loginAs("admin");
    const created = await agent.post("/api/links").send({ ...input, name: " Microsoft 365 " }).expect(201);
    expect(created.body.link).toEqual({ ...input, id: expect.any(String) });
    const id = created.body.link.id;
    const updated = await agent.put(`/api/links/${id}`).send({ ...input, name: "Microsoft", sortOrder: 5 }).expect(200);
    expect(updated.body.link).toEqual({ ...input, id, name: "Microsoft", sortOrder: 5 });
    await agent.delete(`/api/links/${id}`).expect(200, { success: true });
    await agent.get("/api/links").expect(200, { links: [] });
  });

  it.each(["www.happytesting.de", " WWW.happytesting.de/test?x=1#info "])("normalizes www addresses on create and update: %s", async (url) => {
    const agent = await loginAs("admin");
    const expectedUrl = `https://${url.trim()}`;
    const created = await agent.post("/api/links").send({ ...input, url }).expect(201);
    expect(created.body.link.url).toBe(expectedUrl);
    const updated = await agent.put(`/api/links/${created.body.link.id}`).send({ ...input, url }).expect(200);
    expect(updated.body.link.url).toBe(expectedUrl);
  });

  it("saves a complete tile order for all employees", async () => {
    const first = { ...input, id: randomUUID(), sortOrder: 7 };
    const second = { ...input, id: randomUUID(), name: "Wiki", sortOrder: 7 };
    links.push(first, second);
    const admin = await loginAs("admin");
    const response = await admin.put("/api/links/order").send({ ids: [second.id, first.id] }).expect(200);
    expect(response.body.links).toEqual([{ ...second, sortOrder: 0 }, { ...first, sortOrder: 1 }]);
    const employee = await loginAs("employee");
    await employee.get("/api/links").expect(200, response.body);
  });

  it("rejects invalid, duplicate and empty orders before persistence", async () => {
    const admin = await loginAs("admin");
    const id = randomUUID();
    for (const body of [{ ids: [] }, { ids: ["invalid"] }, { ids: [id, id] }, { ids: [id, id.toUpperCase()] }, { ids: [id], extra: true }]) {
      await admin.put("/api/links/order").send(body).expect(400);
    }
    expect(repository.reorder).not.toHaveBeenCalled();
  });

  it("reports stale orders without changing existing links", async () => {
    links.push({ ...input, id: randomUUID() }, { ...input, id: randomUUID(), sortOrder: 5 });
    const previous = [...links];
    const admin = await loginAs("admin");
    await admin.put("/api/links/order").send({ ids: [links[0].id] }).expect(409);
    await admin.put("/api/links/order").send({ ids: [links[0].id, randomUUID()] }).expect(409);
    expect(links).toEqual(previous);
  });

  it("reports a failed reorder as a server error", async () => {
    vi.mocked(repository.reorder).mockRejectedValue(new Error("Database unavailable"));
    const admin = await loginAs("admin");
    await admin.put("/api/links/order").send({ ids: [randomUUID()] }).expect(500);
  });

  it.each([
    { ...input, name: " " },
    { ...input, description: " " },
    { ...input, icon: "" },
    { ...input, url: "javascript:alert(1)" },
    { ...input, url: "data:text/html,test" },
    { ...input, url: "ftp://example.test/file" },
    { ...input, url: "https://user:password@example.test/" },
    { ...input, url: "not-a-url" },
    { ...input, url: "www." },
    { ...input, url: "www.invalid host.de" },
    { ...input, url: "www.user:password@example.test" },
    { ...input, url: `www.example.test/${"a".repeat(2030)}` },
    { ...input, sortOrder: -1 },
    { ...input, sortOrder: 1.5 },
    { ...input, sortOrder: 2147483648 },
    { ...input, unexpected: "value" },
  ])("rejects invalid fields without persisting them: %j", async (data) => {
    const agent = await loginAs("admin");
    await agent.post("/api/links").send(data).expect(400);
    await agent.put(`/api/links/${randomUUID()}`).send(data).expect(400);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("validates IDs and reports missing links", async () => {
    const agent = await loginAs("admin");
    await agent.put("/api/links/invalid").send(input).expect(400);
    await agent.delete("/api/links/invalid").expect(400);
    await agent.put(`/api/links/${randomUUID()}`).send(input).expect(404);
    await agent.delete(`/api/links/${randomUUID()}`).expect(404);
  });

  it("propagates database failures as errors, not empty successful lists", async () => {
    vi.mocked(repository.list).mockRejectedValue(new Error("Database unavailable"));
    const agent = await loginAs("employee");
    const response = await agent.get("/api/links").expect(500);
    expect(response.body.error).toBe("Die Anfrage konnte nicht verarbeitet werden.");
  });
});
