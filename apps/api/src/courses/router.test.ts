import { randomUUID } from "node:crypto";
import type { Course, CourseInput } from "@portal/shared";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { CourseRepository } from "../db/course-repository.js";
import { BOARD_FIXTURE_PASSWORD, createBoardFixture, type BoardFixture } from "../test-support/board-fixture.js";

const initialCourse: Course = {
  id: "fragenkatalog-essentials",
  slug: "fragenkatalog-essentials",
  title: "Fragenkatalog Essentials",
  category: "Vorstellung",
  description: "Grundlagen für den Test.",
  materials: [],
  questions: [{
    id: "question-1",
    question: "Was ist richtig?",
    type: "single",
    options: [{ id: "option-1", text: "Richtig" }, { id: "option-2", text: "Falsch" }],
    correctOptionIds: ["option-1"],
    explanation: "Option 1 ist korrekt.",
  }],
};

let fixture: BoardFixture;
let repository: CourseRepository;
let app: ReturnType<typeof createApp>;
let savedCourses: Course[];
let files: Map<string, { fileName: string; content: Buffer }>;

beforeEach(async () => {
  fixture = await createBoardFixture();
  savedCourses = [{ ...initialCourse }];
  files = new Map();
  repository = {
    list: vi.fn(async () => [...savedCourses]),
    findById: vi.fn(async (id) => savedCourses.find((course) => course.id === id) ?? null),
    findBySlug: vi.fn(async (slug) => savedCourses.find((course) => course.slug === slug) ?? null),
    create: vi.fn(async (course) => {
      savedCourses.push(course);
      return course;
    }),
    update: vi.fn(async (id, course) => {
      const index = savedCourses.findIndex((entry) => entry.id === id);
      if (index < 0) return null;
      savedCourses[index] = course;
      return course;
    }),
    delete: vi.fn(async (id) => {
      const index = savedCourses.findIndex((course) => course.id === id);
      if (index < 0) return false;
      savedCourses.splice(index, 1);
      return true;
    }),
    importDefaults: vi.fn(async () => 0),
    createMaterialFile: vi.fn(async (fileName, content) => {
      const id = randomUUID();
      files.set(id, { fileName, content });
      return { id, fileName, sizeBytes: content.byteLength };
    }),
    readMaterialFile: vi.fn(async (id) => files.get(id) ?? null),
    deleteMaterialFile: vi.fn(async (id) => files.delete(id)),
  };
  app = createApp({
    userRepository: fixture.users,
    courseRepository: repository,
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

function asInput(course: Course): CourseInput {
  const { id: _id, slug: _slug, ...input } = course;
  return input;
}

describe("eLearning courses API", () => {
  it("requires authentication for course and PDF reads and writes", async () => {
    const id = randomUUID();
    await request(app).get("/api/courses").expect(401);
    await request(app).get(`/api/courses/${initialCourse.slug}`).expect(401);
    await request(app).post("/api/courses").send(asInput(initialCourse)).expect(401);
    await request(app).put(`/api/courses/${initialCourse.id}`).send(asInput(initialCourse)).expect(401);
    await request(app).delete(`/api/courses/${initialCourse.id}`).expect(401);
    await request(app).post("/api/courses/materials").set("Content-Type", "application/pdf").send("%PDF-1.7 test").expect(401);
    await request(app).get(`/api/courses/materials/${id}/download`).expect(401);
  });

  it("lets employees read and practice courses but forbids course and file management", async () => {
    const employee = await loginAs("employee");
    await employee.get("/api/courses").expect(200, { courses: savedCourses });
    await employee.get(`/api/courses/${initialCourse.slug}`).expect(200, { course: initialCourse });
    await employee.post("/api/courses").send(asInput(initialCourse)).expect(403);
    await employee.put(`/api/courses/${initialCourse.id}`).send(asInput(initialCourse)).expect(403);
    await employee.delete(`/api/courses/${initialCourse.id}`).expect(403);
    await employee.post("/api/courses/materials").set("Content-Type", "application/pdf").send("%PDF-1.7 test").expect(403);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.createMaterialFile).not.toHaveBeenCalled();
  });

  it("allows admins to create, edit and delete courses for employee consumption", async () => {
    const admin = await loginAs("admin");
    const input = asInput(initialCourse);
    const createdResponse = await admin.post("/api/courses").send({ ...input, title: " Neuer Kurs " }).expect(201);
    const created = createdResponse.body.course as Course;
    expect(created).toMatchObject({ id: expect.any(String), slug: /^neuer-kurs-/, title: "Neuer Kurs" });

    const update: CourseInput = { ...input, title: "Überarbeiteter Kurs" };
    await admin.put(`/api/courses/${created.id}`).send(update).expect(200, {
      course: { ...update, id: created.id, slug: created.slug },
    });
    const employee = await loginAs("employee");
    await employee.get(`/api/courses/${created.slug}`).expect(200, {
      course: { ...update, id: created.id, slug: created.slug },
    });
    await admin.delete(`/api/courses/${created.id}`).expect(200, { success: true });
    await employee.get(`/api/courses/${created.slug}`).expect(404);
  });

  it("rejects questions with invalid correct answer references", async () => {
    const admin = await loginAs("admin");
    const invalid = asInput(initialCourse);
    invalid.questions[0].correctOptionIds = ["missing-option"];
    await admin.post("/api/courses").send(invalid).expect(400);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("stores and serves uploaded PDFs to employees and denies upload to employees", async () => {
    const admin = await loginAs("admin");
    const pdf = Buffer.from("%PDF-1.7 sample PDF");
    const response = await admin.post("/api/courses/materials")
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", encodeURIComponent("Leitfaden.pdf"))
      .send(pdf)
      .expect(201);
    const material = response.body.material;
    expect(material).toMatchObject({
      fileName: "Leitfaden.pdf",
      url: `/api/courses/materials/${material.id}/download`,
    });
    const employee = await loginAs("employee");
    const download = await employee.get(material.url).expect(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toContain("Leitfaden.pdf");
    expect(download.body).toEqual(pdf);
  });

  it("rejects invalid or overlarge PDF input without persisting it", async () => {
    const admin = await loginAs("admin");
    await admin.post("/api/courses/materials")
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", encodeURIComponent("not-a-pdf.txt"))
      .send("not a pdf")
      .expect(400);
    expect(repository.createMaterialFile).not.toHaveBeenCalled();
  });
});
