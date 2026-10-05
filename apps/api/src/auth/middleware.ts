import type { RequestHandler } from "express";
import type { UserRepository } from "../db/user-repository.js";

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
        if (!user || user.role !== "admin") {
          response.status(403).json({ error: "Nur für Administratorinnen und Administratoren verfügbar." });
          return;
        }
        next();
      })
      .catch(next);
  };
}
