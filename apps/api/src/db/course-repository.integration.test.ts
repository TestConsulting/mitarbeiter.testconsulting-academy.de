import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { coursesData, getCourseUploadedFileIds, type Course } from "@portal/shared";
import { createCourseRepository } from "./course-repository.js";
import { createExamAttemptRepository } from "./exam-attempt-repository.js";

describe.skipIf(process.env.RUN_COURSE_DB_TESTS !== "1")("Course image files with PostgreSQL", () => {
  const schema = `course_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const database = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
  const repository = createCourseRepository(database);
  const userId = randomUUID();

  beforeAll(async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await database.query("CREATE TABLE users (id uuid PRIMARY KEY)");
    await database.query("INSERT INTO users (id) VALUES ($1)", [userId]);
    for (const migration of ["008_create_elearning_courses.sql", "009_create_exam_attempts.sql", "011_create_exam_sessions.sql"]) {
      await database.query(await readFile(new URL(`../../migrations/${migration}`, import.meta.url), "utf8"));
    }
  });
  beforeEach(async () => {
    await database.query("TRUNCATE elearning_courses, elearning_material_files, elearning_exam_attempts, elearning_exam_sessions");
  });
  afterAll(async () => {
    await database.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });

  async function createImageCourse() {
    const file = await repository.createMaterialFile("aufgabe.png", Buffer.from("89504e470d0a1a0a", "hex"));
    const course: Course = {
      ...coursesData[0], materials: [], questions: [{
        ...coursesData[0].questions[0], question: "",
        image: { url: `/api/courses/materials/${file.id}/download?preview=1`, alt: "Diagramm" },
      }],
    };
    await repository.create(course);
    return { file, course };
  }

  it("round-trips an ungraded attempt even after its course has been deleted", async () => {
    const course = { ...coursesData[0], passThreshold: null, durationMinutes: null };
    await repository.create(course);
    const attempts = createExamAttemptRepository(database);
    const saved = await attempts.create({
      userId, courseId: course.id, courseSlug: course.slug, courseTitle: course.title,
      result: { percentage: 25, passed: null, correctCount: 1, totalQuestions: 4, results: [] },
    });
    expect(saved.passed).toBeNull();
    expect((await repository.findById(course.id))?.durationMinutes).toBeNull();
    expect(await repository.delete(course.id)).toBe(true);
    expect((await attempts.listByUser(userId))[0]).toMatchObject({ percentage: 25, passed: null });
  });

  it("protects referenced question images and removes them after the question is removed", async () => {
    const { file, course } = await createImageCourse();
    expect(getCourseUploadedFileIds(course)).toEqual([file.id]);
    expect(await repository.deleteMaterialFile(file.id)).toBe(false);
    expect((await repository.findById(course.id))?.questions[0].image).toEqual(course.questions[0].image);
    await repository.update(course.id, { ...course, questions: [] });
    expect(await repository.deleteMaterialFile(file.id)).toBe(true);
    expect(await repository.readMaterialFile(file.id)).toBeNull();
  });

  it("deletes unreferenced question images when deleting a course", async () => {
    const { file, course } = await createImageCourse();
    expect(await repository.delete(course.id)).toBe(true);
    expect(await repository.readMaterialFile(file.id)).toBeNull();
  });

  it("retains question images shared with another course", async () => {
    const { file, course } = await createImageCourse();
    const other = { ...course, id: "other-course", slug: "other-course" };
    await repository.create(other);
    expect(await repository.delete(course.id)).toBe(true);
    expect(await repository.readMaterialFile(file.id)).not.toBeNull();
    await repository.delete(other.id);
    expect(await repository.readMaterialFile(file.id)).toBeNull();
  });

  it.each(["attempt", "session"])("retains images referenced by an exam %s snapshot", async (source) => {
    const { file, course } = await createImageCourse();
    if (source === "attempt") {
      await database.query(
        `INSERT INTO elearning_exam_attempts
          (user_id, course_id, course_slug, course_title, percentage, passed, correct_count, total_questions, result_data)
         VALUES ($1, $2, $3, $4, 100, true, 1, 1, $5)`,
        [userId, course.id, course.slug, course.title, { results: [{ question: course.questions[0] }] }],
      );
    } else {
      await database.query(
        `INSERT INTO elearning_exam_sessions (user_id, course_snapshot, duration_minutes, expires_at)
         VALUES ($1, $2, 60, now() + interval '1 hour')`,
        [userId, course],
      );
    }
    await repository.delete(course.id);
    expect(await repository.deleteMaterialFile(file.id)).toBe(false);
    expect(await repository.readMaterialFile(file.id)).not.toBeNull();
  });
});
