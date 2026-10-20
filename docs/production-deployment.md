# Produktions-Deployment auf Ubuntu

Das Produktions-Compose besteht aus PostgreSQL, der Express-API und einem Nginx-Webcontainer. Der Host-Nginx terminiert HTTPS und leitet Anfragen an `127.0.0.1:8090` weiter. Nur dieser Loopback-Port wird veröffentlicht; Datenbank und API sind nicht direkt vom Host-Netz aus erreichbar.

## Konfiguration

Lege `/var/www/mitarbeiter-portal/.env` aus `deploy/env.production.example` an und trage starke, nur für Produktion verwendete Werte ein. Erzeuge `SESSION_SECRET` mit mindestens 32 zufälligen Bytes. Verwende für `POSTGRES_PASSWORD` ein URL-sicheres Passwort, da Compose daraus `DATABASE_URL` zusammensetzt. Die Datei muss für den Jenkins-Benutzer lesbar und vor anderen Benutzern geschützt sein.

Der Host-Nginx muss beim Proxy an `http://127.0.0.1:8090` mindestens `Host`, `X-Forwarded-For` und `X-Forwarded-Proto $scheme` weitergeben. Der Webcontainer reicht `X-Forwarded-Proto` an die API weiter; damit funktionieren HTTPS-Erkennung und sichere Sitzungscookies.

## Erstdeployment

Jenkins baut die Images, startet PostgreSQL und führt die vorhandenen, wiederholbar ausführbaren SQL-Dateien in `apps/api/migrations` in Dateinamenreihenfolge aus. Jeder SQL-Fehler bricht den Job ab. Danach importiert Jenkins fehlende Links und Benefits aus `deploy/portal-content.json`, initialisiert einmalig die Standardkurse, startet die Anwendung und prüft Startseite und API-Healthcheck. Gleichzeitige Deployments desselben Jobs sind gesperrt.

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

Der Import ergänzt standardmäßig nur fehlende Einträge. Bei Links zählt die URL, bei Benefits der Titel, jeweils ohne äußere Leerzeichen und mit Beachtung der Groß-/Kleinschreibung. Unterschiedliche URL-Schreibweisen (etwa mit/ohne abschließenden Slash) gelten als unterschiedliche Links. Neue Links und Benefits werden in exportierter Reihenfolge hinter die bestehenden Karten angehängt; die bestehende Prod-Reihenfolge bleibt erhalten. Wiederholte Deployments erzeugen keine weiteren Einträge mit derselben URL bzw. demselben Titel.

Mit `"updateExistingLinks": true` in der Exportdatei aktualisiert Jenkins zusätzlich Namen, Beschreibungen und Icons vorhandener Links mit derselben URL. Die Reihenfolge bleibt erhalten; kein Eintrag wird gelöscht. Ohne dieses Feld bleiben vorhandene Links unverändert. E-Mail-Links mit `mailto:` werden ebenfalls übernommen.

Mit `"updateExistingBenefits": true` aktualisiert Jenkins Kurzbeschreibung, Details und Ziel-URL vorhandener Benefits mit demselben Titel und übernimmt die Reihenfolge des Benefits-Arrays. Zusätzliche Prod-Benefits bleiben mit ihren Inhalten erhalten und stehen danach in ihrer bisherigen relativen Reihenfolge. Ein leerer Benefits-Export verändert nichts. Geänderte Titel gelten als neue Kacheln; alte Titel werden nicht automatisch umbenannt oder gelöscht. Der aktuelle Deployment-Stand enthält zehn Application Links und vier Benefits, beide Aktualisierungsoptionen sind aktiviert. Ein erneuter Export setzt diese optionalen Flags nicht automatisch; vor dem Commit bei gewünschter Aktualisierung wieder ergänzen.

`005_order_benefits.sql` ergänzt die gespeicherte Reihenfolge für Benefits. Beim ersten Durchlauf bleibt ihre bisherige alphabetische Reihenfolge erhalten; wiederholte Deployments setzen eine bereits per Drag-and-drop gespeicherte Reihenfolge nicht zurück. Die Migration verändert weder Benutzer noch Benefit-Inhalte.

`006_benefit_urls.sql` ergänzt eine optionale Zieladresse für Benefits. Bestehende Benefits erhalten `url = NULL` und bleiben ohne externen Link verwendbar. Neue Exporte enthalten die URL; ältere Exportdateien ohne dieses Feld sind weiterhin importierbar. Bereits vorhandene Prod-Benefits werden nur mit aktiviertem `updateExistingBenefits` aktualisiert.

`008_create_elearning_courses.sql` legt den persistenten Kurskatalog, die einmalige Initialisierungsmarkierung und den PostgreSQL-Speicher für hochgeladene Lernmaterialien an (maximal 25 MB je Datei). `009_create_exam_attempts.sql` speichert Prüfungsergebnisse nutzerbezogen und löscht diese beim Entfernen eines Benutzerkontos. Der nachfolgende Content-Import fügt die versionierten Standardkurse nur beim ersten Lauf ein; Änderungen und Löschungen aus der Benutzeroberfläche werden nicht bei späteren Deployments überschrieben. Alle angemeldeten Mitarbeitenden können Kurse ansehen und absolvieren. Kurs-, Fragen- und Materialverwaltung ist serverseitig auf Admins beschränkt.

Der gesamte Import läuft in einer Transaktion und sperrt Schreibzugriffe auf beide Tabellen für seine Dauer. Fehler brechen den Job ab und rollen den Import zurück. Der Seed für Benutzer wird dabei nicht ausgeführt. Eine fehlende oder ungültige Exportdatei ist ein Deploymentfehler.

Ein normaler Code-Push ohne aktualisierten Export überträgt keine neuen lokalen Datenbankinhalte. Vor dem ersten Deployment mit Migrationen und Import die produktive Datenbank sichern. Nach dem Job im angemeldeten Portal prüfen, dass Links und Benefits einschließlich Icons, Details, Zieladressen und der gewünschten Reihenfolge geladen werden und zusätzliche Prod-Einträge erhalten bleiben.

## ISTQB-Kursfragen gezielt importieren

Die 90 Fragen aus `docs/elearning/istqb-portal/FRAGEN-MIT-LOESUNGEN.md` werden bei Änderungen an der Quelle nicht automatisch importiert. Der einmalige Produktionsimport ist für den freigegebenen Deployment-Lauf über `deploy/istqb-question-import-once.json` ausgelöst. Für einen späteren gezielten Import nach Datenbankbackup kann im aktualisierten API-Container folgender Befehl ausgeführt werden:

```sh
docker compose -p mitarbeiter-portal --env-file /var/www/mitarbeiter-portal/.env -f docker-compose.prod.yml exec api npm run questions:import:istqb
```

Dies ersetzt ausschließlich die Fragen des vorhandenen Kurses mit Slug `istqb-foundation`, einschließlich ihrer Kapitel-, Lernziel- und K1/K2/K3-Zuordnung. Kursdaten, Materialien, andere Kurse und bisherige Prüfungsergebnisse bleiben erhalten. Der Import validiert die Markdown-Datei und schreibt atomar; identischer Inhalt wird nicht erneut geschrieben. Spätere manuelle Änderungen an Kursfragen werden erst bei ausdrücklichem erneutem Import ersetzt. Der einmalige Jenkins-Auslöser wird nicht bei normalen Deployments wiederholt.

Die vorgeschaltete ISTQB-Übungsauswahl benötigt diese Metadaten auch bei bereits importierten Fragen: den Befehl nach Freigabe erneut ausführen. Migration `010_create_practice_progress.sql` ergänzt ausschließlich die Tabelle `elearning_practice_progress` für den persönlichen Übungsstand (nach Migration 008 ausführen). Die Migration wird über den bestehenden Deployment-Migrationslauf angewendet. Keine neuen Konfigurationswerte erforderlich. Nach dem Deployment Kapitel-/Wissensstufenfilter und eine gespeicherte Antwort nach erneutem Öffnen der Übung prüfen.

## Hochgeladene Lernmaterialien einmalig übertragen

Dateien aus der lokalen Kursverwaltung liegen in PostgreSQL und sind nicht Bestandteil eines normalen Code-Pushs. Nach Prüfung der Verteilungsrechte und lokalem Export nach `deploy/elearning-materials/` werden Dateien und Kurszuordnungen mitgepusht. Jenkins importiert das Bundle nur, wenn sich dieser Verzeichnispfad im Push geändert hat. Der Import erfolgt vor dem Start der neuen Anwendungsversion und ergänzt Dateien sowie Kursmaterialien atomar. Bestehende Kursinhalte, Prüfungsergebnisse und andere Materialien werden nicht ersetzt; bei einer kollidierenden ID mit abweichendem Dateiinhalt wird das Deployment abgebrochen.

Nach dem Deployment im Portal kontrollieren, ob die erwarteten Materialien in den jeweiligen Kursen angezeigt und heruntergeladen werden können. Das versionierte Bundle enthält die Binärdateien im Repository; vor Export und Push müssen Verteilungsrechte für alle enthaltenen Dateien vorliegen.

### Persistente CTFL-Prüfungssimulation

Migration `011_create_exam_sessions.sql` muss vor Verwendung des neuen Foundation-Prüfungsmodus angewendet sein; Jenkins berücksichtigt sie im vorhandenen Migrationslauf. Die Simulation beginnt erst mit „Prüfung starten“ und zieht exakt 40 unterschiedliche Fragen nach den versionierten Lernzielgruppen des Fragenpools (Kapitel: 8/6/4/11/9/2, Wissensstufen K1/K2/K3: 8/24/8). Ein unvollständiger oder falsch zugeordneter Pool führt zu einer ausdrücklichen Fehlermeldung, nicht zu einer verkürzten Prüfung.

Fragen, Optionen, Lösungen, Antworten und die unveränderliche 60-/75-Minuten-Frist werden serverseitig als Snapshot gespeichert. Ein partieller eindeutiger Index und transaktionale Benutzersperren erlauben nur einen aktiven Versuch pro Benutzerkonto. Bei einem gemeinsam verwendeten Konto gilt diese Grenze gemeinsam für alle Personen. Es gibt keine Pause; Abmeldung oder Browser-Schließen hält die Frist nicht an. Speichern, Abgeben und Abbrechen werden pro Konto serialisiert. Zu spät eingehende Antworten werden nicht mehr übernommen.

Zeitablauf wird bei der nächsten Prüfungsanfrage bzw. beim Abruf des Verlaufs nachgezogen, mit dem tatsächlichen Fristende als Ergebniszeitpunkt; dafür ist kein Hintergrundjob nötig. Antworten brauchen eine funktionierende Verbindung: fehlgeschlagene Speicherungen bleiben in der geöffneten Seite zur Wiederholung erhalten und werden sichtbar gemeldet. Vor erfolgreicher Speicherung nicht schließen. Abbrüche bleiben ohne Wertung in einem separaten Verlauf und zählen nicht zum Durchschnitt. Lösungen erscheinen nur nach gewerteter Abgabe oder Zeitablauf, nicht beim Abbruch. Andere Kurse behalten ihre bisherige zehnminütige Demo-Prüfung.

Nach Deployment Start mit 60/75 Minuten, automatische Speicherung, Neuladen/Wiederaufnahme und getrennten Abbruchverlauf prüfen. Integrationstests gegen eine lokale PostgreSQL-Datenbank laufen aus dem API-Verzeichnis mit `RUN_EXAM_DB_TESTS=1`, geladener `DATABASE_URL` und `vitest run src/db/exam-session-repository.integration.test.ts`. Sie verwenden ein eigenes zufälliges Schema und entfernen ausschließlich dieses anschließend.
