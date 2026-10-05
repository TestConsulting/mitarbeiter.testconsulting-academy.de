# Integration Hand-off

## Backend

- Folder: `apps/api`
- Run: `npm run dev --workspace @portal/api` (port `4000`)
- Build: `npm run build --workspace @portal/api`
- Health: `GET /api/health`
- Auth/session implementation exists in `src/auth/router.ts` and `src/app.ts`.

## Frontend

- Folder: `apps/web`
- Dev: `npm run dev --workspace @portal/web` (Vite; port `5173`, API proxy to `localhost:4000`)
- Build: `npm run build --workspace @portal/web`
- Live API seam: `src/api/client.ts`; all requests use same-origin `/api` and cookie credentials.
- There are no mock clients, mock datasets, duplicated local API types, or mock-state switchers to remove. Preserve real cookie authentication and do not add a sign-in bypass.

## API Routes

- `GET /api/health` — API/database readiness (`200`, `503`)
- `POST /api/auth/login` — validated email/password (`200`, `400`, `401`, `429`, `500`)
- `GET /api/auth/me` — current session user (`200`, `401`)
- `POST /api/auth/logout` — destroy current session (`200`, `401`, `500`)
- All future non-login portal APIs must enforce authorization server-side. Do not add Phase-2 content routes.

## Database

- PostgreSQL; local service is `postgres` in root `compose.yaml`.
- Connection: `DATABASE_URL`; Compose settings: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.
- User schema file: `apps/api/migrations/001_create_users.sql`.
- Session schema: `connect-pg-simple` creates `portal_sessions` at API startup.
- Do not add sample or seed rows to schema migrations. The separately invoked local account command is `npm run seed --workspace @portal/api`; credentials come only from uncommitted `.env`.
- No file store or external integration is in Phase 1.

## Shared Types

- Package: `packages/shared/src/index.ts`
- Import alias: `@portal/shared`

## Services

- Essential: local PostgreSQL for employee accounts and persistent sessions.
- Enhancement: none in Phase 1.

## Required Integration Work

- Verify the SQL bootstrap and persistent session behavior against PostgreSQL.
- Smoke-test all four routes and protected frontend navigation with the local account.
- Keep the login limited to Argon2id email/password; no registration, SSO, email reset, business CRUD, CV/Tasks logic, or external service setup.