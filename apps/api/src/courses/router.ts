import { randomUUID } from "node:crypto";
import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  EXAM_PASS_THRESHOLD,
  type Course,
  type CourseInput,
  type CourseSummary,
  type ExamCourse,
  type ExamSubmissionResult,
  type ExamQuestionResult,
} from "@portal/shared";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import type { CourseRepository } from "../db/course-repository.js";
import type { ExamAttemptRepository } from "../db/exam-attempt-repository.js";
import type { UserRepository } from "../db/user-repository.js";
import type { PracticeProgressRepository } from "../db/practice-progress-repository.js";

const idSchema = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const materialFileIdSchema = z.string().uuid();
const materialContentTypes = {
  ".pdf": "application/pdf",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
} as const;
const idText = z.string().trim().min(1).max(100);
const materialSchema = z.object({
  id: idText,
  title: z.string().trim().min(1).max(200),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.string().trim().max(40).optional(),
  url: z.string().trim().min(1).max(2048).refine((value) => {
    if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }),
}).strict();
const questionSchema = z.object({
  id: idText,
  question: z.string().trim().min(1).max(2000),
  type: z.enum(["single", "multiple"]),
  options: z.array(z.object({
    id: idText,
    text: z.string().trim().min(1).max(1000),
  }).strict()).min(2).max(10),
  correctOptionIds: z.array(idText).min(1).max(10),
  explanation: z.string().trim().min(1).max(5000),
  metadata: z.object({
    chapter: z.number().int().min(1).max(6),
    chapterTitle: z.string().trim().min(1).max(200),
    learningObjective: z.string().regex(/^FL-[1-6]\.\d+\.\d+$/),
    kLevel: z.enum(["K1", "K2", "K3"]),
  }).strict().optional(),
}).strict().superRefine((question, context) => {
  const optionIds = question.options.map((option) => option.id);
  if (new Set(optionIds).size !== optionIds.length) {
    context.addIssue({ code: "custom", message: "Antwortmöglichkeiten brauchen eindeutige IDs." });
  }
  if (new Set(question.correctOptionIds).size !== question.correctOptionIds.length ||
      question.correctOptionIds.some((id) => !optionIds.includes(id))) {
    context.addIssue({ code: "custom", message: "Die richtigen Antworten müssen zu den Antwortmöglichkeiten gehören." });
  }
  if (question.type === "single" && question.correctOptionIds.length !== 1) {
    context.addIssue({ code: "custom", message: "Einfachauswahl benötigt genau eine richtige Antwort." });
  }
  if (question.type === "multiple" && question.correctOptionIds.length < 2) {
    context.addIssue({ code: "custom", message: "Mehrfachauswahl benötigt mindestens zwei richtige Antworten." });
  }
});
const courseInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(["Vorstellung", "ISTQB", "Sonstiges"]),
  description: z.string().trim().min(1).max(2000),
  isDemo: z.boolean().optional(),
  demoNotice: z.string().trim().max(5000).optional(),
  materials: z.array(materialSchema).max(20),
  questions: z.array(questionSchema).max(100),
}).strict().superRefine((course, context) => {
  if (new Set(course.materials.map((material) => material.id)).size !== course.materials.length) {
    context.addIssue({ code: "custom", message: "Lernmaterialien brauchen eindeutige IDs." });
  }
  if (new Set(course.questions.map((question) => question.id)).size !== course.questions.length) {
    context.addIssue({ code: "custom", message: "Übungsfragen brauchen eindeutige IDs." });
  }
});
const examSubmissionSchema = z.object({
  answers: z.array(z.object({
    questionId: idText,
    selectedOptionIds: z.array(idText).max(10),
  }).strict()).max(100),
}).strict().superRefine(({ answers }, context) => {
  if (new Set(answers.map((answer) => answer.questionId)).size !== answers.length) {
    context.addIssue({ code: "custom", message: "Jede Prüfungsfrage darf nur einmal beantwortet werden." });
  }
  answers.forEach((answer, index) => {
    if (new Set(answer.selectedOptionIds).size !== answer.selectedOptionIds.length) {
      context.addIssue({
        code: "custom",
        message: "Eine Antwort darf nicht mehrfach ausgewählt sein.",
        path: ["answers", index, "selectedOptionIds"],
      });
    }
  });
});

function createSlug(title: string, id: string): string {
  const base = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kurs";
  return `${base}-${id.slice(0, 8)}`;
}

function toCourseSummary(course: Course): CourseSummary {
  const { questions, ...summary } = course;
  return { ...summary, questionCount: questions.length };
}

function toExamCourse(course: Course): ExamCourse {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    category: course.category,
    description: course.description,
    ...(course.isDemo !== undefined ? { isDemo: course.isDemo } : {}),
    ...(course.demoNotice !== undefined ? { demoNotice: course.demoNotice } : {}),
    questions: course.questions.map(({ id, question, type, options }) => ({
      id,
      question,
      type,
      options,
    })),
  };
}

function safeFileName(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const fileName = decoded.split(/[\\/]/).pop()?.trim() ?? "";
  const extension = fileName.match(/\.[^.]+$/)?.[0].toLowerCase();
  if (!fileName || fileName.length > 255 || !extension || !(extension in materialContentTypes)) return null;
  return fileName;
}

function matchesMaterialSignature(fileName: string, content: Buffer): boolean {
  const extension = fileName.match(/\.[^.]+$/)?.[0].toLowerCase();
  switch (extension) {
    case ".pdf":
      return content.subarray(0, 5).toString("ascii") === "%PDF-";
    case ".gif":
      return ["GIF87a", "GIF89a"].includes(content.subarray(0, 6).toString("ascii"));
    case ".jpeg":
    case ".jpg":
      return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
    case ".png":
      return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case ".webp":
      return content.subarray(0, 4).toString("ascii") === "RIFF" &&
        content.subarray(8, 12).toString("ascii") === "WEBP";
    default:
      return false;
  }
}

function materialContentType(fileName: string): string | null {
  const extension = fileName.match(/\.[^.]+$/)?.[0].toLowerCase();
  if (!extension || !(extension in materialContentTypes)) return null;
  return materialContentTypes[extension as keyof typeof materialContentTypes];
}

const parseMaterial: RequestHandler = (request, response, next) => {
  express.raw({ type: Object.values(materialContentTypes), limit: "25mb" })(request, response, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error && typeof error === "object" && "status" in error && error.status === 413) {
      response.status(413).json({ error: "Lernmaterialien dürfen höchstens 25 MB groß sein." });
      return;
    }
    next(error);
  });
};

export function createCoursesRouter(
  courses: CourseRepository,
  users: UserRepository,
  examAttempts: ExamAttemptRepository,
  practiceProgress: PracticeProgressRepository,
): Router {
  const router = Router();
  router.use(requireAuth());

  router.get("/materials/:id/download", async (request, response, next) => {
    const id = materialFileIdSchema.safeParse(request.params.id);
    if (!id.success) {
      response.status(400).json({ error: "Ungültige Material-ID." });
      return;
    }
    try {
      const file = await courses.readMaterialFile(id.data);
      if (!file) {
        response.status(404).json({ error: "Lernmaterial wurde nicht gefunden." });
        return;
      }
      const contentType = materialContentType(file.fileName);
      if (!contentType) {
        response.status(415).json({ error: "Der Dateityp des Lernmaterials wird nicht unterstützt." });
        return;
      }
      const isImagePreview = request.query.preview === "1" && contentType.startsWith("image/");
      response.setHeader("Content-Type", contentType);
      response.setHeader("Content-Length", file.content.byteLength);
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader(
        "Content-Disposition",
        `${isImagePreview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      );
      response.send(file.content);
    } catch (error) {
      next(error);
    }
  });

  router.post("/materials", requireAdmin(users), parseMaterial, async (request, response, next) => {
    if (!Buffer.isBuffer(request.body) || request.body.byteLength === 0) {
      response.status(400).json({ error: "Bitte lade eine PDF- oder Bilddatei hoch." });
      return;
    }
    const fileName = safeFileName(request.header("x-file-name") ?? "");
    const contentType = fileName ? materialContentType(fileName) : null;
    const requestContentType = request.header("content-type")?.split(";", 1)[0].trim().toLowerCase();
    if (!fileName || !contentType || requestContentType !== contentType ||
        !matchesMaterialSignature(fileName, request.body)) {
      response.status(400).json({
        error: "Bitte lade eine gültige PDF-, PNG-, JPEG-, GIF- oder WebP-Datei hoch.",
      });
      return;
    }
    try {
      const file = await courses.createMaterialFile(fileName, request.body);
      const material = {
        id: file.id,
        title: file.fileName.replace(/\.[^.]+$/, ""),
        fileName: file.fileName,
        fileSize: `${Math.max(1, Math.round(file.sizeBytes / 1024))} KB`,
        url: `/api/courses/materials/${file.id}/download`,
      };
      response.status(201).json({ material });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/materials/:id", requireAdmin(users), async (request, response, next) => {
    const id = materialFileIdSchema.safeParse(request.params.id);
    if (!id.success) {
      response.status(400).json({ error: "Ungültige Material-ID." });
      return;
    }
    try {
      if (!await courses.deleteMaterialFile(id.data)) {
        response.status(409).json({ error: "Lernmaterial fehlt oder wird noch in einem Kurs verwendet." });
        return;
      }
      response.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (_request, response, next) => {
    try {
      response.json({ courses: (await courses.list()).map(toCourseSummary) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/results", async (request, response, next) => {
    const userId = request.session.userId;
    if (!userId) {
      response.status(401).json({ error: "Nicht angemeldet." });
      return;
    }
    try {
      response.json({ attempts: await examAttempts.listByUser(userId) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/:slug", requireAdmin(users), async (request, response, next) => {
    const slug = typeof request.params.slug === "string" ? request.params.slug : "";
    if (!slug) {
      response.status(400).json({ error: "Ungültiger Kurs." });
      return;
    }
    try {
      const course = await courses.findBySlug(slug);
      if (!course) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      response.json({ course });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:slug/exam", async (request, response, next) => {
    const slug = typeof request.params.slug === "string" ? request.params.slug : "";
    if (!slug) {
      response.status(400).json({ error: "Ungültiger Kurs." });
      return;
    }
    try {
      const course = await courses.findBySlug(slug);
      if (!course) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      response.json({ course: toExamCourse(course) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:slug/exam/submit", async (request, response, next) => {
    const slug = typeof request.params.slug === "string" ? request.params.slug : "";
    if (!slug) {
      response.status(400).json({ error: "Ungültiger Kurs." });
      return;
    }
    if (slug === "istqb-foundation") {
      response.status(409).json({ error: "Bitte starte die Prüfung über die Prüfungsvorbereitung." });
      return;
    }
    const submission = examSubmissionSchema.safeParse(request.body);
    if (!submission.success) {
      response.status(400).json({ error: "Die Prüfungsantworten sind ungültig." });
      return;
    }
    try {
      const course = await courses.findBySlug(slug);
      if (!course) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      if (course.questions.length === 0) {
        response.status(400).json({ error: "Für diesen Kurs sind keine Prüfungsfragen vorhanden." });
        return;
      }

      const answers = new Map(submission.data.answers.map((answer) => [answer.questionId, answer.selectedOptionIds]));
      if (submission.data.answers.some((answer) => !course.questions.some((question) => question.id === answer.questionId)) ||
          submission.data.answers.some((answer) => {
            const question = course.questions.find((entry) => entry.id === answer.questionId);
            return question && answer.selectedOptionIds.some((id) => !question.options.some((option) => option.id === id));
          })) {
        response.status(400).json({ error: "Eine Prüfungsantwort gehört nicht zu diesem Fragenkatalog." });
        return;
      }

      const results: ExamQuestionResult[] = course.questions.map((question) => {
        const selectedOptionIds = answers.get(question.id) ?? [];
        const correctOptionIds = question.correctOptionIds;
        return {
          question: {
            id: question.id,
            question: question.question,
            type: question.type,
            options: question.options,
          },
          selectedOptionIds,
          correctOptionIds,
          explanation: question.explanation,
          isCorrect: selectedOptionIds.length === correctOptionIds.length &&
            selectedOptionIds.every((id) => correctOptionIds.includes(id)),
        };
      });
      const correctCount = results.filter((result) => result.isCorrect).length;
      const percentage = Math.round((correctCount / results.length) * 100);
      const result: ExamSubmissionResult = {
        percentage,
        passed: percentage >= EXAM_PASS_THRESHOLD,
        correctCount,
        totalQuestions: results.length,
        results,
      };
      const attempt = await examAttempts.create({
        userId: request.session.userId!,
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        result,
      });
      response.json({ result, attemptId: attempt.id });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:slug/practice/progress", async (request, response, next) => {
    try {
      const course = await courses.findBySlug(request.params.slug);
      if (!course) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      response.json({ progress: await practiceProgress.list(request.session.userId!, course.id, course.questions) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:slug/practice/answer", async (request, response, next) => {
    const answer = z.object({
      questionId: idText,
      selectedOptionIds: z.array(idText).min(1).max(10),
    }).strict().safeParse(request.body);
    if (!answer.success) {
      response.status(400).json({ error: "Die Übungsantwort ist ungültig." });
      return;
    }
    try {
      const course = await courses.findBySlug(request.params.slug);
      if (!course) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      const question = course.questions.find((item) => item.id === answer.data.questionId);
      const ids = answer.data.selectedOptionIds;
      if (!question || new Set(ids).size !== ids.length ||
          ids.some((id) => !question.options.some((option) => option.id === id)) ||
          (question.type === "single" && ids.length !== 1)) {
        response.status(400).json({ error: "Die Antwort gehört nicht zu dieser Übungsfrage." });
        return;
      }
      const isCorrect = ids.length === question.correctOptionIds.length &&
        ids.every((id) => question.correctOptionIds.includes(id));
      response.json({
        progress: await practiceProgress.record(request.session.userId!, course.id, question, isCorrect),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:slug/practice", async (request, response, next) => {
    const slug = typeof request.params.slug === "string" ? request.params.slug : "";
    if (!slug) {
      response.status(400).json({ error: "Ungültiger Kurs." });
      return;
    }
    try {
      const course = await courses.findBySlug(slug);
      if (!course) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      response.json({ course });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:slug", async (request, response, next) => {
    const slug = typeof request.params.slug === "string" ? request.params.slug : "";
    if (!slug) {
      response.status(400).json({ error: "Ungültiger Kurs." });
      return;
    }
    try {
      const course = await courses.findBySlug(slug);
      if (!course) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      response.json({ course: toCourseSummary(course) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireAdmin(users), async (request, response, next) => {
    const payload = courseInputSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte prüfe Kurstitel, Beschreibung, Lernmaterialien und Übungsfragen." });
      return;
    }
    const id = randomUUID();
    const input: CourseInput = payload.data;
    const course: Course = {
      ...input,
      id,
      slug: createSlug(payload.data.title, id),
    };
    try {
      response.status(201).json({ course: await courses.create(course) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", requireAdmin(users), async (request, response, next) => {
    const id = idSchema.safeParse(request.params.id);
    const payload = courseInputSchema.safeParse(request.body);
    if (!id.success || !payload.success) {
      response.status(400).json({ error: "Bitte prüfe Kurs-ID, Titel, Beschreibung, Lernmaterialien und Übungsfragen." });
      return;
    }
    try {
      const existing = await courses.findById(id.data);
      if (!existing) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      const updated = await courses.update(id.data, {
        ...payload.data,
        id: existing.id,
        slug: existing.slug,
      });
      if (!updated) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      response.json({ course: updated });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", requireAdmin(users), async (request, response, next) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) {
      response.status(400).json({ error: "Ungültige Kurs-ID." });
      return;
    }
    try {
      if (!await courses.delete(id.data)) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      response.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
