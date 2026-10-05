import pgSession from "connect-pg-simple";
import cors from "cors";
import express, { type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import session from "express-session";
import helmet from "helmet";
import type { Pool } from "pg";
import { createAuthRouter } from "./auth/router.js";
import { pool } from "./db/pool.js";
import { createUserRepository, type UserRepository } from "./db/user-repository.js";

const PgStore = pgSession(session);

type AppOptions = {
  database?: Pick<Pool, "query">;
  userRepository?: UserRepository;
  sessionStore?: session.Store;
  sessionSecret?: string;
  webOrigin?: string;
  secureCookies?: boolean;
  loginLimiter?: RequestHandler;
};

export function createApp(options: AppOptions = {}) {
  const database = options.database ?? pool;
  const secret = options.sessionSecret ?? process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  const app = express();
  const secureCookies = options.secureCookies ?? (
    process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true"
  );
  const webOrigin = options.webOrigin ?? process.env.WEB_ORIGIN ?? "http://localhost:5173";
  const store = options.sessionStore ?? new PgStore({
    pool: database as Pool,
    createTableIfMissing: true,
    tableName: "portal_sessions",
  });
  const loginLimiter = options.loginLimiter ?? rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Zu viele Anmeldeversuche. Bitte versuche es später erneut." },
  });
  const users = options.userRepository ?? createUserRepository(database as Pool);

  app.disable("x-powered-by");
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: webOrigin, credentials: true }));
  app.use(express.json({ limit: "10kb" }));
  app.use(session({
    name: "tc.portal.sid",
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    },
  }));

  app.get("/api/health", async (_request, response) => {
    try {
      await database.query("SELECT 1");
      response.json({ status: "ok", services: { database: "ok" } });
    } catch {
      response.status(503).json({ status: "error", services: { database: "unavailable" } });
    }
  });
  app.use("/api/auth", createAuthRouter(users, loginLimiter, {
    secure: secureCookies,
    sameSite: "lax",
  }));
  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "Route nicht gefunden." });
  });
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled API error", error);
    if (response.headersSent) return;
    response.status(500).json({ error: "Die Anfrage konnte nicht verarbeitet werden." });
  });

  return app;
}