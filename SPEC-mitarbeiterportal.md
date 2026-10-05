# TestConsulting Mitarbeiterportal – Fachliche & technische Spezifikation

> **Für GitHub Copilot:** Diese Datei beschreibt das Zielsystem. Der klickbare Prototyp liegt unter `docs/prototype/testconsulting-portal.html` und ist die verbindliche Referenz für Layout, Texte und Bedienabläufe. Arbeite phasenweise (siehe Abschnitt 9), halte dich an die Design-Tokens (Abschnitt 4) und frage nach, bevor du Annahmen zu den offenen Punkten (Abschnitt 11) triffst.

---

## 1. Ziel und Kontext

TestConsulting (Software-QA- und Atlassian-Beratung) erhält einen internen, geschützten Login-Bereich für Mitarbeitende. Das Portal bündelt Lernangebote, Tool-Links, Benefits, Marketing-Material, einen Vertriebs-CV-Generator und ein Aufgabenboard.

- **Nutzer:** Mitarbeitende von TestConsulting (intern), Admins (Geschäftsführung)
- **Sprache der Oberfläche:** Deutsch
- **Design:** Corporate Design von www.testconsulting.de inkl. TestConsulting-Logo
- **Status heute:** Klickbarer HTML-Prototyp ohne Backend (Pseudo-Login, Daten nur im Browser)

## 2. Rollen

| Rolle | Rechte |
|---|---|
| Mitarbeiter | Alle Bereiche lesen, eigene Kurse/Zertifikate, Tasks anlegen/bearbeiten, CVs generieren |
| Admin | Zusätzlich: Inhalte pflegen (Links, Benefits, Marketing-Dateien, Kurse), Mitarbeitende verwalten, Spalten anlegen/löschen |

## 3. Fachliche Anforderungen je Bereich

### 3.1 Login
- Anmeldung mit E-Mail + Passwort
- Optional: „Mit Microsoft 365 anmelden“ (SSO über Microsoft Entra ID / OAuth2 OIDC)
- „Angemeldet bleiben“, „Passwort vergessen“ (Reset per E-Mail-Link)
- Fehlermeldung bei leeren oder falschen Zugangsdaten
- Abmelden über Icon unten in der Seitenleiste
- Alle Seiten außer Login sind nur angemeldet erreichbar

### 3.2 Übersicht (Dashboard)
- Begrüßung mit Vorname des angemeldeten Nutzers
- Kacheln für alle Bereiche: eLearning, Application Links, Benefits, Marketing, Vertrieb, Tasks
- Seitenleiste mit denselben Bereichen, aktiver Bereich hervorgehoben
- Suchfeld im Kopfbereich (Phase 2: bereichsübergreifende Suche)

### 3.3 eLearning
- Laufende Kurse mit Fortschrittsbalken („Weiterlernen“)
- Kurskatalog (einschreiben)
- Meine Zertifikate (Download)
- Hinweis: Es existiert bereits eine Laravel-eLearning-App der TestConsulting Academy. **Offene Entscheidung:** Integration per Link/SSO oder Daten per API anzeigen.

### 3.4 Application Links
- Kachelliste mit Name, Kurzbeschreibung, Icon/Kürzel, Ziel-URL (öffnet in neuem Tab)
- Admin pflegt Links (CRUD), Sortierung per Reihenfolge-Feld
- Beispiel-Eintrag: Microsoft 365 (Outlook, Teams, OneDrive)

### 3.5 Benefits
- Karten mit Titel, Kurzbeschreibung, Detailseite
- Admin pflegt Benefits (CRUD)

### 3.6 Marketing
- Kategorien: Logos & Corporate Design, Vorlagen (Präsentationen, Briefpapier, E-Mail-Signatur), Social Media
- Dateien herunterladen; Admin lädt Dateien hoch (CRUD)

### 3.7 Vertrieb – CV-Generator
Zweck: Lebensläufe von Mitarbeitenden automatisch auf Projektausschreibungen (freelancermap, GULP) zuschneiden, statt sie manuell anzupassen.

Ablauf:
1. **Master-CV wählen:** Mitarbeiter aus Liste auswählen (Master-CV je Mitarbeiter hinterlegt)
2. **Ausschreibung hochladen:** Screenshot (Bild) per Drag & Drop oder Dateiauswahl
3. **Vorschau & Download:** KI-gestützte Anpassung des CVs an die Ausschreibung, Vorschau im Browser, Download als Word-Datei (.docx) zur Nachbearbeitung

Technische Hinweise:
- Screenshot → Text/Anforderungen extrahieren (Vision-fähiges LLM, z. B. Claude API)
- LLM bekommt Master-CV + extrahierte Anforderungen und liefert strukturierte Daten (JSON), keine freie Formatierung
- .docx wird serverseitig aus einer Word-Vorlage befüllt (z. B. `docxtemplater` in Node oder `PhpWord` in PHP)
- Keine Erfindung von Skills/Projekten: Das LLM darf nur umformulieren, gewichten und kürzen, was im Master-CV steht
- Soll die gleiche Architektur wie die PPT-Personalverwaltungs-App bekommen

### 3.8 Tasks (Trello-artiges Board)
- **Spalten:** Standard „Zu erledigen“, „In Arbeit“, „Erledigt“; weitere Spalten hinzufügbar (Name eingeben). Spalten löschen/umbenennen: Phase 2.
- **Mitarbeiter:** Hinzufügen per Name (im Prototyp); im Zielsystem aus der Benutzerverwaltung. Farbiges Kürzel-Avatar. Entfernen gibt zugewiesene Tickets frei.
- **Tickets anlegen:** „+ Karte hinzufügen“ in der Spalte, Titel + optional Zuweisung (Assignee); Enter speichert
- **Ticket bearbeiten (Dialog):** Titel, Beschreibung, Assignee, Spalte
- **Ticket löschen:** Papierkorb-Icon auf der Karte und im Dialog, jeweils mit Bestätigung
- **Verschieben:** Drag & Drop zwischen und innerhalb von Spalten (Reihenfolge wird gespeichert); auf Touch-Geräten zusätzlich über das Feld „Spalte“ im Dialog
- **Gemeinsames Board:** Im Zielsystem sehen alle Mitarbeitenden dasselbe Board (serverseitig gespeichert)

## 4. Design-System

Quelle: TestConsulting-Logo und www.testconsulting.de.

### Farben
| Token | Wert | Verwendung |
|---|---|---|
| `--accent` | `#004C7E` | Primärfarbe (TestConsulting-Blau): Buttons, Überschriften, aktiver Menüpunkt, Login-Panel |
| `--green` | `#75B843` | Akzent: Strich unter Überschriften, aktiver Menüpunkt (Rand links), Icon-Unterkante, Schritt-Labels |
| `--bg` | `#F3F6F9` | Seitenhintergrund |
| `--surface` | `#FFFFFF` | Karten, Seitenleiste, Eingabefelder |
| `--ink` | `#1B2A36` | Text |
| `--muted` | `#55636F` | Sekundärtext |
| `--line` | `#DCE3E9` | Rahmen |
| `--tint` | `#E5EEF4` | Icon-Hintergründe, Hover |
| Fehler | `#B3261E` | Fehlermeldungen, Löschen |

Dark Mode ist im Prototyp über `prefers-color-scheme` vorbereitet (Tokens siehe Prototyp).

### Typografie
- Überschriften: **Barlow Semi Condensed** (600/700), Seitentitel in Großbuchstaben, darunter grüner Strich (48 × 4 px)
- Fließtext: **Open Sans** (400/600)
- Hinweis: Schriften sind an Logo/Website angenähert; falls ein Styleguide existiert, diesen verwenden.

### Layout
- Login: zweigeteilt; links blaues Panel mit weißem Logo, Claim und grünem Strich, rechts Formular
- App: Seitenleiste links (weiß, Logo oben, Navigation, Nutzer + Abmelden unten), Inhalt rechts mit Seitentitel und Suche
- Karten: weiß, 1 px Rahmen, Radius 16 px, Kachel-Raster `repeat(auto-fill, minmax(260px, 1fr))`
- Responsiv: Seitenleiste bricht auf schmalen Bildschirmen über den Inhalt um
- Barrierefreiheit: sichtbarer Tastaturfokus, Labels an allen Eingaben, `aria-current` im Menü

## 5. Technische Architektur (Vorschlag)

Angelehnt an die bestehende Infrastruktur und die PPT-App (React-Frontend). **Backend-Stack ist eine offene Entscheidung** (siehe Abschnitt 11).

```
Browser (React SPA)
   │  HTTPS (JSON, Cookie-Session oder JWT)
   ▼
Nginx (Reverse Proxy, Let's Encrypt)
   ├── /        → Frontend (statischer Build)
   └── /api     → Backend-Container
                     ├── PostgreSQL (Daten)
                     ├── Datei-Speicher (Volume) für Uploads, Marketing-Dateien, CV-Vorlagen
                     └── LLM-API (CV-Generator)
```

- **Frontend:** React + TypeScript + Vite, React Router, CSS-Variablen aus Abschnitt 4 (kein UI-Framework nötig), Drag & Drop z. B. mit `@dnd-kit`
- **Backend (Vorschlag):** Node.js + TypeScript (Express oder NestJS) **oder** Laravel (wie die eLearning-App)
- **Datenbank:** PostgreSQL mit Migrationen (Prisma/Drizzle bzw. Laravel Migrations)
- **Auth:** Session-Cookie (httpOnly, Secure, SameSite=Lax) oder JWT; Passwörter mit bcrypt/argon2; optional Microsoft Entra ID (OIDC) für M365-Login
- **Datei-Uploads:** Größenlimit, MIME-Prüfung, Speicherung außerhalb des Web-Roots
- **Secrets:** über `.env`, nie im Repository

## 6. Datenmodell (Entwurf)

```
User            id, email (unique), name, role [employee|admin], password_hash, avatar_color, created_at
Course          id, title, description, url
Enrollment      id, user_id → User, course_id → Course, progress (0–100), completed_at
Certificate     id, user_id → User, course_id → Course, file_path, issued_at
AppLink         id, name, description, url, icon, sort_order
Benefit         id, title, summary, body, sort_order
MarketingAsset  id, category [logo|template|social], title, description, file_path
MasterCv        id, user_id → User, data (JSON, strukturierter CV), updated_at
CvGeneration    id, master_cv_id → MasterCv, source_image_path, extracted_requirements (JSON), result (JSON), docx_path, created_by → User, created_at
BoardColumn     id, title, position
Ticket          id, column_id → BoardColumn, title, description, assignee_id → User (nullable), position, created_by → User, created_at, updated_at
```

Regeln:
- Löschen einer Spalte nur, wenn leer (oder Tickets vorher verschieben)
- Löschen eines Users setzt `Ticket.assignee_id` auf `NULL`
- `position` als Ganzzahl bzw. Fractional Index, damit Verschieben nur ein Ticket aktualisiert

## 7. API-Endpunkte (Entwurf, REST unter `/api`)

```
POST   /auth/login                 { email, password }
POST   /auth/logout
GET    /auth/me
POST   /auth/forgot-password       { email }
GET    /auth/microsoft             (OIDC-Redirect, optional)

GET    /links                      | POST/PUT/DELETE /links/:id        (Admin)
GET    /benefits                   | POST/PUT/DELETE /benefits/:id     (Admin)
GET    /marketing                  | POST/PUT/DELETE /marketing/:id    (Admin, Upload multipart)
GET    /elearning/my-courses
GET    /elearning/courses
GET    /elearning/certificates

GET    /users                      (für Assignee-Auswahl)
GET    /cv/masters
POST   /cv/generate                multipart: master_cv_id, screenshot → { id, preview }
GET    /cv/generations/:id/docx    → .docx-Download

GET    /board                      → { columns: [...], tickets: [...] }
POST   /board/columns              { title }
PATCH  /board/columns/:id          { title, position }
DELETE /board/columns/:id
POST   /tickets                    { column_id, title, description?, assignee_id? }
PATCH  /tickets/:id                { title?, description?, assignee_id?, column_id?, position? }
DELETE /tickets/:id
```

Alle Endpunkte außer Login/Passwort-Reset erfordern Anmeldung; Admin-Endpunkte prüfen die Rolle serverseitig.

## 8. Betrieb und Deployment

Bestehende Infrastruktur nutzen:
- Strato VPS, Ubuntu 24.04, Docker / Docker Compose
- Host-Nginx als Reverse Proxy, Zertifikate über Let's Encrypt/Certbot
- CI/CD: GitHub-Repository → Webhook → Jenkins (Build, Tests, Docker-Image, Deployment)
- Eigene Domain/Subdomain für das Portal (offene Entscheidung, siehe Abschnitt 11)
- Backups der Datenbank und des Upload-Volumes

Im Repository erwartet:
- `docker-compose.yml` (frontend, backend, db)
- `Jenkinsfile`
- `.env.example` (ohne echte Secrets)
- `README.md` mit lokalem Setup

## 9. Umsetzungsphasen

1. **Grundgerüst:** Monorepo/Projektstruktur, Design-Tokens, Layout (Seitenleiste, Kopfbereich), Routing, Login-Seite, Auth im Backend, geschützte Routen
2. **Inhaltsbereiche:** Application Links, Benefits, Marketing (lesen + Admin-CRUD, Datei-Upload)
3. **Tasks:** Board mit Spalten, Tickets, Assignee, Löschen, Drag & Drop, serverseitige Speicherung
4. **Vertrieb:** Master-CVs, Screenshot-Upload, LLM-Anpassung, Vorschau, .docx-Export
5. **eLearning:** Anbindung an die bestehende Laravel-eLearning-App
6. **Feinschliff:** Suche, Microsoft-365-SSO, Dark Mode, Tests, Deployment-Pipeline

## 10. Qualität und Tests

- Unit-Tests für Backend-Logik (Board-Reihenfolge, Rechteprüfung, CV-Datenaufbereitung)
- API-Tests für alle Endpunkte inkl. Rechte (Mitarbeiter vs. Admin)
- E2E-Tests (z. B. Playwright): Login, Navigation, Ticket anlegen/verschieben/löschen, CV-Generierung mit Test-Screenshot
- Browser: Chrome, Edge, Firefox, **Safari (iOS/macOS)**; Touch-Bedienung des Boards auf dem Smartphone prüfen
- Barrierefreiheit: Tastaturbedienung, Kontraste

## 11. Offene Entscheidungen

- Backend-Stack: Node.js/TypeScript oder Laravel?
- Domain: Unterseite von testconsulting.de oder eigene Subdomain?
- Login: Nur Microsoft 365 (Entra ID) oder zusätzlich eigene Konten?
- eLearning: Verlinken oder Daten per API aus der bestehenden Laravel-App einbinden?
- CV-Generator: Welches LLM, wo werden Master-CVs gepflegt, welche Word-Vorlage?
- Tasks: Ein gemeinsames Board oder mehrere Boards (z. B. je Team/Projekt)?
- Datenschutz: Lebensläufe sind personenbezogene Daten → Aufbewahrungsfristen, Auftragsverarbeitung mit dem LLM-Anbieter klären
