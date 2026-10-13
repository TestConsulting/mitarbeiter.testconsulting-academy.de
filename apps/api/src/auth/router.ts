import argon2 from "argon2";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { UserRepository } from "../db/user-repository.js";

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(1024),
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(12).max(1024),
  confirmPassword: z.string().min(12).max(1024),
}).strict();

export function createAuthRouter(
  users: UserRepository,
  loginLimiter: RequestHandler,
  cookieOptions: { secure: boolean; sameSite: "lax" },
): Router {
  const router = Router();

  router.post("/login", loginLimiter, async (request, response, next) => {
    const payload = loginSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte prüfe deine Eingaben." });
      return;
    }

    try {
      const user = await users.findByEmail(payload.data.email.toLowerCase());
      const validPassword = user
        ? await argon2.verify(user.passwordHash, payload.data.password).catch(() => false)
        : false;

      if (!user || !validPassword) {
        response.status(401).json({ error: "E-Mail oder Passwort ist nicht korrekt." });
        return;
      }

      request.session.regenerate((error) => {
        if (error) {
          next(error);
          return;
        }
        request.session.userId = user.id;
        request.session.save((saveError) => {
          if (saveError) {
            next(saveError);
            return;
          }
          const { passwordHash: _passwordHash, ...publicUser } = user;
          response.json({ user: publicUser });
        });
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", async (request, response, next) => {
    if (!request.session.userId) {
      response.status(401).json({ error: "Nicht angemeldet." });
      return;
    }
    try {
      const user = await users.findById(request.session.userId);
      if (!user) {
        request.session.destroy(() => undefined);
        response.status(401).json({ error: "Nicht angemeldet." });
        return;
      }
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.post("/password", loginLimiter, async (request, response, next) => {
    const userId = request.session.userId;
    if (!userId) {
      response.status(401).json({ error: "Nicht angemeldet." });
      return;
    }

    const payload = changePasswordSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ error: "Bitte prüfe deine Eingaben. Das neue Passwort muss mindestens 12 Zeichen lang sein." });
      return;
    }
    if (payload.data.newPassword !== payload.data.confirmPassword) {
      response.status(400).json({ error: "Die neuen Passwörter stimmen nicht überein." });
      return;
    }

    try {
      const user = await users.findByIdWithPasswordHash(userId);
      if (!user) {
        request.session.destroy(() => undefined);
        response.status(401).json({ error: "Nicht angemeldet." });
        return;
      }

      const validPassword = await argon2.verify(user.passwordHash, payload.data.currentPassword).catch(() => false);
      if (!validPassword) {
        response.status(400).json({ error: "Das aktuelle Passwort ist nicht korrekt." });
        return;
      }

      const passwordHash = await argon2.hash(payload.data.newPassword, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      const updated = await users.updatePasswordHash(userId, passwordHash);
      if (!updated) {
        response.status(401).json({ error: "Nicht angemeldet." });
        return;
      }
      response.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", (request, response, next) => {
    if (!request.session.userId) {
      response.status(401).json({ error: "Nicht angemeldet." });
      return;
    }
    request.session.destroy((error) => {
      if (error) {
        next(error);
        return;
      }
      response.clearCookie("tc.portal.sid", {
        httpOnly: true,
        sameSite: cookieOptions.sameSite,
        secure: cookieOptions.secure,
        path: "/",
      });
      response.json({ success: true });
    });
  });

  return router;
}