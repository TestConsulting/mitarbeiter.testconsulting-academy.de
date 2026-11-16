import { randomUUID } from "node:crypto";
import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { BoardRepository } from "../db/board-repository.js";
import {
  MAX_TICKET_ATTACHMENT_SIZE,
  type TicketAttachmentRepository,
} from "../db/ticket-attachment-repository.js";
import type { UserRepository } from "../db/user-repository.js";
import { requireAuth } from "../auth/middleware.js";
import {
  contentDisposition,
  getAttachmentContentType,
  matchesAttachmentSignature,
  parseAttachmentFileName,
} from "./attachment-validation.js";

const createTicketSchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  type: z.enum(["task", "bug", "feature", "spike", "todo"]).optional(),
  dueDate: z.iso.date().nullable().optional(),
}).strict();

const updateTicketSchema = z.object({
  blocked: z.boolean().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  type: z.enum(["task", "bug", "feature", "spike", "todo"]).optional(),
  dueDate: z.iso.date().nullable().optional(),
  columnId: z.string().uuid().optional(),
  position: z.number().int().min(0).optional(),
}).strict();

const archiveTicketsSchema = z.object({
  columnId: z.string().uuid(),
}).strict();

const restoreTicketSchema = z.object({
  columnId: z.string().uuid().optional(),
}).strict();
const ticketIdSchema = z.string().uuid();
const attachmentIdSchema = z.string().uuid();

const parseAttachmentBody: RequestHandler = (request, response, next) => {
  express.raw({
    type: "application/octet-stream",
    limit: MAX_TICKET_ATTACHMENT_SIZE,
    inflate: false,
  })(request, response, (error) => {
    if (!error) {
      if (!request.is("application/octet-stream")) {
        response.status(415).json({ error: "Bitte lade die Datei als application/octet-stream hoch." });
        return;
      }
      next();
      return;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 413
    ) {
      response.status(413).json({ error: "Eine Datei darf höchstens 20 MiB groß sein." });
      return;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 415
    ) {
      response.status(415).json({ error: "Komprimierte Datei-Uploads werden nicht unterstützt." });
      return;
    }
    next(error);
  });
};

export function createTicketsRouter(
  board: BoardRepository,
  users: UserRepository,
  attachments: TicketAttachmentRepository,
): Router {
  const router = Router();
  router.use(requireAuth());

  async function assertAssigneeExists(assigneeId: string | null | undefined): Promise<boolean> {
    if (!assigneeId) return true;
    const assignee = await users.findById(assigneeId);
    return assignee !== null;
  }

  router.post("/", async (request, response, next) => {
    const payload = createTicketSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte prüfe deine Eingaben." });
      return;
    }
    try {
      if (!(await assertAssigneeExists(payload.data.assigneeId))) {
        response.status(400).json({ error: "Zugewiesene Person wurde nicht gefunden." });
        return;
      }
      const createdTicketId = randomUUID();
      const result = await board.createTicket({
        id: createdTicketId,
        columnId: payload.data.columnId,
        title: payload.data.title,
        description: payload.data.description ?? null,
        assigneeId: payload.data.assigneeId ?? null,
        priority: payload.data.priority,
        type: payload.data.type,
        dueDate: payload.data.dueDate,
        createdBy: request.session.userId!,
      });
      if (result === "column-not-found") {
        response.status(404).json({ error: "Spalte wurde nicht gefunden." });
        return;
      }
      response.status(201).json({
        tickets: result,
        createdTicketId,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get<{ id: string }>("/:id/attachments", async (request, response, next) => {
    if (!ticketIdSchema.safeParse(request.params.id).success) {
      response.status(404).json({ error: "Ticket wurde nicht gefunden." });
      return;
    }
    try {
      const result = await attachments.list(request.params.id);
      if (result === "ticket-not-found") {
        response.status(404).json({ error: "Ticket wurde nicht gefunden." });
        return;
      }
      response.json({ attachments: result });
    } catch (error) {
      next(error);
    }
  });

  router.post<{ id: string }>("/:id/attachments", parseAttachmentBody, async (request, response, next) => {
    if (!ticketIdSchema.safeParse(request.params.id).success) {
      response.status(404).json({ error: "Ticket wurde nicht gefunden." });
      return;
    }
    if (!Buffer.isBuffer(request.body) || request.body.byteLength === 0) {
      response.status(400).json({ error: "Bitte wähle eine Datei aus." });
      return;
    }
    const fileName = parseAttachmentFileName(request.get("x-file-name"));
    if (!fileName) {
      response.status(400).json({ error: "Der Dateiname ist ungültig." });
      return;
    }
    const contentType = getAttachmentContentType(fileName);
    if (!contentType) {
      response.status(400).json({ error: "Dieser Dateityp wird nicht unterstützt." });
      return;
    }
    if (!matchesAttachmentSignature(fileName, request.body)) {
      response.status(400).json({ error: "Der Dateiinhalt stimmt nicht mit dem Dateityp überein." });
      return;
    }

    try {
      const result = await attachments.create(request.params.id, fileName, contentType, request.body);
      if (result === "ticket-not-found") {
        response.status(404).json({ error: "Ticket wurde nicht gefunden." });
        return;
      }
      if (result === "file-size-limit-reached") {
        response.status(413).json({ error: "Eine Datei darf höchstens 20 MiB groß sein." });
        return;
      }
      if (result === "attachment-limit-reached") {
        response.status(413).json({ error: "Pro Ticket sind höchstens 10 Anhänge erlaubt." });
        return;
      }
      if (result === "ticket-size-limit-reached") {
        response.status(413).json({ error: "Alle Anhänge eines Tickets dürfen zusammen höchstens 100 MiB groß sein." });
        return;
      }
      response.status(201).json({ attachment: result });
    } catch (error) {
      next(error);
    }
  });

  router.get<{ id: string; attachmentId: string }>(
    "/:id/attachments/:attachmentId/download",
    async (request, response, next) => {
      if (
        !ticketIdSchema.safeParse(request.params.id).success ||
        !attachmentIdSchema.safeParse(request.params.attachmentId).success
      ) {
        response.status(404).json({ error: "Anhang wurde nicht gefunden." });
        return;
      }
      const hasPreview = Object.hasOwn(request.query, "preview");
      if (hasPreview && request.query.preview !== "1") {
        response.status(400).json({ error: "Die Vorschau ist nur mit preview=1 verfügbar." });
        return;
      }

      try {
        const attachment = await attachments.read(request.params.id, request.params.attachmentId);
        if (!attachment) {
          response.status(404).json({ error: "Anhang wurde nicht gefunden." });
          return;
        }
        const preview = hasPreview && attachment.contentType.startsWith("image/");
        if (hasPreview && !preview) {
          response.status(400).json({ error: "Eine Vorschau ist nur für Bilder verfügbar." });
          return;
        }
        response.set({
          "Content-Type": attachment.contentType,
          "Content-Length": String(attachment.size),
          "Content-Disposition": contentDisposition(
            attachment.fileName,
            preview ? "inline" : "attachment",
          ),
          "Cache-Control": "private, no-store",
          "Cross-Origin-Resource-Policy": "same-origin",
          "X-Content-Type-Options": "nosniff",
        });
        response.end(attachment.content);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete<{ id: string; attachmentId: string }>(
    "/:id/attachments/:attachmentId",
    async (request, response, next) => {
      if (
        !ticketIdSchema.safeParse(request.params.id).success ||
        !attachmentIdSchema.safeParse(request.params.attachmentId).success
      ) {
        response.status(404).json({ error: "Anhang wurde nicht gefunden." });
        return;
      }
      try {
        const result = await attachments.delete(request.params.id, request.params.attachmentId);
        if (result === "ticket-not-found") {
          response.status(404).json({ error: "Ticket wurde nicht gefunden." });
          return;
        }
        if (!result) {
          response.status(404).json({ error: "Anhang wurde nicht gefunden." });
          return;
        }
        response.json({ success: true });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch<{ id: string }>("/:id", async (request, response, next) => {
    const payload = updateTicketSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte prüfe deine Eingaben." });
      return;
    }
    try {
      if (!(await assertAssigneeExists(payload.data.assigneeId))) {
        response.status(400).json({ error: "Zugewiesene Person wurde nicht gefunden." });
        return;
      }
      const result = await board.updateTicket(request.params.id, payload.data);
      if (result === "not-found") {
        response.status(404).json({ error: "Ticket wurde nicht gefunden." });
        return;
      }
      if (result === "column-not-found") {
        response.status(404).json({ error: "Zielspalte wurde nicht gefunden." });
        return;
      }
      response.json({ tickets: result });
    } catch (error) {
      next(error);
    }
  });

  router.post("/archive", async (request, response, next) => {
    const payload = archiveTicketsSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte prüfe deine Eingaben." });
      return;
    }
    try {
      const result = await board.archiveTickets(payload.data.columnId);
      if (result === "column-not-found") {
        response.status(404).json({ error: "Spalte wurde nicht gefunden." });
        return;
      }
      if (result === "invalid-column") {
        response.status(400).json({ error: "Archivieren ist nur in Erledigt oder Fertig möglich." });
        return;
      }
      response.json({ tickets: result });
    } catch (error) {
      next(error);
    }
  });

  router.post<{ id: string }>("/:id/archive", async (request, response, next) => {
    try {
      const result = await board.archiveTicket(request.params.id);
      if (result === "not-found") {
        response.status(404).json({ error: "Ticket wurde nicht gefunden." });
        return;
      }
      if (result === "invalid-column") {
        response.status(400).json({ error: "Archivieren ist nur in Erledigt oder Fertig möglich." });
        return;
      }
      response.json({ tickets: result });
    } catch (error) {
      next(error);
    }
  });

  router.get("/archived", async (_request, response, next) => {
    try {
      const archivedTickets = await board.listArchivedTickets();
      response.json({ tickets: archivedTickets });
    } catch (error) {
      next(error);
    }
  });

  router.post<{ id: string }>("/:id/restore", async (request, response, next) => {
    const payload = restoreTicketSchema.safeParse(request.body ?? {});
    if (!payload.success) {
      response.status(400).json({ error: "Bitte prüfe deine Eingaben." });
      return;
    }
    try {
      const result = await board.restoreTicket(request.params.id, payload.data.columnId);
      if (result === "not-found") {
        response.status(404).json({ error: "Archiviertes Ticket wurde nicht gefunden." });
        return;
      }
      if (result === "column-not-found") {
        response.status(404).json({ error: "Zielspalte wurde nicht gefunden." });
        return;
      }
      response.json({ tickets: result });
    } catch (error) {
      next(error);
    }
  });

  router.delete<{ id: string }>("/:id", async (request, response, next) => {
    try {
      const result = await board.deleteTicket(request.params.id);
      if (result === "not-found") {
        response.status(404).json({ error: "Ticket wurde nicht gefunden." });
        return;
      }
      response.json({ tickets: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
