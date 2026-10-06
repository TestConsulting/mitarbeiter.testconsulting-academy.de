# Lokale Entwicklung

## Voraussetzungen

- Node.js 24 und npm
- Docker Desktop mit laufender Docker Engine

## Setup

1. `.env.example` als `.env` kopieren und `POSTGRES_PASSWORD`, `DATABASE_URL` sowie ein zufälliges `SESSION_SECRET` mit mindestens 32 Zeichen setzen. Ein Secret lokal erzeugen:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

2. Abhängigkeiten installieren und PostgreSQL starten:

   ```powershell
   npm install
   docker compose up -d postgres
   ```

3. Das Kontenschema einmalig anlegen und das lokale Startkonto ausdrücklich erzeugen. Die Zugangsdaten dafür nur in `.env` setzen, niemals committen:

   ```powershell
   Get-Content -Raw apps/api/migrations/001_create_users.sql | docker compose exec -T postgres psql -U portal -d mitarbeiterportal
   Get-Content -Raw apps/api/migrations/002_create_board.sql | docker compose exec -T postgres psql -U portal -d mitarbeiterportal
   npm run seed --workspace @portal/api
   ```

   `002_create_board.sql` legt das Tasks-Board-Schema an (`board_columns`, `tickets`) und seedet die drei Standardspalten ("Zu erledigen", "In Arbeit", "Erledigt"), falls das Board noch leer ist.

4. API und Web-App parallel starten:

   ```powershell
   npm run dev
   ```

   Web-App: `http://localhost:5173`; API: `http://localhost:4000`.

API und Web-App laufen mit `npm run dev` direkt auf dem Rechner, nicht in Docker. Nur PostgreSQL wird mit Docker Compose gestartet. Die API-Befehle `dev`, `start` und `seed` laden die `.env` im Repository-Stamm explizit, auch wenn npm sie im API-Workspace ausführt. Diese Datei ist von Git ausgeschlossen.

Die Datenbankverbindung kann unter `http://localhost:4000/api/health` oder über den Web-Proxy unter `http://localhost:5173/api/health` geprüft werden. Nur HTTP 200 mit `services.database: "ok"` bestätigt eine erreichbare Datenbank; HTTP 503 bedeutet, dass die API läuft, aber die Datenbank nicht erreichbar ist.

Die API legt beim Start die PostgreSQL-Tabelle `portal_sessions` über `connect-pg-simple` an. Das Compose-Volume enthält lokale Entwicklungsdaten. Für Produktion sind ein separates Secret, HTTPS und `COOKIE_SECURE=true` erforderlich.

## Checks

```powershell
npm test
npm run typecheck
npm run build
```

Es gibt weiterhin weder Self-Registration noch SSO, Passwort-Reset, Bereichs-CRUD, CV-Funktionen oder externe Inhaltsintegrationen (eLearning, Application Links, Benefits, Marketing, Vertrieb bleiben Platzhalter). Das Tasks-Board (Phase 3) ist umgesetzt, inklusive Admin-UI zum Umbenennen und Löschen von Spalten (Löschen ist nur möglich, wenn die Spalte keine Tickets mehr enthält).