import { describe, expect, it, vi } from "vitest";
import { createExamAttemptRepository } from "./exam-attempt-repository.js";

const attempt = {
  id: "attempt-id",
  courseId: "course-id",
  courseSlug: "course-slug",
  courseTitle: "Course title",
  percentage: 75,
  passed: true,
  correctCount: 3,
  totalQuestions: 4,
  results: [],
  submitted_at: new Date("2026-10-16T08:00:00.000Z"),
};

function createDatabase() {
  return { query: vi.fn().mockResolvedValue({ rows: [attempt] }) };
}

describe("Exam attempt repository", () => {
  it("loads only attempts for the requested user in reverse chronological order", async () => {
    const database = createDatabase();
    const repository = createExamAttemptRepository(database);
    const attempts = await repository.listByUser("user-id");

    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("WHERE user_id = $1"), ["user-id"]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY submitted_at DESC, id DESC"), ["user-id"]);
    expect(attempts).toEqual([{
      id: attempt.id,
      courseId: attempt.courseId,
      courseSlug: attempt.courseSlug,
      courseTitle: attempt.courseTitle,
      percentage: attempt.percentage,
      passed: attempt.passed,
      correctCount: attempt.correctCount,
      totalQuestions: attempt.totalQuestions,
      results: attempt.results,
      submittedAt: attempt.submitted_at.toISOString(),
    }]);
  });

  it("persists the result and course snapshot with a parameterized query", async () => {
    const database = createDatabase();
    const repository = createExamAttemptRepository(database);
    const result = {
      percentage: 75,
      passed: true,
      correctCount: 3,
      totalQuestions: 4,
      results: [],
    };
    await repository.create({
      userId: "user-id",
      courseId: attempt.courseId,
      courseSlug: attempt.courseSlug,
      courseTitle: attempt.courseTitle,
      result,
    });

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO elearning_exam_attempts"),
      [
        "user-id",
        attempt.courseId,
        attempt.courseSlug,
        attempt.courseTitle,
        result.percentage,
        result.passed,
        result.correctCount,
        result.totalQuestions,
        { results: result.results },
        null,
      ],
    );
  });
});
