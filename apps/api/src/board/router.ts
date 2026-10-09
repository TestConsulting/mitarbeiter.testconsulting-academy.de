import { Router } from "express";
import { z } from "zod";
import type { BoardRepository } from "../db/board-repository.js";
import type { UserRepository } from "../db/user-repository.js";
import { requireAuth } from "../auth/middleware.js";

const createColumnSchema = z.object({
  title: z.string().trim().min(1).max(60),
}).strict();

const updateColumnSchema = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  position: z.number().int().min(0).optional(),
}).strict().refine((value) => value.title !== undefined || value.position !== undefined, {
  message: "Bitte gib mindestens ein Feld an.",
});

export function createBoardRouter(board: BoardRepository, users: UserRepository): Router {
  const router = Router();
  router.use(requireAuth());

  router.get("/", async (_request, response, next) => {
    try {
      response.json(await board.getBoard());
    } catch (error) {
      next(error);
    }
  });

  router.post("/columns", async (request, response, next) => {
    const payload = createColumnSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte gib einen Spaltennamen an." });
      return;
    }
    try {
      const columns = await board.createColumn(payload.data.title);
      response.status(201).json({ columns });
    } catch (error) {
      next(error);
    }
  });

  router.patch<{ id: string }>("/columns/:id", async (request, response, next) => {
    const payload = updateColumnSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte prüfe deine Eingaben." });
      return;
    }
    try {
      const result = await board.updateColumn(request.params.id, payload.data);
      if (result === "not-found") {
        response.status(404).json({ error: "Spalte wurde nicht gefunden." });
        return;
      }
      response.json({ columns: result });
    } catch (error) {
      next(error);
    }
  });

  router.delete<{ id: string }>("/columns/:id", async (request, response, next) => {
    try {
      const result = await board.deleteColumn(request.params.id);
      if (result === "not-found") {
        response.status(404).json({ error: "Spalte wurde nicht gefunden." });
        return;
      }
      if (result === "not-empty") {
        response.status(409).json({ error: "Die Spalte enthält noch Tickets. Bitte zuerst verschieben." });
        return;
      }
      response.json({ columns: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
