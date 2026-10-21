import { createHash } from "node:crypto";
import type { PracticeProgress, PracticeQuestion } from "@portal/shared";
import type { Pool } from "pg";

export type PracticeProgressRepository = {
  list(userId: string, courseId: string, questions: PracticeQuestion[]): Promise<PracticeProgress[]>;
  record(userId: string, courseId: string, question: PracticeQuestion, isCorrect: boolean): Promise<PracticeProgress>;
};

function fingerprint(question: PracticeQuestion) {
  return createHash("sha256").update(JSON.stringify([
    question.question, question.type, question.options, question.correctOptionIds, question.explanation,
    ...(question.image ? [question.image] : []),
  ])).digest("hex");
}

export function createPracticeProgressRepository(database: Pick<Pool, "query">): PracticeProgressRepository {
  return {
    async list(userId, courseId, questions) {
      const result = await database.query<PracticeProgress & { fingerprint: string }>(
        `SELECT question_id AS "questionId", last_correct AS "lastCorrect", question_fingerprint AS fingerprint
         FROM elearning_practice_progress WHERE user_id = $1 AND course_id = $2`,
        [userId, courseId],
      );
      const fingerprints = new Map(questions.map((question) => [question.id, fingerprint(question)]));
      return result.rows.filter((row) => fingerprints.get(row.questionId) === row.fingerprint)
        .map(({ questionId, lastCorrect }) => ({ questionId, lastCorrect }));
    },
    async record(userId, courseId, question, isCorrect) {
      await database.query(
        `INSERT INTO elearning_practice_progress (user_id, course_id, question_id, question_fingerprint, last_correct)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, course_id, question_id) DO UPDATE
         SET question_fingerprint = EXCLUDED.question_fingerprint, last_correct = EXCLUDED.last_correct, updated_at = now()`,
        [userId, courseId, question.id, fingerprint(question), isCorrect],
      );
      return { questionId: question.id, lastCorrect: isCorrect };
    },
  };
}
