# Auftrag an Copilot: CTFL-Übungsbereich im bestehenden Mitarbeiterportal

Erweitere den bestehenden eLearning-Bereich unseres Mitarbeiterportals um eine eigene ISTQB-Foundation-Level-Prüfungsvorbereitung mit den beiden Bereichen **„Übungsfragen“** und **„Prüfungssimulation“**. Setze die Erweiterung im vorhandenen Repository um. Verwende vorhandene Navigation, Komponenten, Anmeldung, Rollen und Designvorgaben. Prüfe zuerst die Projektstruktur und vorhandene Implementierungen. Integriere die Funktionen direkt in unser Portal.

Die mitgelieferte Datei `istqb-ctfl-fragenpool.json` enthält **90 vollständig formulierte, eigene Übungsfragen** inklusive Antwortoptionen, richtigen Antworten, Erklärungen, Kapitel, Lernziel, Wissensstufe und einem maschinenlesbaren Prüfungsbauplan. Verwende diesen Pool als initialen Datenbestand; erzeuge im laufenden Portalbetrieb keine neuen Fragen mit KI. `FRAGEN-MIT-LOESUNGEN.md` ist eine lesbare Referenz für die fachliche Prüfung. Verwende die deutsche Lehrplanversion **4.0.2 vom 01.03.2025**, die auf dem englischen Lehrplan 4.0.1 basiert. Die ältere PDF 4.0.1a ist nicht die primäre Inhaltsgrundlage.

## 1. Einstieg und Darstellung

- Im bestehenden eLearning-Bereich eine gut erkennbare Kachel „ISTQB Foundation Level“ ergänzen. Darunter die zwei Modi und den bisherigen persönlichen Lernstand anzeigen.
- Für Mitarbeiter und Administratoren im vorhandenen Berechtigungssystem verfügbar machen. Persönliche Ergebnisse jeweils nur für den angemeldeten Benutzer anzeigen; keine öffentliche Bestenliste ergänzen.
- Die bestehenden Portalstile verwenden: klare Karten, verständliche Beschriftungen, erkennbare Zustände, gute Lesbarkeit und mobile Darstellung. Keine bestehende Kurs-, Buchungs- oder Inhaltsverwaltung überschreiben.
- Auf der Einstiegsseite anzeigen: „Übungsmaterial zum CTFL-Lehrplan 4.0.2. Eigene Übungsfragen – keine offiziellen ISTQB-Prüfungsfragen. Die Simulation ist keine Zertifizierungsprüfung.“ Keine offiziellen Logos oder Zertifikate erzeugen.
- Die Quellen aus der JSON-Datei im Informationsbereich verlinken.

## 2. Übungsfragen

- Ohne Zeitlimit üben. Vor Beginn Auswahl zwischen allen Kapiteln oder einzelnen Kapiteln anbieten. Optional nach K1/K2/K3 filtern; diese Stufen als „Erinnern“, „Verstehen“ und „Anwenden“ erklären, nicht als Schwierigkeitsgarantie bezeichnen.
- Sitzungsumfang 10, 20 oder alle verfügbaren Fragen im gewählten Filter anbieten. Bei weniger verfügbaren Fragen die tatsächliche Anzahl deutlich anzeigen. Fragen innerhalb einer Sitzung nicht wiederholen.
- Zufällige Reihenfolge der Fragen und Antwortoptionen. Bereits beantwortete Fragen möglichst seltener anbieten; falsch beantwortete Fragen über „Fehler wiederholen“ erneut auswählbar machen.
- Eine Frage pro Ansicht. Kapitel und Lernziel anzeigen. Immer ausdrücklich „Wähle 1 Antwort“ oder „Wähle 2 Antworten“ anzeigen, gemäß `requiredSelections`.
- Bei `type=single` Radiobuttons, bei `type=multiple` Checkboxen. Maximal die angegebene Anzahl auswählbar machen. Nicht ausgefüllte Fragen dürfen übersprungen werden. Zum Prüfen muss die geforderte Anzahl gewählt sein.
- Erst nach „Antwort prüfen“ richtige und falsche Optionen sowie die Erklärung anzeigen. Die Bewertung einer Frage für diese Sitzung anschließend einfrieren. Weiterhin ohne Zeitdruck lesen und zur nächsten Frage wechseln können.
- Bewertungen anhand stabiler Options-IDs durchführen. Nach dem Mischen darf weder eine korrekte Lösung verloren gehen noch über den ursprünglichen Buchstaben ausgewertet werden. Neue A/B/C/D-Beschriftungen nur für die jeweilige Anzeige vergeben.
- Am Ende Übersicht über richtige, falsche und übersprungene Fragen sowie Kapitelwerte anzeigen. Bei null beantworteten Fragen keine irreführende Erfolgsquote berechnen. Wiederholung mit neu gemischten Fragen ermöglichen.
- Persönlichen Fortschritt getrennt von Prüfungsversuchen speichern. Lernstatistiken durch wiederholtes Klicken auf „Antwort prüfen“ nicht mehrfach erhöhen.

## 3. Prüfungssimulation: Regeln

Die folgenden Eckdaten orientieren sich an den offiziellen CTFL-Prüfungsregeln; konkrete Portalabläufe wie Speicherung und Ergebnisansicht sind unsere Implementierungsentscheidungen.

| Regel | Einstellung |
|---|---|
| Fragen | Genau 40 unterschiedliche Fragen |
| Standardzeit | 60 Minuten |
| Verlängerte Zeit | 75 Minuten bei vorher ausgewählter Übungsoption „Prüfungssprache ist nicht meine Muttersprache“ |
| Punkte | Jede vollständig richtig beantwortete Frage 1 Punkt, maximal 40 |
| Bestanden | Mindestens 26/40 Punkte, also 65 % |
| Falsch oder unbeantwortet | 0 Punkte |
| Mehrfachauswahl | Punkt nur bei exakt richtiger Gesamtmenge; keine Teilpunkte |
| Minuspunkte | Keine |
| Hilfsmittel | Als Prüfungssimulation ohne Lernunterlagen und externe Hilfe durchführen |
| Feedback | Lösungen und Erklärungen erst nach Abgabe bzw. Zeitablauf |
| Pause | Keine; die Prüfungszeit läuft kontinuierlich weiter |

Für die Simulation keine Mindestberufserfahrung, keinen vorherigen Kursabschluss und keinen bestandenen Lernmodus verlangen. Die Zeitverlängerung ist eine vor dem Start wählbare Übungsoption; sie ersetzt keinen Antrag bzw. Nachweis bei einem realen Prüfungsanbieter. Während eines laufenden Versuchs darf die Dauer nicht geändert werden. Vor dem Start alle Regeln und die ausgewählte Dauer anzeigen. Ein expliziter Klick auf „Prüfung starten“ erzeugt den Versuch und startet die Uhr.

## 4. Prüfungssimulation: Themen- und Wissensverteilung

**Nicht einfach 40 Fragen aus dem gesamten Pool ziehen.** Verwende die `examBlueprint.selectionGroups` im JSON. Dadurch werden Kapitel, K-Stufen und Lernzielgruppen gleichzeitig eingehalten.

| Kapitel | Fragen | K1 | K2 | K3 |
|---|---:|---:|---:|---:|
| 1 Grundlagen des Testens | 8 | 2 | 6 | 0 |
| 2 Testen im Lebenszyklus | 6 | 2 | 4 | 0 |
| 3 Statischer Test | 4 | 2 | 2 | 0 |
| 4 Testanalyse und -entwurf | 11 | 0 | 6 | 5 |
| 5 Management der Testaktivitäten | 9 | 1 | 5 | 3 |
| 6 Testwerkzeuge | 2 | 1 | 1 | 0 |
| **Gesamt** | **40** | **8** | **24** | **8** |

Algorithmus je Auswahlgruppe:

1. Ermittle aktive Fragen für die in der Gruppe genannten Lernziele.
2. Wenn die Zahl benötigter Fragen höchstens der Zahl der Lernziele entspricht, ziehe entsprechend viele **verschiedene Lernziele** zufällig und je eine Frage zu jedem gezogenen Lernziel.
3. Wenn mehr Fragen als Lernziele benötigt werden, zunächst jedes Lernziel mindestens einmal belegen, danach weitere Fragen ohne doppelte Fragen-ID auswählen.
4. Alle Gruppen zusammenführen, Fragenreihenfolge zufällig mischen und pro Frage die Optionen zufällig mischen. Diese Auswahl und Reihenfolge für den ganzen Versuch unverändert speichern.
5. Vor Start die tatsächlichen Summen und die Gruppenbelegung validieren. Bei unzureichendem Pool keinen unvollständigen oder falsch gewichteten Versuch starten. Stattdessen eine verständliche Fehlermeldung anzeigen und intern die fehlende Gruppe protokollieren.

Der beigefügte Pool unterstützt diese Regeln. Bei neuen Versuchen andere Auswahl und Reihenfolgen anstreben. Eine vollständige Vermeidung von Wiederholungen über mehrere Prüfungen ist wegen der endlichen Fragenmenge und fest vorgeschriebener Lernzielgruppen nicht möglich. Verteilungsregeln haben Vorrang vor dem Wunsch, alte Fragen zu vermeiden. Ein fest gespeicherter Seed ist für Reproduzierbarkeit möglich; keine neue Ziehung bei jedem Rendern.

## 5. Prüfungssimulation: Ablauf

- Verbleibende Zeit deutlich und durchgehend anzeigen. Bei 10 und 5 Minuten dezente Hinweise; Screenreader nicht jede Sekunde unterbrechen.
- Fragenübersicht 1–40 anbieten. Zustände „unbeantwortet“, „beantwortet“ und „markiert“ unterscheidbar machen. Freies Vor- und Zurückspringen und Markieren zur späteren Prüfung erlauben.
- Antwortänderungen bis zur endgültigen Abgabe bzw. Frist erlauben. Antworten und Markierungen automatisch speichern. Den Speicherstatus nachvollziehbar anzeigen.
- Während der Prüfung keine Lösungen, Hinweise, Erklärungen oder Richtig-/Falsch-Anzeigen liefern. Kapitel/K-Stufen dürfen in der eigentlichen Prüfungsansicht ausgeblendet bleiben, Auswahlanzahl muss sichtbar sein.
- „Prüfung abgeben“ öffnet eine Bestätigung mit Zahl unbeantworteter bzw. unvollständig ausgewählter Fragen. Abgabe trotz offener Fragen erlauben; diese Fragen zählen mit 0 Punkten.
- Bei Zeitablauf automatisch mit dem zuletzt rechtzeitig gespeicherten Stand abschließen. Falls der Browser geschlossen ist, serverseitig als abgelaufen behandeln und beim nächsten Aufruf auswerten; kein neuer Timer.
- Beim Neuladen, Tabwechsel, Schließen oder erneutem Anmelden läuft die Frist weiter. Beim Wiederaufruf denselben Versuch mit derselben Auswahl und gespeichertem Stand fortsetzen, falls Zeit bleibt.
- Einen aktiven Prüfungsversuch pro Benutzer zulassen. Zweiter Tab und parallele Requests dürfen weder neue Zeit noch einen zweiten aktiven Versuch erzeugen. Konflikte mit klaren Hinweisen lösen.
- Abgabe idempotent verarbeiten. Doppelklick, Retry und gleichzeitiger Zeitablauf dürfen nicht mehrere Ergebnisse erzeugen. Nach Abschluss weder Antworten noch Ergebnis verändern.
- Vorzeitig beendete Versuche als „abgebrochen“ dokumentieren und von regulär abgegebenen/abgelaufenen Versuchen unterscheiden. Ein Abbruch darf keinen bestandenen Versuch erzeugen. Wiederholungen sind möglich, jedoch als neuer Versuch mit neuer Startzeit.

## 6. Auswertung

- Punkte `x/40`, Prozentwert `x/40*100` und „Bestanden“/„Nicht bestanden“ anzeigen. Die Bestehensentscheidung anhand von `points >= 26` treffen, nicht anhand gerundeter Prozentwerte.
- Verwendete Dauer, tatsächliche Bearbeitungsdauer, Datum und Abschlussgrund anzeigen. Bearbeitungsdauer bei abgelaufenen Versuchen auf das Zeitlimit begrenzen.
- Richtig, falsch und unbeantwortet getrennt zählen. Eine Mehrfachfrage mit einer statt zwei gewählten Optionen als unvollständig/unbeantwortet darstellen und mit 0 bewerten; diese Entscheidung konsistent in allen Statistiken verwenden.
- Kapitelweise Ergebnisse und Lernempfehlungen anzeigen. Je Frage eigene Auswahl, richtige Auswahl, Erklärung und Lernziel zugänglich machen.
- Frühere Ergebnisse mit dem damaligen Fragenstand erhalten. Spätere Pooländerungen dürfen alte Ergebnisse nicht nachträglich neu berechnen.
- Nur eine Übungsauswertung darstellen; kein offizielles ISTQB-Zertifikat erzeugen.

## 7. Technische Umsetzung im bestehenden Projekt

- Vorhandene Architektur verwenden. Wenn das Repository weiterhin Frontend unter `apps/web`, API unter `apps/api`, gemeinsame Typen unter `packages/shared` und PostgreSQL nutzt, dort integrieren. Tatsächliche Struktur zuerst prüfen, keine Pfade oder Frameworks ungeprüft voraussetzen.
- JSON mit einem Schema validieren: eindeutige Frage- und Options-IDs, zulässige K-Stufen, passender Kapitelbezug, vier verschiedene Antwortoptionen, gültige Lösungs-IDs, konsistente Auswahlanzahl, ein Punkt pro Frage, vollständige Erklärungen und verfügbare Gruppen.
- Initialdaten nachvollziehbar und idempotent importieren. Vorhandene Lerninhalte und Benutzer nicht löschen oder überschreiben. Fragenversionen berücksichtigen: gleiche ID+Revision nicht doppelt anlegen, Inhaltsänderungen mit neuer Revision verwalten.
- Erforderliche neue Tabellen/Spalten über neue, versionierte Migrationen ergänzen. Vorhandene Migrationen und Deploymentlogik prüfen. Der Jenkins-Deploy muss die neuen Migrationen vor dem Start der abhängigen API ausführen können. Keine nur lokal existierenden Datenbankänderungen voraussetzen.
- Datenmodell für Pool/Fragenrevisionen, Übungsergebnisse, Prüfungsversuche, unveränderliche Fragen-Snapshots bzw. versionierte Referenzen, Reihenfolgen, Antworten, Markierungen, Fristen und finales Ergebnis vorsehen. Die bestehende Benutzer-ID als Eigentümer verwenden.
- Prüfungsauswahl, Startzeit, `expiresAt` und Bewertung serverseitig verwalten. API verwendet Serverzeit. Der Browser berechnet nur die Anzeige anhand der serverseitigen Frist; ein einfach herunterzählender React-State ist nicht die maßgebliche Uhr.
- Bei Antwortänderung serverseitig den offenen Zustand und `now < expiresAt` prüfen. Nach Frist keine neue Antwort mehr akzeptieren. Bei Abgabe aufgelaufene Frist und Bewertungsstatus transaktional berücksichtigen.
- Richtige Antworten und Erklärungen im laufenden Prüfungsmodus nicht an den Browser senden. Den kompletten Lösungs-Pool nicht als öffentliches Frontend-Asset ausliefern. Prüfungsausgabe enthält nur Frage, Optionen, Auswahlanzahl und gespeicherte Benutzerauswahl. Feedback erst nach Abschluss; im Lernmodus nach „Antwort prüfen“.
- Jede API-Operation an Anmeldung und Eigentümerschaft des Versuchs binden. Andere Mitarbeiter dürfen weder Antworten noch Ergebnisse fremder Versuche abrufen oder verändern. Administrative Inhaltsrechte vom normalen Mitarbeiterzugriff trennen.
- Antwortmengen auf unbekannte bzw. doppelte Options-IDs und zu viele Auswahlen prüfen. Leere Antworten zum Aufheben einer Auswahl erlauben; unvollständige Mehrfachauswahl während Bearbeitung speichern können.
- Bei Netzwerkproblemen keine Speicherung vortäuschen. Wiederholung anbieten, laufende Zeit anzeigen. Prüfung nach Wiederverbindung mit dem serverseitigen Stand synchronisieren. Keine nachträglichen Offline-Antworten nach Ablauf akzeptieren.
- Nach Möglichkeit vorhandene Komponenten und Bibliotheken wiederverwenden. Bedienbarkeit mit Tastatur, sichtbaren Fokus, beschriftete Eingaben und statusunabhängige Farbcodierung beachten.
- Keine Webcam-, Bildschirmüberwachungs- oder Tabwechsel-Sanktionen einbauen. Der Hilfsmittelverzicht ist bei einer internen Simulation eine erklärte Übungsregel, keine technisch garantierte Beaufsichtigung.

## 8. Verifikation und Abschluss

Implementiere und prüfe mindestens diese materiellen Fälle mit der vorhandenen Testinfrastruktur:

1. Poolimport ist wiederholbar ohne Duplikate; alle 90 Fragen und ihre 64 Lernziele bleiben korrekt zugeordnet.
2. Viele zufällige Ziehungen ergeben jeweils genau 40 unterschiedliche Fragen, die Kapitel-/K-Stufen-Tabelle sowie die Lernzielgruppenregeln. Ein ausgedünnter Pool führt zu einem klaren Fehler statt falscher Auswahl.
3. Fragen- und Optionsmischung erhält die Zuordnung der Lösungen über IDs. Bei einem Reload bleiben beide Reihenfolgen gleich.
4. Einzelauswahl und Mehrfachauswahl werden korrekt bewertet: exakte Menge 1 Punkt; falsche, zusätzliche oder fehlende Auswahl 0; niemals Teil- oder Minuspunkte.
5. 25 Punkte ergeben „Nicht bestanden“, 26 und 40 Punkte „Bestanden“. Leere Abgabe ergibt 0/40, 0 %, 40 unbeantwortet.
6. Standard- und verlängerte Dauer sind 3600 bzw. 4500 Sekunden. Browser-Reload und Tabwechsel setzen die Frist nicht zurück; Zeitablauf sperrt weitere Änderungen und schließt ab.
7. Doppelabgabe und konkurrierende Requests erzeugen nur ein Ergebnis. Fremde Benutzer haben keinen Zugriff. Aktive Antworten enthalten keine Lösungen oder Erklärungen.
8. Änderung einer Fragenrevision verändert keine abgeschlossenen Versuche. Ein gespeicherter, noch offener Versuch kann korrekt fortgesetzt werden.
9. Frontendbuild und vorhandene relevante Tests bestehen; neue Datenbankmigrationen laufen auf bestehender Datenbank und bei frischem Setup. API startet erfolgreich; bestehender Health-Endpunkt bleibt funktionsfähig.

Setze die Erweiterung vollständig um. Berichte anschließend knapp, welche Dateien und Migrationen geändert wurden, wie ich beide Modi lokal prüfe, welche Tests erfolgreich waren und ob vor dem Deployment noch konkrete Konfiguration fehlt. Deployment oder externe Veröffentlichung nicht ungefragt ausführen.

## Quellenstand

Geprüft am 16.10.2026:

- Mitgelieferter deutschsprachiger Lehrplan CTFL 4.0.2 vom 01.03.2025, insbesondere Kapitel 1–6 und die Lernzielangaben; Herausgeber ATB, GTB, STB; englische Basis ISTQB 4.0.1.
- https://www.gtb.de/der-certified-tester/lehrplaene/
- https://istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/
- https://istqb.org/?download_id=3832&sdm_process_download=1 — Exam Structures & Rules Tables 1.19, CTFL auf PDF-Seiten 4–5.
- https://istqb.org/?download_id=3829&sdm_process_download=1 — Exam Structures and Rules 1.2.

Die Fragen und Erklärungen wurden für dieses Übungsangebot neu formuliert; sie sind keine Kopien offizieller Prüfungsaufgaben. Die Regeln für Zeit, Punkte, Bestehensgrenze und Verteilung sind von den technischen Produktentscheidungen getrennt. Die beigefügte Referenzdatei ermöglicht die fachliche Prüfung und spätere Erweiterung des Pools.
