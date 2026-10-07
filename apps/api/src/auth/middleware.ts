import type { RequestHandler } from "express";
import type { UserRepository } from "../db/user-repository.js";
import { canManagePortal } from "@portal/shared";

export function requireAuth(): RequestHandler {
  return (request, response, next) => {
    if (!request.session.userId) {
      response.status(401).json({ error: "Nicht angemeldet." });
      return;
    }
    next();
  };
}

export function requireAdmin(users: UserRepository): RequestHandler {
  return (request, response, next) => {
    if (!request.session.userId) {
      response.status(401).json({ error: "Nicht angemeldet." });
      return;
    }
    users.findById(request.session.userId)
      .then((user) => {
        if (!canManagePortal(user)) {
          response.status(403).json({ error: "Keine Berechtigung zum Verwalten dieses Bereichs." });
          return;
        }
        next();
      })
      .catch(next);
  };
}
