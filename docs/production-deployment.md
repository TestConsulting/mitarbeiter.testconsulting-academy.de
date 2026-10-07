# Produktions-Deployment auf Ubuntu

Das Produktions-Compose besteht aus PostgreSQL, der Express-API und einem Nginx-Webcontainer. Der Host-Nginx terminiert HTTPS und leitet Anfragen an `127.0.0.1:8090` weiter. Nur dieser Loopback-Port wird veröffentlicht; Datenbank und API sind nicht direkt vom Host-Netz aus erreichbar.

## Konfiguration

Lege `/var/www/mitarbeiter-portal/.env` aus `deploy/env.production.example` an und trage starke, nur für Produktion verwendete Werte ein. Erzeuge `SESSION_SECRET` mit mindestens 32 zufälligen Bytes. Verwende für `POSTGRES_PASSWORD` ein URL-sicheres Passwort, da Compose daraus `DATABASE_URL` zusammensetzt. Die Datei muss für den Jenkins-Benutzer lesbar und vor anderen Benutzern geschützt sein.

Der Host-Nginx muss beim Proxy an `http://127.0.0.1:8090` mindestens `Host`, `X-Forwarded-For` und `X-Forwarded-Proto $scheme` weitergeben. Der Webcontainer reicht `X-Forwarded-Proto` an die API weiter; damit funktionieren HTTPS-Erkennung und sichere Sitzungscookies.

## Erstdeployment

Jenkins baut die Images, startet PostgreSQL und führt die vorhandenen, wiederholbar ausführbaren SQL-Dateien in `apps/api/migrations` in Dateinamenreihenfolge aus. Jeder SQL-Fehler bricht den Job ab. Danach importiert Jenkins fehlende Links und Benefits aus `deploy/portal-content.json`, startet die Anwendung und prüft Startseite und API-Healthcheck. Gleichzeitige Deployments desselben Jobs sind gesperrt.

`001_create_users.sql` legt die Benutzertabelle an; `002_create_board.sql` legt Board- und Ticket-Tabellen an und erstellt die Standardspalten, falls noch keine vorhanden sind. `003_create_app_links.sql` und `004_create_benefits.sql` legen die Tabellen für Links und Benefits an. Die API selbst führt diese Schema-Migrationen nicht aus. Ihre PostgreSQL-Sitzungstabelle `portal_sessions` wird beim Start durch `connect-pg-simple` angelegt. Zukünftige nicht wiederholbare Migrationen benötigen vor Aufnahme in diesen Ablauf eine Migrationshistorie.

Für das erste Konto setze `SEED_USER_EMAIL`, `SEED_USER_NAME` und ein starkes `SEED_USER_PASSWORD` in der geschützten `.env`, dann führe im Repository-Verzeichnis aus:

```sh
docker compose -p mitarbeiter-portal --env-file /var/www/mitarbeiter-portal/.env -f docker-compose.prod.yml exec api npm run seed:prod
```

**Vor dem Seed eine bestehende produktive Datenbank sichern.** Der Seed stellt die Anwendung auf genau einen allgemeinen Benutzer mit vollständigen Berechtigungen um und entfernt die anderen Konten. Tickets bleiben erhalten; ihre Ersteller und vorhandenen Zuweisungen werden auf den einzigen Account übertragen. Links, Benefits und Board-Spalten bleiben unverändert. Bestehende Sitzungen werden ungültig. Die Umstellung erfolgt in einer Transaktion.

Ein eindeutiger Datenbankindex verhindert weitere Konten, eine Datenbankbedingung erzwingt die allgemeine Rolle `user` statt `admin`. Vorhandene Single-Admin-Regeln werden beim Seed migriert. Wiederholtes Seeden aktualisiert E-Mail, Name und Passwort des einzigen Accounts. Eine separate Rollenzuweisung oder `SEED_ADMIN_*`-Konfiguration ist nicht erforderlich. Für Produktion ein eigenes starkes Passwort verwenden; lokale Zugangsdaten nicht übernehmen.

Entferne anschließend die `SEED_USER_*`-Werte aus der Server-`.env`. Prüfe das Deployment über `https://mitarbeiter.testconsulting-academy.de/api/health`; bei Erfolg antwortet die API mit `services.database: "ok"`.

## Lokal gepflegte Links und Benefits übernehmen

Im Repository-Stamm lokal ausführen:

```powershell
npm run content:export --workspace @portal/api -- deploy/portal-content.json
```

Der Export liest die lokale Datenbank aus `.env` und schreibt ausschließlich Links und Benefits, ohne technische IDs, Benutzer, Passwörter, Sitzungen oder Tasks. Prüfe die Inhalte vor dem Commit: interne URLs und Texte können vertraulich sein. Nur für dieses Repository freigegebene Inhalte committen und pushen. Jenkins importiert anschließend den exportierten Stand, nicht die laufende lokale Datenbank. Nach neuen lokalen Einträgen muss der Export erneut ausgeführt werden.

Der Import ergänzt nur fehlende Einträge. Bei Links zählt die URL, bei Benefits der Titel, jeweils ohne äußere Leerzeichen und mit Beachtung der Groß-/Kleinschreibung. Unterschiedliche URL-Schreibweisen (etwa mit/ohne abschließenden Slash) gelten als unterschiedliche Links. Bestehende Prod-Einträge werden weder aktualisiert noch gelöscht, auch wenn ihre Beschreibung lokal abweicht. Neue Links werden in exportierter Reihenfolge hinter die bestehenden Links angehängt; die bestehende Prod-Reihenfolge bleibt erhalten. Wiederholte Deployments erzeugen keine weiteren Einträge mit derselben URL bzw. demselben Titel.

Der gesamte Import läuft in einer Transaktion und sperrt Schreibzugriffe auf beide Tabellen für seine Dauer. Fehler brechen den Job ab und rollen den Import zurück. Der Seed für Benutzer wird dabei nicht ausgeführt. Eine fehlende oder ungültige Exportdatei ist ein Deploymentfehler.

Ein normaler Code-Push ohne aktualisierten Export überträgt keine neuen lokalen Datenbankinhalte. Vor dem ersten Deployment mit Migrationen und Import die produktive Datenbank sichern. Nach dem Job im angemeldeten Portal prüfen, dass Links und Benefits geladen werden und vorhandene Prod-Einträge unverändert sind.
