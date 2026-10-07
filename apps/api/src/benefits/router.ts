import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import type { BenefitRepository } from "../db/benefit-repository.js";
import type { UserRepository } from "../db/user-repository.js";

const benefitSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  details: z.string().trim().min(1).max(5000),
}).strict();
const idSchema = z.string().uuid();
const invalidInput = "Bitte fülle Titel, Kurzbeschreibung und Details aus (maximal 120, 500 und 5000 Zeichen).";

export function createBenefitsRouter(benefits: BenefitRepository, users: UserRepository): Router {
  const router = Router();
  router.use(requireAuth());

  router.get("/", async (_request, response, next) => {
    try {
      response.json({ benefits: await benefits.list() });
    } catch (error) {
      next(error);
    }
  });

  router.get<{ id: string }>("/:id", async (request, response, next) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) {
      response.status(400).json({ error: "Ungültige Benefit-ID." });
      return;
    }
    try {
      const benefit = await benefits.findById(id.data);
      if (!benefit) {
        response.status(404).json({ error: "Benefit wurde nicht gefunden." });
        return;
      }
      response.json({ benefit });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireAdmin(users), async (request, response, next) => {
    const payload = benefitSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: invalidInput });
      return;
    }
    try {
      response.status(201).json({ benefit: await benefits.create(payload.data) });
    } catch (error) {
      next(error);
    }
  });

  router.put<{ id: string }>("/:id", requireAdmin(users), async (request, response, next) => {
    const id = idSchema.safeParse(request.params.id);
    const payload = benefitSchema.safeParse(request.body);
    if (!id.success || !payload.success) {
      response.status(400).json({ error: invalidInput });
      return;
    }
    try {
      const benefit = await benefits.update(id.data, payload.data);
      if (!benefit) {
        response.status(404).json({ error: "Benefit wurde nicht gefunden." });
        return;
      }
      response.json({ benefit });
    } catch (error) {
      next(error);
    }
  });

  router.delete<{ id: string }>("/:id", requireAdmin(users), async (request, response, next) => {
    const id = idSchema.safeParse(request.params.id);
    if (!id.success) {
      response.status(400).json({ error: "Ungültige Benefit-ID." });
      return;
    }
    try {
      if (!await benefits.delete(id.data)) {
        response.status(404).json({ error: "Benefit wurde nicht gefunden." });
        return;
      }
      response.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
