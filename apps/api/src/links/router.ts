import { Router } from "express";
import { z } from "zod";
import { isValidAppLinkUrl, normalizeAppLinkUrl } from "@portal/shared";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import type { AppLinkRepository } from "../db/app-link-repository.js";
import type { UserRepository } from "../db/user-repository.js";

const linkSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  icon: z.string().trim().min(1).max(12),
  url: z.string().transform(normalizeAppLinkUrl).pipe(z.string().max(2048).refine(isValidAppLinkUrl)),
  sortOrder: z.number().int().min(0).max(2147483647),
}).strict();
const idSchema = z.string().uuid();
const orderSchema = z.object({
  ids: z.array(idSchema.transform((id) => id.toLowerCase())).min(1).refine((ids) => new Set(ids).size === ids.length),
}).strict();

export function createLinksRouter(links: AppLinkRepository, users: UserRepository): Router {
  const router = Router();
  router.use(requireAuth());

  router.get("/", async (_request, response, next) => {
    try {
      response.json({ links: await links.list() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireAdmin(users), async (request, response, next) => {
    const payload = linkSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte prüfe deine Eingaben. Erlaubt sind HTTP-/HTTPS-URLs ohne Zugangsdaten oder mailto: mit einer E-Mail-Adresse und eine nicht negative ganzzahlige Reihenfolge." });
      return;
    }
    try {
      response.status(201).json({ link: await links.create(payload.data) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/order", requireAdmin(users), async (request, response, next) => {
    const payload = orderSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte gib alle Link-IDs genau einmal in der gewünschten Reihenfolge an." });
      return;
    }
    try {
      const reordered = await links.reorder(payload.data.ids);
      if (!reordered) {
        response.status(409).json({ error: "Die Links haben sich geändert. Bitte lade die Seite neu und versuche es erneut." });
        return;
      }
      response.json({ links: reordered });
    } catch (error) {
      next(error);
    }
  });

  router.put<{ id: string }>("/:id", requireAdmin(users), async (request, response, next) => {
    const id = idSchema.safeParse(request.params.id);
    const payload = linkSchema.safeParse(request.body);
    if (!id.success || !payload.success) {
      response.status(400).json({ error: "Bitte prüfe deine Eingaben. Erlaubt sind HTTP-/HTTPS-URLs ohne Zugangsdaten oder mailto: mit einer E-Mail-Adresse und eine nicht negative ganzzahlige Reihenfolge." });
      return;
    }
    try {
      const link = await links.update(id.data, payload.data);
      if (!link) {
        response.status(404).json({ error: "Link wurde nicht gefunden." });
        return;
      }
      response.json({ link });
    } catch (error) {
      next(error);
    }
  });

  router.delete<{ id: string }>("/:id", requireAdmin(users), async (request, response, next) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) {
      response.status(400).json({ error: "Ungültige Link-ID." });
      return;
    }
    try {
      if (!await links.delete(id.data)) {
        response.status(404).json({ error: "Link wurde nicht gefunden." });
        return;
      }
      response.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
