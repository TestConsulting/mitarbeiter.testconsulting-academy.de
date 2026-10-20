import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import session from "express-session";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { coursesData, type Course } from "@portal/shared";
import { createExamSessionRouter } from "../courses/exam-session-router.js";
import type { CourseRepository } from "./course-repository.js";
import { createExamSessionRepository } from "./exam-session-repository.js";
import { parseIstqbQuestions } from "./istqb-question-import.js";

describe.skipIf(process.env.RUN_EXAM_DB_TESTS !== "1")("Persistent exams with real PostgreSQL", () => {
  const schema = `exam_test_${randomUUID().replaceAll("-", "")}`;
  const userId = randomUUID();
  const otherId = randomUUID();
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const database = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
  const repository = createExamSessionRepository(database);
  let course: Course;
  const app = express();
  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await database.query("CREATE TABLE users(id uuid PRIMARY KEY)");
    await database.query("INSERT INTO users(id) VALUES ($1), ($2)", [userId, otherId]);
    for (const migration of ["009_create_exam_attempts.sql", "011_create_exam_sessions.sql"]) {
      await database.query(await readFile(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
    }
    course = { ...coursesData[1], slug: "istqb-foundation", questions: parseIstqbQuestions(await readFile(
      new URL("../../../../docs/elearning/istqb-portal/FRAGEN-MIT-LOESUNGEN.md", import.meta.url), "utf8",
    )) };
    const courses: CourseRepository = {
      list: vi.fn(), findById: vi.fn(), findBySlug: vi.fn(async () => course),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), importDefaults: vi.fn(),
      createMaterialFile: vi.fn(), readMaterialFile: vi.fn(), deleteMaterialFile: vi.fn(),
    };
    app.use(express.json(), session({ secret: "exam-test-session-secret-not-production", resave: false, saveUninitialized: false }));
    // Identity injection is confined to the test harness; production uses the login session.
    app.use((req, _res, next) => { req.session.userId = req.get("X-Test-User"); next(); });
    app.use(createExamSessionRouter(courses, repository));
  });
  beforeEach(async () => {
    await database.query("TRUNCATE elearning_exam_sessions, elearning_exam_attempts");
  });
  afterAll(async () => {
    await database.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  it("enforces authentication and ownership, saves answers and hides solutions until idempotent submission", async () => {
    await request(app).get("/current").expect(401);
    const start = await request(app).post("/start").set("X-Test-User", userId)
      .send({ slug: "istqb-foundation", extended: true }).expect(200);
    const exam = start.body.session;
    expect(exam.course.questions).toHaveLength(40);
    expect(JSON.stringify(exam)).not.toMatch(/correctOptionIds|explanation/);
    expect(Date.parse(exam.expiresAt) - Date.parse(exam.startedAt)).toBe(75 * 60_000);
    const q = exam.course.questions[0];
    const answer = { questionId: q.id, selectedOptionIds: [q.options[0].id] };
    await request(app).post(`/${exam.id}/save`).set("X-Test-User", otherId).send({ answers: [answer] }).expect(404);
    await request(app).post(`/${exam.id}/save`).set("X-Test-User", userId).send({ answers: [answer] }).expect(200);
    expect((await request(app).get("/current").set("X-Test-User", userId)).body.session.answers).toEqual([answer]);
    await request(app).post(`/${exam.id}/save`).set("X-Test-User", userId)
      .send({ answers: [{ questionId: "foreign", selectedOptionIds: ["a"] }] }).expect(400);
    const results = await Promise.all([repository.change(userId, exam.id, "submit"), repository.change(userId, exam.id, "submit")]);
    expect(results[0].result).toEqual(results[1].result);
    expect(results[0].result!.results[0].selectedOptionIds).toEqual(answer.selectedOptionIds);
    expect((await database.query("SELECT * FROM elearning_exam_attempts")).rows).toHaveLength(1);
    expect((await repository.change(userId, exam.id, "save", [{ ...answer, selectedOptionIds: [] }])).result).toEqual(results[0].result);
  });
  it("serializes simultaneous starts and immutable duration; aborts separately without a scored result", async () => {
    const starts = await Promise.all(Array.from({ length: 5 }, () => repository.start(userId, course, false)));
    expect(new Set(starts.map((exam) => exam.id)).size).toBe(1);
    expect((await repository.start(userId, course, true)).durationMinutes).toBe(60);
    const aborted = await repository.change(userId, starts[0].id, "abort");
    expect(aborted).toMatchObject({ status: "aborted", result: null });
    expect(await repository.aborted(userId)).toHaveLength(1);
    expect((await database.query("SELECT * FROM elearning_exam_attempts")).rows).toHaveLength(0);
    expect((await repository.start(userId, course, true)).id).not.toBe(aborted.id);
  });
  it("rejects late answers and finalizes a closed-browser deadline exactly once at the actual deadline", async () => {
    const exam = await repository.start(userId, course, false);
    const deadline = new Date(Date.now() - 5000);
    await database.query("UPDATE elearning_exam_sessions SET expires_at = $2 WHERE id = $1", [exam.id, deadline]);
    const q = course.questions.find((question) => question.id === exam.course.questions[0].id)!;
    const late = await repository.change(userId, exam.id, "save", [{ questionId: q.id, selectedOptionIds: q.correctOptionIds }]);
    expect(late.status).toBe("expired");
    expect(late.result).toMatchObject({ correctCount: 0, passed: false });
    expect(late.finishedAt).toBe(deadline.toISOString());
    await repository.current(userId);
    await repository.change(userId, exam.id, "abort");
    const history = (await database.query("SELECT submitted_at FROM elearning_exam_attempts")).rows;
    expect(history).toHaveLength(1);
    expect(history[0].submitted_at.toISOString()).toBe(deadline.toISOString());
  });
  it("expires an offline attempt before creating another without losing the expired result", async () => {
    const exam = await repository.start(userId, course, false);
    await database.query("UPDATE elearning_exam_sessions SET expires_at = now() - interval '1 second' WHERE id = $1", [exam.id]);
    expect((await repository.start(userId, course, false)).id).not.toBe(exam.id);
    expect((await database.query("SELECT * FROM elearning_exam_attempts")).rows).toHaveLength(1);
  });
});
