import { randomUUID } from "node:crypto";
import type { Benefit } from "@portal/shared";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { BenefitRepository } from "../db/benefit-repository.js";
import { BOARD_FIXTURE_PASSWORD, createBoardFixture, type BoardFixture } from "../test-support/board-fixture.js";

const input = { title: "Test-Benefit", description: "Ein lokales Beispiel", details: "Bedingungen und Kontakt\nNur für Tests." };
let fixture: BoardFixture;
let app: ReturnType<typeof createApp>;
let benefits: Benefit[];
let repository: BenefitRepository;

beforeEach(async () => {
  fixture = await createBoardFixture();
  benefits = [];
  repository = {
    list: vi.fn(async () => [...benefits].sort((a, b) => a.title.localeCompare(b.title))),
    findById: vi.fn(async (id) => benefits.find((benefit) => benefit.id === id) ?? null),
    create: vi.fn(async (data) => {
      const benefit = { id: randomUUID(), ...data };
      benefits.push(benefit);
      return benefit;
    }),
    update: vi.fn(async (id, data) => {
      const index = benefits.findIndex((benefit) => benefit.id === id);
      if (index < 0) return null;
      benefits[index] = { id, ...data };
      return benefits[index];
    }),
    delete: vi.fn(async (id) => {
      const index = benefits.findIndex((benefit) => benefit.id === id);
      if (index < 0) return false;
      benefits.splice(index, 1);
      return true;
    }),
  };
  app = createApp({
    userRepository: fixture.users, benefitRepository: repository,
    sessionStore: new session.MemoryStore(),
    sessionSecret: "test-secret-with-more-than-thirty-two-characters",
    secureCookies: false, loginLimiter: (_request, _response, next) => next(),
  });
});

async function loginAs(role: "employee" | "admin") {
  const agent = request.agent(app);
  const user = role === "admin" ? fixture.adminUser : fixture.employeeUser;
  await agent.post("/api/auth/login").send({ email: user.email, password: BOARD_FIXTURE_PASSWORD }).expect(200);
  return agent;
}

describe("Benefits API", () => {
  it("requires authentication for list, detail and all mutations", async () => {
    const id = randomUUID();
    await request(app).get("/api/benefits").expect(401);
    await request(app).get(`/api/benefits/${id}`).expect(401);
    await request(app).post("/api/benefits").send(input).expect(401);
    await request(app).put(`/api/benefits/${id}`).send(input).expect(401);
    await request(app).delete(`/api/benefits/${id}`).expect(401);
    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("lets employees read cards and details but forbids CRUD", async () => {
    const benefit = { ...input, id: randomUUID() };
    benefits.push(benefit);
    const employee = await loginAs("employee");
    await employee.get("/api/benefits").expect(200, { benefits: [benefit] });
    await employee.get(`/api/benefits/${benefit.id}`).expect(200, { benefit });
    await employee.post("/api/benefits").send(input).expect(403);
    await employee.put(`/api/benefits/${benefit.id}`).send(input).expect(403);
    await employee.delete(`/api/benefits/${benefit.id}`).expect(403);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("lets admins create, edit and delete Benefits visible to employees", async () => {
    const admin = await loginAs("admin");
    const created = await admin.post("/api/benefits").send({ ...input, title: " Test-Benefit " }).expect(201);
    const id = created.body.benefit.id;
    expect(created.body.benefit).toEqual({ ...input, id: expect.any(String) });
    const updatedInput = { title: "Aktualisiert", description: "Neue Kurzbeschreibung", details: "Neue Details" };
    const updated = await admin.put(`/api/benefits/${id}`).send(updatedInput).expect(200);
    expect(updated.body.benefit).toEqual({ id, ...updatedInput });
    const employee = await loginAs("employee");
    await employee.get(`/api/benefits/${id}`).expect(200, updated.body);
    await admin.delete(`/api/benefits/${id}`).expect(200, { success: true });
    await employee.get("/api/benefits").expect(200, { benefits: [] });
    await employee.get(`/api/benefits/${id}`).expect(404);
  });

  it.each([
    { ...input, title: " " }, { ...input, description: " " }, { ...input, details: " " },
    { ...input, title: "x".repeat(121) }, { ...input, description: "x".repeat(501) },
    { ...input, details: "x".repeat(5001) }, { ...input, details: null },
    { ...input, extra: "unexpected" }, { title: input.title, description: input.description },
  ])("rejects invalid input without persisting it: %j", async (data) => {
    const admin = await loginAs("admin");
    await admin.post("/api/benefits").send(data).expect(400);
    await admin.put(`/api/benefits/${randomUUID()}`).send(data).expect(400);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("accepts maximum field lengths including multibyte detail text", async () => {
    const admin = await loginAs("admin");
    const data = { title: "t".repeat(120), description: "d".repeat(500), details: "€".repeat(5000) };
    const result = await admin.post("/api/benefits").send(data).expect(201);
    expect(result.body.benefit.details).toBe(data.details);
  });

  it("validates IDs and reports missing Benefits", async () => {
    const admin = await loginAs("admin");
    await admin.get("/api/benefits/invalid").expect(400);
    await admin.put("/api/benefits/invalid").send(input).expect(400);
    await admin.delete("/api/benefits/invalid").expect(400);
    const id = randomUUID();
    await admin.get(`/api/benefits/${id}`).expect(404);
    await admin.put(`/api/benefits/${id}`).send(input).expect(404);
    await admin.delete(`/api/benefits/${id}`).expect(404);
  });

  it("returns an explicitly empty list and orders cards by title", async () => {
    const employee = await loginAs("employee");
    await employee.get("/api/benefits").expect(200, { benefits: [] });
    benefits.push({ ...input, id: randomUUID(), title: "Z" }, { ...input, id: randomUUID(), title: "A" });
    const result = await employee.get("/api/benefits").expect(200);
    expect(result.body.benefits.map((benefit: Benefit) => benefit.title)).toEqual(["A", "Z"]);
  });

  it("propagates database errors rather than returning successful results", async () => {
    const admin = await loginAs("admin");
    for (const method of ["list", "findById", "create", "update", "delete"] as const) {
      vi.mocked(repository[method]).mockRejectedValue(new Error("Database unavailable"));
    }
    await admin.get("/api/benefits").expect(500);
    await admin.get(`/api/benefits/${randomUUID()}`).expect(500);
    await admin.post("/api/benefits").send(input).expect(500);
    await admin.put(`/api/benefits/${randomUUID()}`).send(input).expect(500);
    await admin.delete(`/api/benefits/${randomUUID()}`).expect(500);
  });
});
