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

Der Import verwendet `docs/elearning/istqb-portal/grundlagen-screenshot-fragen.json` zum Austausch von Kapitel 1, `docs/elearning/istqb-portal/lebenszyklus-screenshot-fragen.json` für Kapitel 2, `docs/elearning/istqb-portal/statisch-screenshot-fragen.json` für Kapitel 3, `docs/elearning/istqb-portal/testentwurf-screenshot-fragen.json` für Kapitel 4, `docs/elearning/istqb-portal/testmanagement-screenshot-fragen.json` für Kapitel 5 und `docs/elearning/istqb-portal/testwerkzeuge-screenshot-fragen.json` für Kapitel 6. Die 90 ursprünglichen Fragen aus `FRAGEN-MIT-LOESUNGEN.md` dienen weiterhin als Referenz für fehlende Prüfungslernziele. Änderungen an den Quellen werden nicht automatisch importiert. Der einmalige Produktionsimport ist für den freigegebenen Deployment-Lauf über `deploy/istqb-question-import-once.json` ausgelöst. Für einen späteren gezielten Import nach Datenbankbackup kann im aktualisierten API-Container folgender Befehl ausgeführt werden:

```sh
docker compose -p mitarbeiter-portal --env-file /var/www/mitarbeiter-portal/.env -f docker-compose.prod.yml exec api npm run questions:import:istqb
```

Optional wählt ein abschließendes Argument `1`, `2`, `3`, `4`, `5` oder `6` nur dieses Kapitel aus; ohne Argument bzw. mit `all` werden alle sechs importiert. Beispiel für den gezielten lokalen Import statischer Tests (mit vorherigem Backup): `npm run questions:import:istqb --workspace @portal/api -- 3`. So bleiben auch manuell bearbeitete Fragen der jeweils anderen Screenshotkapitel unangetastet.

Dies ersetzt ausschließlich die ausgewählten Screenshotkapitel des vorhandenen Kurses mit Slug `istqb-foundation`. Alle nicht gewählten Kapitel bleiben unverändert. Kursdaten, Materialien, andere Kurse und bisherige Prüfungsergebnisse bleiben erhalten. Der Import validiert die ausgewählten Quellen und schreibt atomar; identischer Inhalt wird nicht erneut geschrieben. Spätere manuelle Änderungen an Kapitel 1 bis 6 werden erst bei ausdrücklichem erneutem Import ersetzt. Der einmalige Jenkins-Auslöser wird nicht bei normalen Deployments wiederholt.

Die Screenshotquellen sind gegen den deutschen CTFL-Lehrplan 4.0.2 vom 01.03.2025 bereinigt. Von ursprünglich 150 Grundlagen-, 72 Testmanagement- und 43 Werkzeugfragen wurden 57, 25 bzw. 15 historische oder nicht lehrplankonforme Fragen entfernt. Die Quellen enthalten jetzt **93 / 47 / 28 aktive Fragen**. `sourceQuestionCount` dokumentiert weiterhin die ursprüngliche Anzahl; `reviewedSyllabus` benennt die Prüfgrundlage. `excludedQuestions` hält ausschließlich IDs, Quellnummern, Ausschlussgründe, Lehrplanabschnitte und gegebenenfalls frühere Originalbestätigungen zur Nachvollziehbarkeit fest, nicht importierbare Fragen. Stabile IDs bleiben erhalten; Lücken werden nicht neu nummeriert. Grundlagen-Quellnummern 118–120 fehlen weiterhin auf ausdrücklichen Wunsch.

Entfernt wurden insbesondere das alte fünfphasige Testprozessmodell einschließlich seiner fünf Grafikfragen, ISO-9126-/IEEE-829-Fragen und überholte Normenstände, die alte Teststrategie-Typologie, anwendungsfallbasiertes Testen, Werkzeugauswahl/Pilotierung/Einführung sowie starre historische Kostenfaustregeln und mit dem aktuellen Lehrplan unvereinbare Originalschlüssel. Grundlage sind die aktuellen Fachabschnitte und die Änderungsliste des Lehrplans (Kapitel 10, insbesondere Seiten 89–90). Ältere Fragen mit weiterhin gültigem Inhalt, etwa zu Testzielen, Testrollen oder Unabhängigkeit, bleiben erhalten. Die Fragen bleiben in den vom Benutzer gewählten Screenshotkapiteln, auch bei kapitelübergreifenden Themen. Exakte Dubletten werden anhand von Fragetext, Antworttexten unabhängig von deren Reihenfolge und Abbildung entfernt; widersprüchliche Lösungsschlüssel brechen den Import ab.

`usage` trennt Übungsfragen (`practice`), reine Simulationsfragen (`exam`) und beides (`both`); ohne Angabe bleibt das bisherige Verhalten erhalten. 19 fachlich passende neue Fragen sind für die Kapitel-1-Lernzielgruppen der aktuellen Simulation freigegeben. Acht bisherige Kapitel-1-Fragen ergänzen fehlende Lernziele als `both` und erscheinen auch im Übungsbereich und dessen Fragenzahl. Die Simulation behält ihren 40-Fragen-Bauplan und die K-Stufenverteilung.

Die bestätigten Grundlagen-Schlüssel 37 und 54 bleiben unverändert. Die Bestätigungen ausgeschlossener Fragen stehen nur noch bei deren Ausschlussvermerk und sind nicht Teil des aktiven Pools. Erklärungen weiterhin gültiger Fragen enthalten keine Anleitung zum veralteten Prozessmodell mehr. Der erlaubte Verwaltungsumfang beträgt maximal 500 Fragen je Kurs.

Kapitel 6 enthält 28 aktive Screenshotfragen, ohne exakt identische Dubletten. Die individuellen Erklärungen verweisen auf „Basiswissen Softwaretest“, Kapitel 7, und den aktuellen Lehrplan. 22 geeignete Fragen decken FL-6.1.1/K2 und FL-6.2.1/K1 ab. Damit werden die vier ursprünglichen Kapitel-6-Fragen vollständig ersetzt, auch in der Simulation; für dieses Kapitel sind keine Prüfungsfallbacks nötig. Die früher bestätigten Fragen 18 und 35 sind wegen ihrer historischen Einführungsreihenfolge bzw. Werkzeugklassifikation ausgeschlossen.

Die vorgeschaltete ISTQB-Übungsauswahl benötigt diese Metadaten auch bei bereits importierten Fragen: den Befehl nach Freigabe erneut ausführen. Migration `010_create_practice_progress.sql` ergänzt ausschließlich die Tabelle `elearning_practice_progress` für den persönlichen Übungsstand (nach Migration 008 ausführen). Die Migration wird über den bestehenden Deployment-Migrationslauf angewendet. Keine neuen Konfigurationswerte erforderlich. Nach dem Deployment Kapitel-/Wissensstufenfilter und eine gespeicherte Antwort nach erneutem Öffnen der Übung prüfen.

Kapitel 5 enthält 47 aktive Testmanagement-Screenshotfragen, ohne exakt identische Dubletten. Lösungen und individuelle Erklärungen verweisen auf „Basiswissen Softwaretest“; die 22 aktuellen Simulationskandidaten zusätzlich auf den CTFL-Lehrplan 4.0.2. Die weiterhin enthaltenen Originalauflösungen 14 und 46 folgen unverändert der richtigen Antwort in der gelben Lösungsbox, nicht der falsch markierten Auswahl. Die übrigen sechs nachgereichten Originalfragen sind mit Ausschlussgrund dokumentiert, nicht mehr als Übungsmaterial enthalten.

Die ursprünglichen Kapitel-5-Übungsfragen werden ersetzt. Für nicht abgedeckte aktuelle Prüfungslernziele bleiben 14 Fragen als `both` für Übung und Simulation erhalten, darunter alle sieben K3-Aufgaben: Reine Wissensfragen aus dem Screenshotkatalog ersetzen keine Anwendungsaufgaben zur Schätzung, Priorisierung oder Erstellung von Fehlerberichten. Diese Fragen und die acht Kapitel-1-Fallbacks stammen aus dem bereits auf CTFL 4.0.2 abgestimmten Ausgangspool, nicht aus historischen Katalogen.

Kapitel 4 enthält **87 aktive Screenshotfragen mit 14 Grafik-/Tabellenausschnitten**. Ausgangspunkt sind 123 Ordner-Screenshots plus eine separat nachgereichte Entscheidungstabelle. Zwei Wiederholungen der Frage 65 und eine zusätzliche Testmanagement-Aufnahme werden separat dokumentiert. Von 121 eigenständigen Kandidaten sind 34 ausgeschlossen: historische Verfahren (unter anderem Pfad-, Mehrfachbedingungs- und 1-Switch-Überdeckung) sowie fachlich unzutreffende oder mehrdeutige Aufgaben. Die Ausschlüsse werden nicht als versteckte Übungs- oder Prüfungsfragen importiert.

14 aktive Lösungen sind anhand der nachgereichten gelben Originalauflösungsboxen bestätigt; falsch ausgewählte Antworten werden nicht übernommen. Die bestätigten Fragen 69 und 121 bleiben wegen ihrer mit dem aktuellen Lehrplan unvereinbaren Pauschalaussagen ausschließlich im Ausschlussvermerk dokumentiert. Kontextabhängige Originalfragen wie 22, 66, 83 und 115 bleiben nur Übung, mit erläuterndem Hinweis. Die erste nachgereichte Tabelle ist eine zusätzliche Frage (ID 122), nicht die im Ordner unter Nummer 1 erfasste Reviewfrage. Zwei unterschiedliche Fragen mit gedruckter Nummer 11 werden separat erhalten: Codestruktur unter ID 11, Bonusberechnung unter ID 123. Die unnummerierte Black-Box-Vorteilsfrage hat ID 109; ihre Zuordnung erfolgt im Quellenverzeichnis über den Dateinamen, nicht über eine behauptete Quellnummer.

36 Kapitel-4-Fragen sind zusätzlich für aktuelle Prüfungslernziele freigegeben, einschließlich echter K3-Anwendungsaufgaben. Sechs aktuelle Ausgangsfragen bleiben als `both` für FL-4.4.1, FL-4.4.3 und FL-4.5.1–3 erhalten und sind auch zum Üben verfügbar. Die neuen PNGs unter `apps/web/public/questions/istqb-foundation/testentwurf-*.png` müssen mit dem Web-Build ausgeliefert werden; sie enthalten nur Aufgabenabbildungen, keine gelben Lösungsboxen oder Antwortmarkierungen.

Kapitel 2 ersetzt die zwölf bisherigen Übungsfragen durch **60 aktive Screenshotfragen mit einem Originalgraphen**. Die 94 Ordneraufnahmen enthalten 93 eigenständige Kandidaten: Frage 36 wurde zweimal aufgenommen, eine eigenständige Frage 37 fehlt. 33 historische, fachlich ungeeignete oder mehrdeutige Fragen stehen ausschließlich im Ausschlussverzeichnis. Die Schlüssel zu 10, 53, 71 und 78 stammen aus den gelben Originalauflösungsboxen, nicht aus falsch ausgewählten Antworten. Der Schlüssel zu Frage 15 („A-a-E“) folgt aus dem vollständig nachgereichten Diagramm; er ist nicht als gelb bestätigt gekennzeichnet. Kontextabhängige Originalfragen bleiben nur Übung, mit erläuternden Hinweisen. 34 Fragen sind zusätzlich für die Simulation freigegeben. Drei aktuelle Ausgangsfragen zu FL-2.1.4–6 (DevOps, Shift-Left, Retrospektiven) bleiben als `both` für Übung und Simulation erhalten. Die Abbildung `apps/web/public/questions/istqb-foundation/lebenszyklus-015.png` muss im Web-Build mit ausgeliefert werden.

Kapitel 3 ersetzt die acht bisherigen Übungsfragen durch **31 aktive Screenshotfragen mit einem Originalgraphen**. Alle 56 Quellaufnahmen sind einzeln erfasst. 25 historische, mehrdeutige oder fachlich ungeeignete Aufgaben stehen ausschließlich im Ausschlussverzeichnis; dazu gehören zyklomatische Komplexität, dd-/du-/ur-Anomalien, historische Reviewphasen sowie unpassende Antwortkombinationen. Frage 27 enthält zudem nicht vollständig lesbare numerische Antworten und wird nicht spekulativ rekonstruiert. Die Originalschlüssel 5/D, 32/D, 43/A, 54/A und 56/C folgen den gelben Lösungsboxen, nicht der falsch markierten Auswahl. Die vollständige Lösung bestätigt die ursprünglich abgeschnittene Quellnummer 32. Kontextabhängige Schlüssel bleiben nur Übung und enthalten entsprechende Erläuterungen. Zwölf Fragen sind zusätzlich für die Simulation geeignet. Zwei aktuelle Ausgangsfragen für FL-3.2.1 und FL-3.2.5 (Stakeholder-Feedback und Review-Erfolgsfaktoren) bleiben als `both` für Übung und Simulation erhalten. Der zugeschnittene Originalgraph `apps/web/public/questions/istqb-foundation/statisch-005.png` enthält keine Antwortmarkierungen oder Lösung und muss im Web-Build ausgeliefert werden.

Damit sind alle sechs Übungskapitel durch die bereinigten Screenshotquellen ersetzt. Der vollständige Pool enthält nach Import **379 sichtbare Übungsfragen einschließlich der 33 Ergänzungsfragen** (Kapitel: 101/63/33/93/61/28). Alle Ergänzungsfragen, auch die oben beschriebenen drei in Kapitel 2 und zwei in Kapitel 3, werden als `both` statt `exam` importiert; es gibt keine reinen Prüfungsfragen mehr. Die Simulation verwendet geeignete Fragen aus demselben Bestand; kontextabhängige Originalfragen bleiben nur Übung. Der 40-Fragen-Bauplan und die K-Stufenverteilung bleiben unverändert. Zur Umstellung aller sechs Kapitel nach lokalem Backup den Import mit `all` wiederholen; nur die Verwendung der Ergänzungsfragen ändert sich, nicht ihre IDs, Inhalte oder Lösungen.

Für die freigegebene Veröffentlichung vom 21.10.2026 ist die Revision in
`deploy/istqb-question-import-once.json` aktualisiert. Dadurch führt Jenkins den
idempotenten Import aller sechs Kapitel nach den Migrationen und vor dem Deploy
aus. Der Docker-Build übernimmt die JSON-Quellen und die PNG-Aufgabenabbildungen.
Nach dem Job 379 Übungsfragen mit Kapitelbeständen 101/63/33/93/61/28 sowie
die Übungsauswahl (20/40/alle) prüfen. Vorher ein Produktionsdatenbankbackup
über den bestehenden Betriebsprozess sicherstellen.

Zum Entfernen bereits importierter historischer Fragen aus allen sechs Screenshotkapiteln nach Backup ausdrücklich `npm run questions:import:istqb --workspace @portal/api -- all` ausführen. Ein gezielter Import mit `1`, `2`, `3`, `4`, `5` oder `6` bereinigt nur das gewählte Kapitel. Frühere Prüfungssnapshots bleiben als historische Ergebnisse unverändert; eine bereits geöffnete Übung muss neu geladen bzw. neu gestartet werden. Ein normaler Code-Push allein bereinigt keine Datenbank.

## Hochgeladene Lernmaterialien einmalig übertragen

Dateien aus der lokalen Kursverwaltung liegen in PostgreSQL und sind nicht Bestandteil eines normalen Code-Pushs. Nach Prüfung der Verteilungsrechte und lokalem Export nach `deploy/elearning-materials/` werden Dateien und Kurszuordnungen mitgepusht. Jenkins importiert das Bundle nur, wenn sich dieser Verzeichnispfad im Push geändert hat. Der Import erfolgt vor dem Start der neuen Anwendungsversion und ergänzt Dateien sowie Kursmaterialien atomar. Bestehende Kursinhalte, Prüfungsergebnisse und andere Materialien werden nicht ersetzt; bei einer kollidierenden ID mit abweichendem Dateiinhalt wird das Deployment abgebrochen.

Nach dem Deployment im Portal kontrollieren, ob die erwarteten Materialien in den jeweiligen Kursen angezeigt und heruntergeladen werden können. Das versionierte Bundle enthält die Binärdateien im Repository; vor Export und Push müssen Verteilungsrechte für alle enthaltenen Dateien vorliegen.

### Persistente CTFL-Prüfungssimulation

Migration `011_create_exam_sessions.sql` muss vor Verwendung des neuen Foundation-Prüfungsmodus angewendet sein; Jenkins berücksichtigt sie im vorhandenen Migrationslauf. Die Simulation beginnt erst mit „Prüfung starten“ und zieht exakt 40 unterschiedliche Fragen nach den versionierten Lernzielgruppen des Fragenpools (Kapitel: 8/6/4/11/9/2, Wissensstufen K1/K2/K3: 8/24/8). Ein unvollständiger oder falsch zugeordneter Pool führt zu einer ausdrücklichen Fehlermeldung, nicht zu einer verkürzten Prüfung.

Fragen, Optionen, Lösungen, Antworten und die unveränderliche 60-/75-Minuten-Frist werden serverseitig als Snapshot gespeichert. Ein partieller eindeutiger Index und transaktionale Benutzersperren erlauben nur einen aktiven Versuch pro Benutzerkonto. Bei einem gemeinsam verwendeten Konto gilt diese Grenze gemeinsam für alle Personen. Es gibt keine Pause; Abmeldung oder Browser-Schließen hält die Frist nicht an. Speichern, Abgeben und Abbrechen werden pro Konto serialisiert. Zu spät eingehende Antworten werden nicht mehr übernommen.

Zeitablauf wird bei der nächsten Prüfungsanfrage bzw. beim Abruf des Verlaufs nachgezogen, mit dem tatsächlichen Fristende als Ergebniszeitpunkt; dafür ist kein Hintergrundjob nötig. Antworten brauchen eine funktionierende Verbindung: fehlgeschlagene Speicherungen bleiben in der geöffneten Seite zur Wiederholung erhalten und werden sichtbar gemeldet. Vor erfolgreicher Speicherung nicht schließen. Abbrüche bleiben ohne Wertung in einem separaten Verlauf und zählen nicht zum Durchschnitt. Lösungen erscheinen nur nach gewerteter Abgabe oder Zeitablauf, nicht beim Abbruch. Andere Kurse behalten ihre bisherige zehnminütige Demo-Prüfung.

Nach Deployment Start mit 60/75 Minuten, automatische Speicherung, Neuladen/Wiederaufnahme und getrennten Abbruchverlauf prüfen. Integrationstests gegen eine lokale PostgreSQL-Datenbank laufen aus dem API-Verzeichnis mit `RUN_EXAM_DB_TESTS=1`, geladener `DATABASE_URL` und `vitest run src/db/exam-session-repository.integration.test.ts`. Sie verwenden ein eigenes zufälliges Schema und entfernen ausschließlich dieses anschließend.
