import { Router } from "express";
import type { UserRepository } from "../db/user-repository.js";
import { requireAuth } from "../auth/middleware.js";

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

  return router;
}
