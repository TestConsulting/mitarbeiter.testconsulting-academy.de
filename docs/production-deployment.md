# Produktions-Deployment auf Ubuntu

Das Produktions-Compose besteht aus PostgreSQL, der Express-API und einem Nginx-Webcontainer. Der Host-Nginx terminiert HTTPS und leitet Anfragen an `127.0.0.1:8090` weiter. Nur dieser Loopback-Port wird veröffentlicht; Datenbank und API sind nicht direkt vom Host-Netz aus erreichbar.

## Konfiguration

Lege `/opt/mitarbeiter-portal/.env` aus `deploy/env.production.example` an und trage starke, nur für Produktion verwendete Werte ein. Erzeuge `SESSION_SECRET` mit mindestens 32 zufälligen Bytes. Verwende für `POSTGRES_PASSWORD` ein URL-sicheres Passwort, da Compose daraus `DATABASE_URL` zusammensetzt. Die Datei muss für den Jenkins-Benutzer lesbar und vor anderen Benutzern geschützt sein.

Der Host-Nginx muss beim Proxy an `http://127.0.0.1:8090` mindestens `Host`, `X-Forwarded-For` und `X-Forwarded-Proto $scheme` weitergeben. Der Webcontainer reicht `X-Forwarded-Proto` an die API weiter; damit funktionieren HTTPS-Erkennung und sichere Sitzungscookies.

## Erstdeployment

Jenkins baut und startet die Services mit `docker-compose.prod.yml`. Sobald PostgreSQL gesund ist, wende die SQL-Dateien einmalig im Repository-Verzeichnis auf dem VPS an:

```sh
docker compose -p mitarbeiter-portal --env-file /opt/mitarbeiter-portal/.env -f docker-compose.prod.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < apps/api/migrations/001_create_users.sql
docker compose -p mitarbeiter-portal --env-file /opt/mitarbeiter-portal/.env -f docker-compose.prod.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < apps/api/migrations/002_create_board.sql
```

`001_create_users.sql` legt die Benutzertabelle an; `002_create_board.sql` legt Board- und Ticket-Tabellen an und erstellt die Standardspalten, falls noch keine vorhanden sind. Die API führt diese Schema-Migrationen nicht automatisch aus. Ihre PostgreSQL-Sitzungstabelle `portal_sessions` wird dagegen beim Start durch `connect-pg-simple` angelegt.

Für das erste Konto setze `SEED_USER_EMAIL`, `SEED_USER_NAME` und ein starkes `SEED_USER_PASSWORD` in der geschützten `.env`, dann führe im Repository-Verzeichnis aus:

```sh
docker compose -p mitarbeiter-portal --env-file /opt/mitarbeiter-portal/.env -f docker-compose.prod.yml exec api npm run seed:prod
```

**Vor dem Seed eine bestehende produktive Datenbank sichern.** Der Seed stellt die Anwendung auf genau einen Account mit Adminrechten um und entfernt die anderen Konten. Tickets bleiben erhalten; ihre Ersteller und vorhandenen Zuweisungen werden auf den einzigen Account übertragen. Links, Benefits und Board-Spalten bleiben unverändert. Bestehende Sitzungen werden ungültig. Die Umstellung erfolgt in einer Transaktion.

Ein eindeutiger Datenbankindex verhindert weitere Konten, eine Datenbankbedingung erzwingt die Adminrolle. Wiederholtes Seeden aktualisiert E-Mail, Name und Passwort des einzigen Accounts. Eine separate Rollenzuweisung oder `SEED_ADMIN_*`-Konfiguration ist nicht erforderlich. Für Produktion ein eigenes starkes Passwort verwenden; lokale Zugangsdaten nicht übernehmen.

Entferne anschließend die `SEED_USER_*`-Werte aus der Server-`.env`. Prüfe das Deployment über `https://mitarbeiter.testconsulting-academy.de/api/health`; bei Erfolg antwortet die API mit `services.database: "ok"`.
