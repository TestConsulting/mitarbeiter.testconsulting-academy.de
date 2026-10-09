import { Router } from "express";
import { z } from "zod";
import type { BoardRepository } from "../db/board-repository.js";
import type { UserRepository } from "../db/user-repository.js";
import { requireAuth } from "../auth/middleware.js";

const createTicketSchema = z.object({
  columnId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
}).strict();

const updateTicketSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  columnId: z.string().uuid().optional(),
  position: z.number().int().min(0).optional(),
}).strict();

const archiveTicketsSchema = z.object({
  columnId: z.string().uuid(),
}).strict();

const restoreTicketSchema = z.object({
  columnId: z.string().uuid().optional(),
}).strict();

export function createTicketsRouter(board: BoardRepository, users: UserRepository): Router {
  const router = Router();
  router.use(requireAuth());

  async function assertAssigneeExists(assigneeId: string | null | undefined): Promise<boolean> {
    if (!assigneeId) return true;
    const assignee = await users.findById(assigneeId);
    return assignee !== null;
  }

  // Jede angemeldete Person darf Tickets anlegen/bearbeiten/löschen (SPEC 2: Mitarbeiter-Recht „Tasks anlegen/bearbeiten“).
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
      const result = await board.createTicket({
        columnId: payload.data.columnId,
        title: payload.data.title,
        description: payload.data.description ?? null,
        assigneeId: payload.data.assigneeId ?? null,
        createdBy: request.session.userId!,
      });
      if (result === "column-not-found") {
        response.status(404).json({ error: "Spalte wurde nicht gefunden." });
        return;
      }
      response.status(201).json({ tickets: result });
    } catch (error) {
      next(error);
    }
  });

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
