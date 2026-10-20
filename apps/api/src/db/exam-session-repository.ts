import {
  CTFL_EXAM_DURATION_MINUTES, CTFL_EXAM_EXTENDED_MINUTES,
  type AbortedExamSession, type Course, type ExamAnswer, type ExamSession,
} from "@portal/shared";
import type { Pool, PoolClient } from "pg";
import { ExamSessionError, gradeExam, selectCtflExam } from "../courses/exam-blueprint.js";
import { createExamAttemptRepository } from "./exam-attempt-repository.js";

type SessionRow = {
  id: string;
  course_snapshot: Course;
  answers: Record<string, string[]>;
  status: ExamSession["status"];
  duration_minutes: number;
  started_at: Date;
  expires_at: Date;
  finished_at: Date | null;
  result_data: ExamSession["result"];
};

export type ExamSessionRepository = {
  current(userId: string): Promise<ExamSession | null>;
  start(userId: string, course: Course, extended: boolean): Promise<ExamSession>;
  change(userId: string, id: string, action: "save" | "submit" | "abort", answers?: ExamAnswer[]): Promise<ExamSession>;
  aborted(userId: string): Promise<AbortedExamSession[]>;
};

function publicSession(row: SessionRow, now: Date): ExamSession {
  const { materials: _materials, questions, ...course } = row.course_snapshot;
  return {
    id: row.id,
    course: { ...course, questions: questions.map(({ correctOptionIds, explanation: _explanation, ...question }) =>
      ({ ...question, requiredSelections: correctOptionIds.length })) },
    status: row.status, durationMinutes: row.duration_minutes,
    startedAt: row.started_at.toISOString(), expiresAt: row.expires_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null, serverTime: now.toISOString(),
    answers: Object.entries(row.answers).map(([questionId, selectedOptionIds]) => ({ questionId, selectedOptionIds })),
    result: row.result_data,
  };
}

export function createExamSessionRepository(database: Pick<Pool, "query" | "connect">): ExamSessionRepository {
  async function locked<T>(userId: string, action: (client: PoolClient, now: Date) => Promise<T>): Promise<T> {
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [userId]);
      const clock = await client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      const result = await action(client, clock.rows[0].now);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function finish(client: PoolClient, row: SessionRow, now: Date, status: "submitted" | "expired" | "aborted") {
    row.status = status;
    row.finished_at = status === "expired" ? row.expires_at : now;
    row.result_data = status === "aborted" ? null : gradeExam(row.course_snapshot, row.answers);
    await client.query(
      `UPDATE elearning_exam_sessions SET status = $2, finished_at = $3, result_data = $4 WHERE id = $1`,
      [row.id, row.status, row.finished_at, row.result_data],
    );
    if (row.result_data) {
      await createExamAttemptRepository(client).create({
        userId: (await client.query<{ user_id: string }>(
          "SELECT user_id FROM elearning_exam_sessions WHERE id = $1", [row.id],
        )).rows[0].user_id,
        courseId: row.course_snapshot.id, courseSlug: row.course_snapshot.slug,
        courseTitle: row.course_snapshot.title, result: row.result_data, submittedAt: row.finished_at,
      });
    }
  }

  async function expire(client: PoolClient, row: SessionRow | undefined, now: Date) {
    if (row?.status === "active" && row.expires_at <= now) await finish(client, row, now, "expired");
  }

  return {
    async current(userId) {
      return locked(userId, async (client, now) => {
        const { rows } = await client.query<SessionRow>(
          `SELECT * FROM elearning_exam_sessions WHERE user_id = $1 ORDER BY (status = 'active') DESC, started_at DESC LIMIT 1`,
          [userId],
        );
        await expire(client, rows[0], now);
        return rows[0] ? publicSession(rows[0], now) : null;
      });
    },
    async start(userId, course, extended) {
      return locked(userId, async (client, now) => {
        const existing = await client.query<SessionRow>(
          "SELECT * FROM elearning_exam_sessions WHERE user_id = $1 AND status = 'active'", [userId],
        );
        await expire(client, existing.rows[0], now);
        if (existing.rows[0]?.status === "active") return publicSession(existing.rows[0], now);
        const snapshot = selectCtflExam(course);
        const duration = extended ? CTFL_EXAM_EXTENDED_MINUTES : CTFL_EXAM_DURATION_MINUTES;
        const { rows } = await client.query<SessionRow>(
          `INSERT INTO elearning_exam_sessions(user_id, course_snapshot, duration_minutes, started_at, expires_at)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [userId, snapshot, duration, now, new Date(now.getTime() + duration * 60_000)],
        );
        return publicSession(rows[0], now);
      });
    },
    async change(userId, id, action, answers = []) {
      return locked(userId, async (client, now) => {
        const { rows } = await client.query<SessionRow>(
          "SELECT * FROM elearning_exam_sessions WHERE user_id = $1 AND id = $2", [userId, id],
        );
        const row = rows[0];
        if (!row) throw new ExamSessionError(404, "Prüfungsversuch wurde nicht gefunden.");
        await expire(client, row, now);
        if (row.status !== "active") return publicSession(row, now);
        for (const answer of answers) {
          const question = row.course_snapshot.questions.find((question) => question.id === answer.questionId);
          if (!question || answer.selectedOptionIds.some((id) => !question.options.some((option) => option.id === id))) {
            throw new ExamSessionError(400, "Die Antwort gehört nicht zu diesem Prüfungsversuch.");
          }
          row.answers[answer.questionId] = answer.selectedOptionIds;
        }
        if (answers.length > 0) await client.query(
          "UPDATE elearning_exam_sessions SET answers = $2 WHERE id = $1", [row.id, row.answers],
        );
        if (action !== "save") await finish(client, row, now, action === "abort" ? "aborted" : "submitted");
        return publicSession(row, now);
      });
    },
    async aborted(userId) {
      const { rows } = await database.query<AbortedExamSession>(
        `SELECT id, course_snapshot->>'title' AS "courseTitle", started_at AS "startedAt", finished_at AS "finishedAt"
         FROM elearning_exam_sessions WHERE user_id = $1 AND status = 'aborted' ORDER BY started_at DESC`, [userId],
      );
      return rows;
    },
  };
}
