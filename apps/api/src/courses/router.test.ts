import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { ExamAttempt, PracticeProgress } from "@portal/shared";
import type { Course, CourseInput } from "@portal/shared";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { CourseRepository } from "../db/course-repository.js";
import type { ExamAttemptRepository } from "../db/exam-attempt-repository.js";
import { parseIstqbQuestions } from "../db/istqb-question-import.js";
import type { PracticeProgressRepository } from "../db/practice-progress-repository.js";
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
let examAttempts: ExamAttempt[];
let progressByUser: Map<string, PracticeProgress[]>;
let practiceProgressRepository: PracticeProgressRepository;

beforeEach(async () => {
  fixture = await createBoardFixture();
  savedCourses = [{ ...initialCourse }];
  files = new Map();
  examAttempts = [];
  progressByUser = new Map();
  const examAttemptRepository: ExamAttemptRepository = {
    listByUser: vi.fn(async (userId) => examAttempts.filter((attempt) => attempt.id.startsWith(userId))),
    create: vi.fn(async (input) => {
      const attempt: ExamAttempt = {
        id: `${input.userId}-${randomUUID()}`,
        courseId: input.courseId,
        courseSlug: input.courseSlug,
        courseTitle: input.courseTitle,
        ...input.result,
        submittedAt: new Date().toISOString(),
      };
      examAttempts.push(attempt);
      return attempt;
    }),
  };
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
  practiceProgressRepository = {
    list: vi.fn(async (userId) => progressByUser.get(userId) ?? []),
    record: vi.fn(async (userId, _courseId, question, isCorrect) => {
      const progress = { questionId: question.id, lastCorrect: isCorrect };
      progressByUser.set(userId, [
        ...(progressByUser.get(userId) ?? []).filter((item) => item.questionId !== question.id), progress,
      ]);
      return progress;
    }),
  };
  app = createApp({
    userRepository: fixture.users,
    courseRepository: repository,
    examAttemptRepository,
    practiceProgressRepository,
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
  it("hides exam-only fallback questions from practice, progress and counts, but retains them for admins", async () => {
    const original = initialCourse.questions[0];
    savedCourses[0] = { ...initialCourse, questions: [
      original, { ...original, id: "exam-only", usage: "exam" },
    ] };
    const employee = await loginAs("employee");
    const practice = await employee.get(`/api/courses/${initialCourse.slug}/practice`).expect(200);
    expect(practice.body.course.questions).toEqual([original]);
    const list = await employee.get("/api/courses").expect(200);
    expect(list.body.courses[0].questionCount).toBe(1);
    await employee.get(`/api/courses/${initialCourse.slug}/practice/progress`).expect(200);
    expect(practiceProgressRepository.list).toHaveBeenCalledWith(expect.any(String), initialCourse.id, [original]);
    await employee.post(`/api/courses/${initialCourse.slug}/practice/answer`)
      .send({ questionId: "exam-only", selectedOptionIds: ["option-1"] }).expect(400);
    const admin = await loginAs("admin");
    const editable = await admin.get(`/api/courses/admin/${initialCourse.slug}`).expect(200);
    expect(editable.body.course.questions).toHaveLength(2);
  });

  it("allows admins to save the enlarged pool with diagrams and question usage intact", async () => {
    const admin = await loginAs("admin");
    const input = asInput({
      ...initialCourse,
      questions: Array.from({ length: 379 }, (_, index) => ({
        ...initialCourse.questions[0], id: `question-${index}`, usage: "practice",
        image: { url: [
          "/questions/istqb-foundation/prozess-116.png",
          "/questions/istqb-foundation/lebenszyklus-015.png",
          "/questions/istqb-foundation/statisch-005.png",
          "/questions/istqb-foundation/testentwurf-002.png",
        ][index % 4], alt: "Aufgabengrafik" },
      })),
    });
    const response = await admin.post("/api/courses").send(input).expect(201);
    expect(response.body.course.questions).toEqual(input.questions);
    input.questions[0].image = { url: "https://untrusted.invalid/image.png", alt: "Extern" };
    await admin.post("/api/courses").send(input).expect(400);
  });

  it("excludes practice-only questions consistently from legacy exam delivery and grading", async () => {
    const original = initialCourse.questions[0];
    savedCourses[0] = { ...initialCourse, questions: [
      { ...original, image: { url: "/questions/istqb-foundation/prozess-116.png", alt: "Testprozess" } },
      { ...original, id: "practice-only", usage: "practice" },
    ] };
    const employee = await loginAs("employee");
    const url = `/api/courses/${initialCourse.slug}/exam`;
    const exam = await employee.get(url).expect(200);
    expect(exam.body.course.questions).toHaveLength(1);
    expect(exam.body.course.questions[0].image).toEqual(savedCourses[0].questions[0].image);
    const submitted = await employee.post(`${url}/submit`)
      .send({ answers: [{ questionId: original.id, selectedOptionIds: ["option-1"] }] }).expect(200);
    expect(submitted.body.result).toMatchObject({ totalQuestions: 1, correctCount: 1, percentage: 100 });
    expect(submitted.body.result.results[0].question.image).toEqual(savedCourses[0].questions[0].image);
    await employee.post(`${url}/submit`)
      .send({ answers: [{ questionId: "practice-only", selectedOptionIds: ["option-1"] }] }).expect(400);
    savedCourses[0] = { ...initialCourse, questions: [{ ...original, usage: "practice" }] };
    await employee.post(`${url}/submit`).send({ answers: [] }).expect(400);
  });

  it("requires the complete correct set for multiple-choice practice answers", async () => {
    savedCourses[0] = { ...initialCourse, questions: [{
      ...initialCourse.questions[0], type: "multiple",
      options: [...initialCourse.questions[0].options, { id: "option-3", text: "Auch richtig" }],
      correctOptionIds: ["option-1", "option-3"],
    }] };
    const employee = await loginAs("employee");
    const url = `/api/courses/${initialCourse.slug}/practice/answer`;
    await employee.post(url).send({ questionId: "question-1", selectedOptionIds: ["option-1"] })
      .expect(200, { progress: { questionId: "question-1", lastCorrect: false } });
    await employee.post(url).send({ questionId: "question-1", selectedOptionIds: ["option-3", "option-1"] })
      .expect(200, { progress: { questionId: "question-1", lastCorrect: true } });
  });

  it("returns an explicit error when progress cannot be read or saved", async () => {
    const employee = await loginAs("employee");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.mocked(practiceProgressRepository.list).mockRejectedValueOnce(new Error("Database unavailable"));
      vi.mocked(practiceProgressRepository.record).mockRejectedValueOnce(new Error("Database unavailable"));
      const read = await employee.get(`/api/courses/${initialCourse.slug}/practice/progress`).expect(500);
      const saved = await employee.post(`/api/courses/${initialCourse.slug}/practice/answer`)
        .send({ questionId: "question-1", selectedOptionIds: ["option-1"] }).expect(500);
      expect(read.body).toEqual({ error: "Die Anfrage konnte nicht verarbeitet werden." });
      expect(saved.body).toEqual(read.body);
      expect(log).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
  });

  it("persists server-graded practice answers per user and removes corrected questions from the error pool", async () => {
    const employee = await loginAs("employee");
    const admin = await loginAs("admin");
    const url = `/api/courses/${initialCourse.slug}/practice`;
    await employee.get(`${url}/progress`).expect(200, { progress: [] });
    await employee.post(`${url}/answer`).send({
      questionId: "question-1", selectedOptionIds: ["option-2"],
    }).expect(200, { progress: { questionId: "question-1", lastCorrect: false } });
    const employeeAgain = await loginAs("employee");
    await employeeAgain.get(`${url}/progress`).expect(200, {
      progress: [{ questionId: "question-1", lastCorrect: false }],
    });
    await admin.get(`${url}/progress`).expect(200, { progress: [] });
    await employeeAgain.post(`${url}/answer`).send({
      questionId: "question-1", selectedOptionIds: ["option-1"],
    }).expect(200, { progress: { questionId: "question-1", lastCorrect: true } });
    await employee.get(`${url}/progress`).expect(200, {
      progress: [{ questionId: "question-1", lastCorrect: true }],
    });
    expect(examAttempts).toHaveLength(0);
  });

  it("rejects invalid practice answers without recording progress and reports missing courses", async () => {
    const employee = await loginAs("employee");
    const url = `/api/courses/${initialCourse.slug}/practice/answer`;
    for (const body of [
      { questionId: "unknown", selectedOptionIds: ["option-1"] },
      { questionId: "question-1", selectedOptionIds: [] },
      { questionId: "question-1", selectedOptionIds: ["unknown"] },
      { questionId: "question-1", selectedOptionIds: ["option-1", "option-1"] },
      { questionId: "question-1", selectedOptionIds: ["option-1", "option-2"] },
      { questionId: "question-1", selectedOptionIds: ["option-1"], userId: fixture.adminUser.id },
    ]) await employee.post(url).send(body).expect(400);
    await employee.get(`/api/courses/${initialCourse.slug}/practice/progress`).expect(200, { progress: [] });
    await employee.get("/api/courses/missing/practice/progress").expect(404);
    await employee.post("/api/courses/missing/practice/answer")
      .send({ questionId: "question-1", selectedOptionIds: ["option-1"] }).expect(404);
  });

  it("preserves practice metadata when an admin edits a course", async () => {
    const admin = await loginAs("admin");
    const input = asInput(initialCourse);
    input.questions = [{ ...initialCourse.questions[0], metadata: {
      chapter: 1, chapterTitle: "Grundlagen des Testens", learningObjective: "FL-1.1.1", kLevel: "K1",
    } }];
    const saved = await admin.put(`/api/courses/${initialCourse.id}`).send(input).expect(200);
    expect(saved.body.course.questions[0].metadata).toEqual(input.questions[0].metadata);
  });

  it("requires authentication for course and material reads and writes", async () => {
    const id = randomUUID();
    await request(app).get("/api/courses").expect(401);
    await request(app).get(`/api/courses/${initialCourse.slug}`).expect(401);
    await request(app).get(`/api/courses/${initialCourse.slug}/exam`).expect(401);
    await request(app).get(`/api/courses/${initialCourse.slug}/practice/progress`).expect(401);
    await request(app).post(`/api/courses/${initialCourse.slug}/practice/answer`).send({}).expect(401);
    await request(app).post(`/api/courses/${initialCourse.slug}/exam/submit`).send({ answers: [] }).expect(401);
    await request(app).post("/api/courses").send(asInput(initialCourse)).expect(401);
    await request(app).put(`/api/courses/${initialCourse.id}`).send(asInput(initialCourse)).expect(401);
    await request(app).delete(`/api/courses/${initialCourse.id}`).expect(401);
    await request(app).post("/api/courses/materials").set("Content-Type", "application/pdf").send("%PDF-1.7 test").expect(401);
    await request(app).get(`/api/courses/materials/${id}/download`).expect(401);
  });

  it("lets employees read and practice courses but forbids course and file management", async () => {
    const employee = await loginAs("employee");
    const summary = {
      id: initialCourse.id,
      slug: initialCourse.slug,
      title: initialCourse.title,
      category: initialCourse.category,
      description: initialCourse.description,
      materials: initialCourse.materials,
      questionCount: initialCourse.questions.length,
    };
    await employee.get("/api/courses").expect(200, { courses: [summary] });
    await employee.get(`/api/courses/${initialCourse.slug}`).expect(200, { course: summary });
    await employee.get(`/api/courses/${initialCourse.slug}/practice`).expect(200, { course: initialCourse });
    const exam = await employee.get(`/api/courses/${initialCourse.slug}/exam`).expect(200);
    expect(exam.body.course).toMatchObject({
      slug: initialCourse.slug,
      questions: [{
        id: "question-1",
        question: "Was ist richtig?",
        options: initialCourse.questions[0].options,
      }],
    });
    expect(exam.body.course.questions[0]).not.toHaveProperty("correctOptionIds");
    expect(exam.body.course.questions[0]).not.toHaveProperty("explanation");
    const submission = await employee.post(`/api/courses/${initialCourse.slug}/exam/submit`)
      .send({ answers: [{ questionId: "question-1", selectedOptionIds: ["option-1"] }] })
      .expect(200);
    expect(submission.body.result).toMatchObject({
      percentage: 100,
      passed: true,
      correctCount: 1,
      totalQuestions: 1,
      results: [{
        selectedOptionIds: ["option-1"],
        correctOptionIds: ["option-1"],
        explanation: "Option 1 ist korrekt.",
        isCorrect: true,
      }],
    });
    expect(submission.body.attemptId).toContain(fixture.employeeUser.id);
    const history = await employee.get("/api/courses/results").expect(200);
    expect(history.body.attempts).toEqual([{
      id: submission.body.attemptId,
      courseId: initialCourse.id,
      courseSlug: initialCourse.slug,
      courseTitle: initialCourse.title,
      percentage: 100,
      passed: true,
      correctCount: 1,
      totalQuestions: 1,
      results: submission.body.result.results,
      submittedAt: expect.any(String),
    }]);
    const admin = await loginAs("admin");
    await admin.get("/api/courses/results").expect(200, { attempts: [] });
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
    await admin.get(`/api/courses/admin/${created.slug}`).expect(200, {
      course: { ...update, id: created.id, slug: created.slug },
    });
    const employee = await loginAs("employee");
    await employee.get(`/api/courses/${created.slug}`).expect(200, {
      course: {
        id: created.id,
        slug: created.slug,
        title: update.title,
        category: update.category,
        description: update.description,
        materials: update.materials,
        questionCount: update.questions.length,
      },
    });
    await employee.get(`/api/courses/${created.slug}/practice`).expect(200, {
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

  it("rejects exam submissions with unknown questions or answer options", async () => {
    const employee = await loginAs("employee");
    await employee.post(`/api/courses/${initialCourse.slug}/exam/submit`)
      .send({ answers: [{ questionId: "missing-question", selectedOptionIds: ["option-1"] }] })
      .expect(400);
    await employee.post(`/api/courses/${initialCourse.slug}/exam/submit`)
      .send({ answers: [{ questionId: "question-1", selectedOptionIds: ["missing-option"] }] })
      .expect(400);
  });

  it("serves all 90 imported ISTQB practice questions but prevents bypassing the persistent exam", async () => {
    const source = await readFile(
      new URL("../../../../docs/elearning/istqb-portal/FRAGEN-MIT-LOESUNGEN.md", import.meta.url), "utf8",
    );
    const questions = parseIstqbQuestions(source);
    savedCourses[0] = { ...initialCourse, id: "istqb-foundation", slug: "istqb-foundation", questions };
    const employee = await loginAs("employee");
    const summary = await employee.get("/api/courses/istqb-foundation").expect(200);
    expect(summary.body.course.questionCount).toBe(90);
    expect(summary.body.course).not.toHaveProperty("questions");
    const practice = await employee.get("/api/courses/istqb-foundation/practice").expect(200);
    expect(practice.body.course.questions).toEqual(questions);
    const exam = await employee.get("/api/courses/istqb-foundation/exam").expect(200);
    expect(exam.body.course.questions).toHaveLength(90);
    for (const question of exam.body.course.questions) {
      expect(question).not.toHaveProperty("correctOptionIds");
      expect(question).not.toHaveProperty("explanation");
    }
    await employee.post("/api/courses/istqb-foundation/exam/submit").send({
      answers: questions.map((question) => ({
        questionId: question.id, selectedOptionIds: question.correctOptionIds,
      })),
    }).expect(409);
    expect(examAttempts).toHaveLength(0);
  });

  it("uses the 65 percent passing threshold for the exam result", async () => {
    const questions = Array.from({ length: 20 }, (_, index) => ({
      id: `question-${index + 1}`,
      question: `Frage ${index + 1}`,
      type: "single" as const,
      options: [{ id: "correct", text: "Richtig" }, { id: "wrong", text: "Falsch" }],
      correctOptionIds: ["correct"],
      explanation: "Erklärung.",
    }));
    savedCourses[0] = { ...initialCourse, questions };
    const employee = await loginAs("employee");
    const atThreshold = await employee.post(`/api/courses/${initialCourse.slug}/exam/submit`)
      .send({
        answers: questions.slice(0, 13).map((question) => ({
          questionId: question.id,
          selectedOptionIds: ["correct"],
        })),
      })
      .expect(200);
    expect(atThreshold.body.result).toMatchObject({ percentage: 65, passed: true });

    const belowThreshold = await employee.post(`/api/courses/${initialCourse.slug}/exam/submit`)
      .send({
        answers: questions.slice(0, 12).map((question) => ({
          questionId: question.id,
          selectedOptionIds: ["correct"],
        })),
      })
      .expect(200);
    expect(belowThreshold.body.result).toMatchObject({ percentage: 60, passed: false });
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

  it("stores image uploads and serves them inline for course previews", async () => {
    const admin = await loginAs("admin");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const response = await admin.post("/api/courses/materials")
      .set("Content-Type", "image/png")
      .set("X-File-Name", encodeURIComponent("kursbild.png"))
      .send(png)
      .expect(201);
    const material = response.body.material;
    expect(material).toMatchObject({
      fileName: "kursbild.png",
      title: "kursbild",
      url: `/api/courses/materials/${material.id}/download`,
    });

    const employee = await loginAs("employee");
    const preview = await employee.get(`${material.url}?preview=1`).expect(200);
    expect(preview.headers["content-type"]).toContain("image/png");
    expect(preview.headers["content-disposition"]).toContain("inline");
    expect(preview.headers["x-content-type-options"]).toBe("nosniff");
    expect(preview.body).toEqual(png);
    const download = await employee.get(material.url).expect(200);
    expect(download.headers["content-disposition"]).toContain("attachment");
  });

  it("rejects invalid or unsupported material input without persisting it", async () => {
    const admin = await loginAs("admin");
    await admin.post("/api/courses/materials")
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", encodeURIComponent("not-a-pdf.txt"))
      .send("not a pdf")
      .expect(400);
    await admin.post("/api/courses/materials")
      .set("Content-Type", "image/png")
      .set("X-File-Name", encodeURIComponent("not-really-a-png.png"))
      .send("not an image")
      .expect(400);
    await admin.post("/api/courses/materials")
      .set("Content-Type", "image/svg+xml")
      .set("X-File-Name", encodeURIComponent("unsafe.svg"))
      .send("<svg></svg>")
      .expect(400);
    expect(repository.createMaterialFile).not.toHaveBeenCalled();
  });
});
