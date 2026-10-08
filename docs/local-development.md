# Lokale Entwicklung

## Voraussetzungen

- Node.js 24 und npm
- Docker Desktop mit laufender Docker Engine

## Setup

1. `.env.example` als `.env` kopieren und `POSTGRES_PASSWORD`, `DATABASE_URL` sowie ein zufälliges `SESSION_SECRET` mit mindestens 32 Zeichen setzen. Für den einzigen Account `SEED_USER_EMAIL`, `SEED_USER_NAME` und `SEED_USER_PASSWORD` (mindestens 12 Zeichen) ausschließlich in `.env` setzen. Ein Secret lokal erzeugen:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

2. Abhängigkeiten installieren und PostgreSQL starten:

   ```powershell
   npm install
   docker compose up -d postgres
   ```

3. Das Schema einmalig anlegen und den einzigen Account einrichten:

   ```powershell
   Get-Content -Raw apps/api/migrations/001_create_users.sql | docker compose exec -T postgres psql -U portal -d mitarbeiterportal
   Get-Content -Raw apps/api/migrations/002_create_board.sql | docker compose exec -T postgres psql -U portal -d mitarbeiterportal
   Get-Content -Raw apps/api/migrations/003_create_app_links.sql | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U portal -d mitarbeiterportal
   Get-Content -Raw apps/api/migrations/004_create_benefits.sql | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U portal -d mitarbeiterportal
   npm run seed --workspace @portal/api
   ```

   `002_create_board.sql` legt das Tasks-Board-Schema an (`board_columns`, `tickets`) und seedet die drei Standardspalten ("Zu erledigen", "In Arbeit", "Erledigt"), falls das Board noch leer ist.

   `003_create_app_links.sql` legt die Tabelle `app_links` an. Es werden keine fiktiven Unternehmenslinks automatisch eingetragen; Admins pflegen die tatsächlichen Zieladressen.

   Application Links unterstützen HTTP-/HTTPS-Adressen (auch mit `www.`) sowie `mailto:` mit einer einzelnen E-Mail-Adresse ohne Zusatzparameter. E-Mail-Kacheln zeigen einen Briefumschlag und „E-Mail schreiben“; sie öffnen das lokale E-Mail-Programm statt eines neuen Browser-Tabs.

   `004_create_benefits.sql` legt die Tabelle `benefits` an. Es werden keine Unternehmensleistungen erfunden oder automatisch eingetragen; Admins pflegen die tatsächlichen Benefits.

   **Achtung bei bestehenden Datenbanken:** Der Seed ersetzt alle bisherigen Konten durch den konfigurierten allgemeinen Benutzer mit vollständigen Berechtigungen. Tickets bleiben erhalten: Ersteller und bestehende Zuweisungen werden auf diesen Account übertragen; nicht zugewiesene Tickets bleiben unzugewiesen. Links, Benefits und Board-Spalten bleiben unverändert. Alle bestehenden Sitzungen werden ungültig.

   Die Umstellung erfolgt atomar. Ein eindeutiger Datenbankindex verhindert weitere Konten; eine Datenbankbedingung erlaubt nur die Rolle `user`. Der Seed migriert auch die bisherige Single-Admin-Datenbankregel. Wiederholtes Seeden aktualisiert den einzigen Account. Die Zugangsdaten werden nicht in Beispieldateien hinterlegt; `.env` bleibt von Git ausgeschlossen. Vor einer Umstellung produktiver Datenbanken ein Backup erstellen.

4. API und Web-App parallel starten:

   ```powershell
   npm run dev
   ```

   Web-App: `http://localhost:5173`; API: `http://localhost:4000`.

API und Web-App laufen mit `npm run dev` direkt auf dem Rechner, nicht in Docker. Nur PostgreSQL wird mit Docker Compose gestartet. Die API-Befehle `dev`, `start` und `seed` laden die `.env` im Repository-Stamm explizit, auch wenn npm sie im API-Workspace ausführt. Diese Datei ist von Git ausgeschlossen.

Die Datenbankverbindung kann unter `http://localhost:4000/api/health` oder über den Web-Proxy unter `http://localhost:5173/api/health` geprüft werden. Nur HTTP 200 mit `services.database: "ok"` bestätigt eine erreichbare Datenbank; HTTP 503 bedeutet, dass die API läuft, aber die Datenbank nicht erreichbar ist.

Die API legt beim Start die PostgreSQL-Tabelle `portal_sessions` über `connect-pg-simple` an. Das Compose-Volume enthält lokale Entwicklungsdaten. Für Produktion sind ein separates Secret, HTTPS und `COOKIE_SECURE=true` erforderlich.

Lokal angelegte Links und Benefits werden nicht durch einen normalen Code-Push übertragen. Für die Übernahme fehlender Einträge auf Produktion im Repository-Stamm `npm run content:export --workspace @portal/api -- deploy/portal-content.json` ausführen, die Exportdatei auf vertrauliche Inhalte prüfen und den freigegebenen Export zusammen mit dem Code committen und pushen. Jenkins ergänzt nur fehlende URLs bzw. Benefit-Titel; bestehende Prod-Inhalte bleiben unverändert. Details stehen in [production-deployment.md](production-deployment.md#lokal-gepflegte-links-und-benefits-übernehmen). Tasks und Benutzer werden nicht exportiert.

## Checks

```powershell
npm test
npm run typecheck
npm run build
```

## Application Links (Phase 2)

Nach der Anmeldung ist der Bereich unter `http://localhost:5173/areas/applications` erreichbar. Mitarbeitende sehen Kacheln mit Name, Kurzbeschreibung und Kürzel; die Zieladressen öffnen in einem neuen Tab. Die Daten werden in PostgreSQL gespeichert, nach `sort_order` aufsteigend sortiert, bei Gleichstand nach Name und ID.

Die Kacheln haben abgerundete Ecken, weiche Schatten und dezente Farbakzente. Das responsive Raster passt sich der verfügbaren Breite an; die Farben wechseln nach Kachelposition und kennzeichnen keine Berechtigungen oder Kategorien. „Öffnen“ ist als eigener Link-Button gestaltet, Admin-Aktionen stehen in einer dezenten Fußzeile.

Application-Links-Kacheln sind 280 Pixel breit und 320 Pixel hoch und damit quadratischer gestaltet; auf schmaleren Bildschirmen passt sich nur die Breite an. Beschreibungen werden auf zwei Zeilen begrenzt. Wenn der Text tatsächlich überläuft, öffnet „…mehr“ ein Popup mit vollständigem Namen, Beschreibung und Zieladresse. Das Popup steht Mitarbeitenden und Admins zur Verfügung; sein Öffnen verändert weder Inhalt noch Reihenfolge.

Das Detail-Popup übernimmt den Farbakzent und das Kürzel der Kachel. Beschreibung und Zieladresse stehen in getrennten Boxen mit gleichen abgerundeten Rahmen und Innenabständen. Die Beschreibung bleibt weiß hinterlegt, die Zieladresse behält ihren hellgrauen Hintergrund. Die Fußzeile enthält den Hinweis zum neuen Tab und die Aktionen. Lange Inhalte bleiben scrollbar, auf kleinen Bildschirmen passt sich das Layout an. Schließen ist über die Fußzeile, das Kreuz im Kopfbereich oder die Escape-Taste möglich.

Admins können Links hinzufügen, vollständig bearbeiten und nach Bestätigung löschen. Auf freien Flächen innerhalb einer Kachel können sie die Maustaste gedrückt halten und die Kachel per Drag-and-drop umsortieren; die Reihenfolge wird direkt für alle Mitarbeitenden gespeichert. Separate Verschiebegriffe und Reihenfolge-Angaben auf den Kacheln entfallen. Links werden über „Öffnen“ aufgerufen; Öffnen-, Bearbeiten- und Löschen-Steuerelemente lösen kein Verschieben aus. Tastaturbedienung: Kachel fokussieren, mit Leertaste aufnehmen, mit Pfeiltasten verschieben, mit Leertaste ablegen oder mit Escape abbrechen. Bei einem Speicherfehler wird die bisherige Reihenfolge wiederhergestellt und eine Fehlermeldung angezeigt. Mitarbeitende können nicht umsortieren. Das alternative Reihenfolge-Feld im Bearbeitungsdialog akzeptiert ganze Zahlen von 0 bis 2147483647. Zieladressen dürfen nur HTTP oder HTTPS verwenden und keine eingebetteten Zugangsdaten enthalten. Das Kürzel ist ein Textfeld (maximal 12 Zeichen), kein HTML oder Datei-Upload.

Der einzige Account hat die allgemeine Rolle `user`, nicht `admin`, und darf alle implementierten Bereiche verwalten. Historische Admin-Verweise in den folgenden Funktionsbeschreibungen meinen diese Verwaltungsberechtigungen. Zur Änderung von E-Mail, Name oder Passwort die `SEED_USER_*`-Werte in `.env` anpassen und anschließend ausführen:

```powershell
npm run seed --workspace @portal/api
```

Danach mit dem konfigurierten Account neu anmelden. `seed:admin` bleibt als kompatibler Alias für denselben Single-Account-Seed erhalten; `SEED_ADMIN_*` wird nicht mehr verwendet. Zugangsdaten nicht committen. Rollenprüfungen bleiben als serverseitige Schutzmaßnahmen erhalten; es gibt keine Anmeldung ohne Passwort.

API-Vertrag:

| Methode | Pfad | Berechtigung | Antwort |
|---------|------|--------------|---------|
| GET | `/api/links` | Angemeldet | 200 `{ links: AppLink[] }` |
| POST | `/api/links` | Admin | 201 `{ link: AppLink }` |
| PUT | `/api/links/order` | Admin | 200 `{ links: AppLink[] }` |
| PUT | `/api/links/:id` | Admin | 200 `{ link: AppLink }` |
| DELETE | `/api/links/:id` | Admin | 200 `{ success: true }` |

POST und PUT erwarten `{ name, description, url, icon, sortOrder }`. Nicht angemeldete Anfragen erhalten 401, unberechtigte Änderungen 403, ungültige Eingaben 400 und nicht vorhandene Links bei PUT/DELETE 404.

Zieladressen mit `www.` werden im Formular und in der API automatisch um `https://` ergänzt, beispielsweise `www.happytesting.de` zu `https://www.happytesting.de`. HTTP-/HTTPS-Adressen bleiben unverändert. Andere Protokolle und eingebettete Zugangsdaten werden weiterhin abgelehnt; die gespeicherte URL darf maximal 2048 Zeichen lang sein.

Das Reihenfolge-Feld beim Anlegen und Bearbeiten bestimmt die Position: 0 ist die erste Kachel. Andere Kacheln rücken nach; Werte über der letzten Position setzen den Link ans Ende. Linkdaten und die eindeutigen Sortierwerte von 0 bis n-1 werden gemeinsam in einer Transaktion gespeichert. Im Editor wird die aktuelle Position angezeigt, auch wenn ältere Daten doppelte Sortierwerte enthalten.

PUT `/api/links/order` erwartet stattdessen `{ ids: string[] }` mit jeder vorhandenen Link-ID genau einmal in der gewünschten Reihenfolge. Die Sortierwerte werden atomar auf 0 bis n-1 gesetzt. Doppelte oder ungültige IDs ergeben 400; eine unvollständige oder veraltete Linkliste ergibt 409 ohne Teiländerungen.

## Benefits

Die Kartenübersicht ist unter `http://localhost:5173/areas/benefits` verfügbar, die eigene Detailseite unter `/areas/benefits/:id`. Beide sind nur nach Anmeldung erreichbar. Benefits nutzen denselben responsiven Designstil wie Application Links: abgerundete Karten, dezente Farbakzente, weiche Schatten und eine Admin-Fußzeile. Die Karten werden alphabetisch nach Titel sortiert, bei Gleichstand nach ID.

Admins können Benefits hinzufügen, in der Übersicht oder auf der Detailseite bearbeiten und nach Bestätigung löschen. Mitarbeitende sehen nur die Karten und die Details. Der Editor verlangt Titel (1–120 Zeichen), Kurzbeschreibung (1–500 Zeichen) und Details (1–5000 Zeichen). Führende und nachfolgende Leerzeichen werden entfernt. Die Details sind Klartext, kein HTML oder Markdown; Zeilenumbrüche bleiben auf der Detailseite erhalten. Die Änderungen werden in PostgreSQL gespeichert und bleiben nach Neustarts erhalten.

Ladefehler können erneut versucht werden; fehlende Detailseiten zeigen einen eigenen Hinweis mit Rückweg zur Übersicht. Speicherfehler lassen den Editor mit den Eingaben geöffnet, fehlgeschlagene Löschungen entfernen keine Karte. Nach erfolgreichem Löschen auf der Detailseite erfolgt eine Rückkehr zur Übersicht.

| Methode | Pfad | Berechtigung | Antwort |
|---------|------|--------------|---------|
| GET | `/api/benefits` | Angemeldet | 200 `{ benefits: Benefit[] }` |
| GET | `/api/benefits/:id` | Angemeldet | 200 `{ benefit: Benefit }` |
| POST | `/api/benefits` | Admin | 201 `{ benefit: Benefit }` |
| PUT | `/api/benefits/:id` | Admin | 200 `{ benefit: Benefit }` |
| DELETE | `/api/benefits/:id` | Admin | 200 `{ success: true }` |

POST und PUT erwarten `{ title, description, details }`. Unbekannte Felder, ungültige IDs und ungültige Inhalte ergeben 400, nicht angemeldete Anfragen 401, unberechtigte Änderungen 403 und fehlende Benefits 404. Für längere mehrbyteige Detailtexte akzeptiert nur der Benefits-Endpunkt JSON-Anfragen bis 32 KB; die anderen API-Endpunkte behalten ihre Grenze von 10 KB.

Es gibt weiterhin weder Self-Registration noch SSO, Passwort-Reset, Marketing-CRUD, CV-Funktionen oder externe Inhaltsintegrationen (eLearning, Marketing, Vertrieb bleiben Platzhalter). Application Links, Benefits und das Tasks-Board sind umgesetzt, letzteres inklusive Admin-UI zum Umbenennen und Löschen von Spalten (Löschen ist nur möglich, wenn die Spalte keine Tickets mehr enthält).