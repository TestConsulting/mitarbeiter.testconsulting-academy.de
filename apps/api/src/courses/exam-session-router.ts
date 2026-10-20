import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { CourseRepository } from "../db/course-repository.js";
import type { ExamSessionRepository } from "../db/exam-session-repository.js";
import { ExamSessionError } from "./exam-blueprint.js";

const answersSchema = z.array(z.object({
  questionId: z.string().min(1).max(100),
  selectedOptionIds: z.array(z.string().min(1).max(100)).max(10)
    .refine((ids) => new Set(ids).size === ids.length),
}).strict()).max(40).refine((answers) => new Set(answers.map((answer) => answer.questionId)).size === answers.length);

export function createExamSessionRouter(courses: CourseRepository, sessions: ExamSessionRepository) {
  const router = Router();
  router.use(requireAuth());
  router.use((_request, response, next) => { response.set("Cache-Control", "no-store"); next(); });
  router.get("/current", async (request, response, next) => {
    try { response.json({ session: await sessions.current(request.session.userId!) }); }
    catch (error) { next(error); }
  });
  router.get("/aborted", async (request, response, next) => {
    try { response.json({ attempts: await sessions.aborted(request.session.userId!) }); }
    catch (error) { next(error); }
  });
  router.post("/start", async (request, response, next) => {
    const input = z.object({
      slug: z.literal("istqb-foundation"), extended: z.boolean(),
    }).strict().safeParse(request.body);
    if (!input.success) { response.status(400).json({ error: "Ungültige Prüfungseinstellungen." }); return; }
    try {
      const course = await courses.findBySlug(input.data.slug);
      if (!course) { response.status(404).json({ error: "Kurs wurde nicht gefunden." }); return; }
      response.json({ session: await sessions.start(request.session.userId!, course, input.data.extended) });
    } catch (error) { next(error); }
  });
  router.post("/:id/:action", async (request, response, next) => {
    const id = z.string().uuid().safeParse(request.params.id);
    const action = z.enum(["save", "submit", "abort"]).safeParse(request.params.action);
    const body = z.object({ answers: answersSchema.optional() }).strict().safeParse(request.body);
    if (!id.success || !action.success || !body.success) {
      response.status(400).json({ error: "Die Prüfungsantworten sind ungültig." }); return;
    }
    try {
      response.json({ session: await sessions.change(
        request.session.userId!, id.data, action.data, body.data.answers,
      ) });
    } catch (error) { next(error); }
  });
  router.use((error: unknown, _request: import("express").Request, response: import("express").Response,
    next: import("express").NextFunction) => {
    if (error instanceof ExamSessionError) response.status(error.status).json({ error: error.message });
    else next(error);
  });
  return router;
}
