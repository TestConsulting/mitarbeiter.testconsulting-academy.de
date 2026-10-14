import { randomUUID } from "node:crypto";
import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { Course, CourseInput } from "@portal/shared";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import type { CourseRepository } from "../db/course-repository.js";
import type { UserRepository } from "../db/user-repository.js";

const idSchema = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const materialFileIdSchema = z.string().uuid();
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

function createSlug(title: string, id: string): string {
  const base = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kurs";
  return `${base}-${id.slice(0, 8)}`;
}

function safeFileName(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const fileName = decoded.split(/[\\/]/).pop()?.trim() ?? "";
  if (!fileName || fileName.length > 255 || !fileName.toLowerCase().endsWith(".pdf")) return null;
  return fileName;
}

const parsePdf: RequestHandler = (request, response, next) => {
  express.raw({ type: "application/pdf", limit: "25mb" })(request, response, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error && typeof error === "object" && "status" in error && error.status === 413) {
      response.status(413).json({ error: "PDF-Dateien dürfen höchstens 25 MB groß sein." });
      return;
    }
    next(error);
  });
};

export function createCoursesRouter(courses: CourseRepository, users: UserRepository): Router {
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
        response.status(404).json({ error: "PDF-Datei wurde nicht gefunden." });
        return;
      }
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Length", file.content.byteLength);
      response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
      response.send(file.content);
    } catch (error) {
      next(error);
    }
  });

  router.post("/materials", requireAdmin(users), parsePdf, async (request, response, next) => {
    if (!Buffer.isBuffer(request.body) || request.body.byteLength === 0) {
      response.status(400).json({ error: "Bitte lade eine PDF-Datei hoch." });
      return;
    }
    const fileName = safeFileName(request.header("x-file-name") ?? "");
    if (!fileName || request.body.subarray(0, 5).toString("ascii") !== "%PDF-") {
      response.status(400).json({ error: "Bitte lade eine gültige PDF-Datei mit Dateiendung .pdf hoch." });
      return;
    }
    try {
      const file = await courses.createMaterialFile(fileName, request.body);
      const material = {
        id: file.id,
        title: file.fileName.replace(/\.pdf$/i, ""),
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
        response.status(409).json({ error: "PDF-Datei fehlt oder wird noch in einem Kurs verwendet." });
        return;
      }
      response.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (_request, response, next) => {
    try {
      response.json({ courses: await courses.list() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:slug", async (request, response, next) => {
    try {
      const course = await courses.findBySlug(request.params.slug);
      if (!course) {
        response.status(404).json({ error: "Kurs wurde nicht gefunden." });
        return;
      }
      response.json({ course });
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
