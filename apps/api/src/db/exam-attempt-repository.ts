import type { ExamAttempt, ExamSubmissionResult } from "@portal/shared";
import type { Pool } from "pg";

export type ExamAttemptInput = {
  userId: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  result: ExamSubmissionResult;
  submittedAt?: Date;
};

export type ExamAttemptRepository = {
  listByUser(userId: string): Promise<ExamAttempt[]>;
  create(input: ExamAttemptInput): Promise<ExamAttempt>;
};

type ExamAttemptRow = Omit<ExamAttempt, "submittedAt"> & {
  submitted_at: Date | string;
};

const fields = `id, course_id AS "courseId", course_slug AS "courseSlug",
  course_title AS "courseTitle", percentage, passed, correct_count AS "correctCount",
  total_questions AS "totalQuestions", result_data->'results' AS results, submitted_at`;

function toAttempt(row: ExamAttemptRow): ExamAttempt {
  return {
    id: row.id,
    courseId: row.courseId,
    courseSlug: row.courseSlug,
    courseTitle: row.courseTitle,
    percentage: row.percentage,
    passed: row.passed,
    correctCount: row.correctCount,
    totalQuestions: row.totalQuestions,
    results: row.results,
    submittedAt: row.submitted_at instanceof Date ? row.submitted_at.toISOString() : row.submitted_at,
  };
}

export function createExamAttemptRepository(database: Pick<Pool, "query">): ExamAttemptRepository {
  return {
    async listByUser(userId) {
      const result = await database.query<ExamAttemptRow>(
        `SELECT ${fields}
         FROM elearning_exam_attempts
         WHERE user_id = $1
         ORDER BY submitted_at DESC, id DESC`,
        [userId],
      );
      return result.rows.map(toAttempt);
    },
    async create(input) {
      const result = await database.query<ExamAttemptRow>(
        `INSERT INTO elearning_exam_attempts (
           user_id, course_id, course_slug, course_title, percentage, passed,
           correct_count, total_questions, result_data, submitted_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, now()))
         RETURNING ${fields}`,
        [
          input.userId,
          input.courseId,
          input.courseSlug,
          input.courseTitle,
          input.result.percentage,
          input.result.passed,
          input.result.correctCount,
          input.result.totalQuestions,
          { results: input.result.results },
          input.submittedAt ?? null,
        ],
      );
      return toAttempt(result.rows[0]);
    },
  };
}
