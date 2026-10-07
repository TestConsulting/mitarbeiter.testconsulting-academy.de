# Project Plan

**Status**: Approved
**Created**: 2026-10-05
**Mode**: NEW

**Scope-Erweiterung (2026-10-06)**: Der folgende Ausgangsplan beschreibt Phase 1. Durch den Nutzerauftrag ist jetzt zusätzlich Application Links aus Phase 2 freigegeben: geschützte Route `/areas/applications`, Link-Kacheln, Kürzel, externe Ziel-URLs, Reihenfolge und serverseitig abgesichertes Admin-CRUD mit PostgreSQL-Persistenz. Das Tasks-Board ist ebenfalls bereits implementiert. Application Links und Tasks sind keine Platzhalter mehr; eLearning, Benefits, Marketing und Vertrieb bleiben außerhalb dieser Erweiterung.

---

## 1. Project Overview

**Goal****: Create the Phase 1 foundation for TestConsulting's internal employee portal: a real authenticated application shell, initial overview, navigation, and independently testable frontend and API. Later domain areas are reachable as protected placeholders only; no later-phase CRUD or integrations are included. The HTML reference attached in the conversation is the authoritative visual and interaction reference; the Spec supplies the Phase 1 scope and technical requirements. The Spec-named repository path is absent, but the attachment is available.

**App Type**: SPA + API

**API Login**: Yes

**Mode**: NEW

**Deployment Plan**: No deployment plan found

---

## 2. Backend — Portal API (Express 5)

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript |
| **Runtime** | Node |
| **Package Manager** | npm |
| **Test Runner** | vitest |
| **Mocking Library** | vi.mock |
| **Test Command** | npm test |
| **Orchestration** | docker-compose |

The API owns email/password authentication, session lifecycle, and the current-user endpoint. Store passwords only as Argon2id hashes; persist sessions in PostgreSQL and issue HttpOnly, SameSite=Lax cookies (Secure in production). Add login rate limiting and generic authentication errors. Do not implement self-registration, Microsoft SSO, password-reset email delivery, or later-phase business APIs in this phase. Seed a local initial account through a documented, secret-safe development setup. Validate login, logout, session restoration, and unauthenticated access with API tests.

---

## 3. Frontend — Web App

| Component | Technology |
|-----------|-----------|
| **Language** | TypeScript |
| **Framework** | React + Vite |
| **Package Manager** | npm |
| **Test Runner** | vitest |
| **Mocking Library** | vi.mock |
| **Test Command** | npm test |

Use React Router for the login route, overview, and protected section routes. A shared `/areas/:area` page handles the six protected destinations. Keep navigation and page shell functional; future sections render clear, non-editable phase placeholders rather than fabricated CRUD or demo-only data.

---

## 4. Services Required

| Azure Service | Role in App | Environment Variable | Default Value (Local) | Classification |
|---------------|------------|---------------------|----------------------|----------------|
| PostgreSQL | Persist employee accounts and server-side sessions for real authentication | `DATABASE_URL` | `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/mitarbeiterportal` | Essential |

No Blob Storage, LLM, Microsoft identity, eLearning API, email delivery provider, or Azure hosting resource is included in Phase 1. Run PostgreSQL locally with the repository's Compose setup; no deployment configuration is in scope.

---

## 5. Prerequisites

### Run

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Node.js | * | ✅ | v24.14.1 |
| npm | * | ✅ | 11.11.0 |
| Docker | backend | ❓ | 29.8.0; engine not running |
| Docker Compose | backend | ❓ | v5.5.1; engine not running |

### Debug

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Microsoft Edge | frontend | ✅ | 154.0.4258.53 |

Start Docker Desktop before running the local PostgreSQL service; the CLI is installed, but the engine was not reachable during planning. Verify all `❓` prerequisites before local execution.

---

## 6. Design System & UI

**Component Library**: Fluent UI v9
**Style Direction**: A calm, compact employee workspace following TestConsulting's blue-and-green brand cues. Preserve the prototype's split login composition and persistent left navigation, with a restrained overview that makes the six portal destinations scannable without suggesting their later features are already implemented.
**Typography**: Barlow Semi Condensed for headings; Open Sans for interface text

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#004C7E` | TestConsulting blue for primary actions, headings, and active navigation |
| `accent` | `#75B843` | Green emphasis for active markers and section accents |
| `surface` | `#F3F6F9` | Portal canvas and login form background |
| `text` | `#1B2A36` | Primary employee-facing text |
| `muted` | `#55636F` | Supporting labels and section descriptions |
| `border` | `#DCE3E9` | Navigation separators, panels, and form boundaries |

### Pages

| Page | Route | Purpose | Layout |
|------|-------|---------|--------|
| Sign In | `/login` | Authenticate an employee and surface validation feedback | `split(hero|form)` |
| Overview | `/` | Welcome the signed-in employee and expose all portal destinations | `header, sidebar, main, grid, card-list` |
| Portal Area Placeholder | `/areas/:area` | Show the selected protected destination as not yet implemented | `header, sidebar, main, empty` |
| Application Links (Phase 2 extension) | `/areas/applications` | Persisted tool links with admin management | `header, sidebar, main, tile-grid, dialogs` |

### Sample Content

Overview — Portal destination:
| Name | Purpose | Phase 1 state |
|------|---------|---------------|
| eLearning | Lernen und Zertifikate | In Vorbereitung |
| Application Links | Unternehmenswerkzeuge | Implementiert (Phase-2-Erweiterung) |
| Benefits | Mitarbeiterangebote | In Vorbereitung |
| Marketing | Vorlagen und Markenmaterial | In Vorbereitung |
| Vertrieb | Vertriebsunterstützung | In Vorbereitung |
| Tasks | Gemeinsame Aufgaben | In Vorbereitung |

Overview — session-derived greeting: `{Vorname des angemeldeten Nutzers}` · Login — fields: `E-Mail` · `Passwort`

Portal Area Placeholder — empty state: `Dieser Bereich wird in einer späteren Phase eingerichtet.` · destinations: `eLearning`, `Application Links`, `Benefits`, `Marketing`, `Vertrieb`, `Tasks`

---

## 7. Project Structure

```text
project-root/
├── .azure/
│   └── project-plan.md
├── apps/
│   ├── api/
│   │   ├── src/{auth,middleware,config,db}/
│   │   ├── migrations/
│   │   ├── tests/{unit,integration}/
│   │   └── package.json
│   └── web/
│       ├── src/{app,routes,components,pages,styles}/
│       └── package.json
├── packages/
│   └── shared/{schemas,types}/
├── compose.yaml
├── package.json
├── .env.example
└── README.md
```

---

## 8. Route Definitions

| # | Method | Path | Description | Request Body | Response Body | Status Codes |
|---|--------|------|-------------|-------------|--------------|-------------|
| 1 | GET | `/api/health` | API and database readiness check | — | `{ status, services }` | 200, 503 |
| 2 | POST | `/api/auth/login` | Start an authenticated portal session | Validated login payload | `{ user }` | 200, 400, 401, 429, 500 |
| 3 | GET | `/api/auth/me` | Return the current authenticated user | — | `{ user }` | 200, 401 |
| 4 | POST | `/api/auth/logout` | End the current portal session | — | `{ success }` | 200, 401, 500 |
| 5 | GET | `/api/links` | Read ordered application links (authenticated) | — | `{ links }` | 200, 401, 500 |
| 6 | POST | `/api/links` | Create application link (admin) | `{ name, description, url, icon, sortOrder }` | `{ link }` | 201, 400, 401, 403, 500 |
| 7 | PUT | `/api/links/:id` | Replace application link fields (admin) | `{ name, description, url, icon, sortOrder }` | `{ link }` | 200, 400, 401, 403, 404, 500 |
| 8 | DELETE | `/api/links/:id` | Delete application link (admin) | — | `{ success }` | 200, 400, 401, 403, 404, 500 |

All non-login portal APIs require a valid authenticated session. Frontend route guards are for navigation only; authorization is enforced again by the API. Do not add content CRUD endpoints in Phase 1.

---

## 9. Next Steps

1. Run **azure-project-scaffold** to execute this plan
2. Run **azure-project-integrate** to wire the frontend to live data, smoke-test the backend, and create the migrations
3. Run **azure-debug-plan** → **azure-debug-generate** for Docker emulators and VS Code debugging
4. Run the **azure-deploy** agent when ready; it uses **azure-app-onboard** for architecture, cost estimation, IaC generation, provisioning, and health verification