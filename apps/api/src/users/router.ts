import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";
import type { UserRepository } from "../db/user-repository.js";
import { requireAdmin, requireAuth } from "../auth/middleware.js";

const createUserSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["employee", "admin"]),
  password: z.string().min(12).max(1024),
}).strict();

const updateUserSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(["employee", "admin"]).optional(),
  password: z.string().min(12).max(1024).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "Bitte gib mindestens ein Feld an.",
});

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505");
}

function getDbConstraint(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("constraint" in error)) return undefined;
  const constraint = (error as { constraint?: unknown }).constraint;
  return typeof constraint === "string" ? constraint : undefined;
}

function formatValidationError(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? String(issue.path[0]) : "Eingabe";
      return `${field}: ${issue.message}`;
    })
    .slice(0, 4)
    .join(" | ");
  return details ? `Bitte pruefe deine Eingaben: ${details}` : "Bitte pruefe deine Eingaben.";
}

function isSingleAccountConstraint(error: unknown): boolean {
  const constraint = getDbConstraint(error);
  return constraint === "users_single_account" ||
    constraint === "users_single_account_admin" ||
    constraint === "users_single_account_user";
}

export function createUsersRouter(users: UserRepository): Router {
  const router = Router();
  router.use(requireAuth());

  router.get("/", async (_request, response, next) => {
    try {
      const list = await users.listAll();
      response.json({ users: list });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requireAdmin(users), async (request, response, next) => {
    const payload = createUserSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: formatValidationError(payload.error) });
      return;
    }

    try {
      const passwordHash = await argon2.hash(payload.data.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      const user = await users.create({
        email: payload.data.email.toLowerCase(),
        name: payload.data.name,
        role: payload.data.role,
        passwordHash,
      });
      response.status(201).json({ user });
    } catch (error) {
      if (isUniqueViolation(error)) {
        if (isSingleAccountConstraint(error)) {
          response.status(409).json({ error: "Die Datenbank ist noch im Single-Account-Modus. Bitte Migration 007 anwenden und erneut versuchen." });
          return;
        }
        response.status(409).json({ error: "Ein Konto mit dieser E-Mail-Adresse existiert bereits." });
        return;
      }
      next(error);
    }
  });

  router.patch<{ id: string }>("/:id", requireAdmin(users), async (request, response, next) => {
    const payload = updateUserSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: formatValidationError(payload.error) });
      return;
    }

    try {
      const user = await users.update(request.params.id, {
        email: payload.data.email?.toLowerCase(),
        name: payload.data.name,
        role: payload.data.role,
        passwordHash: payload.data.password
          ? await argon2.hash(payload.data.password, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
            parallelism: 1,
          })
          : undefined,
      });
      if (!user) {
        response.status(404).json({ error: "Benutzer wurde nicht gefunden." });
        return;
      }
      response.json({ user });
    } catch (error) {
      if (isUniqueViolation(error)) {
        if (isSingleAccountConstraint(error)) {
          response.status(409).json({ error: "Die Datenbank ist noch im Single-Account-Modus. Bitte Migration 007 anwenden und erneut versuchen." });
          return;
        }
        response.status(409).json({ error: "Ein Konto mit dieser E-Mail-Adresse existiert bereits." });
        return;
      }
      next(error);
    }
  });

  router.delete<{ id: string }>("/:id", requireAdmin(users), async (request, response, next) => {
    if (request.session.userId === request.params.id) {
      response.status(400).json({ error: "Das aktuell angemeldete Admin-Konto kann nicht gelöscht werden." });
      return;
    }
    try {
      const deleted = await users.delete(request.params.id);
      if (!deleted) {
        response.status(404).json({ error: "Benutzer wurde nicht gefunden." });
        return;
      }
      response.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
