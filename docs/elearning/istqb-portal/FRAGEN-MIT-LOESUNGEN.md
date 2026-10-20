# CTFL: 90 eigene Übungsfragen

Basis: deutscher Lehrplan 4.0.2 (01.03.2025), englische Basis 4.0.1.

Inoffizielle Prüfungsvorbereitung. Keine offiziellen ISTQB-Prüfungsfragen und keine Zertifizierungsprüfung.

Lösungen sind in dieser Referenzdatei sichtbar; im Portal erst nach Antwortabgabe bzw. nach Prüfungsende anzeigen.

## 1. Grundlagen des Testens

### ctfl-de-001 · FL-1.1.1 · K1

Welches ist ein typisches Testziel?

**Wähle 1 Antwort(en).**

- **A:** Nachweisen, dass keinerlei Fehlerzustände mehr vorhanden sind.
- **B:** Informationen über die Qualität als Grundlage für Entscheidungen liefern.
- **C:** Die Verantwortung für Qualität vollständig vom Entwicklungsteam übernehmen.
- **D:** Durch erfolgreiche Tests alle Produktrisiken ausschließen.

**Lösung:** B

**Erklärung:** Tests liefern Informationen für Entscheidungen und können Risiken senken. Sie beweisen weder Fehlerfreiheit noch beseitigen sie die gemeinsame Qualitätsverantwortung.

### ctfl-de-002 · FL-1.2.2 · K1

Wie ist Testen gegenüber Qualitätssicherung einzuordnen?

**Wähle 1 Antwort(en).**

- **A:** Testen ist produktorientiert; Qualitätssicherung konzentriert sich auf die Verbesserung der Prozesse.
- **B:** Qualitätssicherung besteht ausschließlich aus der Ausführung von Testfällen.
- **C:** Testen und Qualitätssicherung sind zwei Bezeichnungen für dieselbe Tätigkeit.
- **D:** Qualitätssicherung beginnt erst nach der Produktivsetzung.

**Lösung:** A

**Erklärung:** Testen beurteilt Arbeitsergebnisse und ist eine Form der Qualitätskontrolle. Qualitätssicherung verfolgt einen vorbeugenden, prozessorientierten Ansatz.

### ctfl-de-003 · FL-1.5.2 · K1

Welcher Vorteil gehört zum Whole-Team-Ansatz?

**Wähle 1 Antwort(en).**

- **A:** Nur die Tester müssen die Qualitätsziele kennen.
- **B:** Spezialisierte Testkompetenzen werden grundsätzlich überflüssig.
- **C:** Verschiedene Kompetenzen im Team tragen gemeinsam zur Qualität bei.
- **D:** Das Team kann auf die Zusammenarbeit mit Fachvertretern verzichten.

**Lösung:** C

**Erklärung:** Gemeinsame Qualitätsverantwortung und die Zusammenarbeit unterschiedlicher Kompetenzen sind Vorteile des Whole-Team-Ansatzes.

### ctfl-de-004 · FL-1.5.2 · K1

Welche Aussage beschreibt einen Vorteil des Whole-Team-Ansatzes?

**Wähle 1 Antwort(en).**

- **A:** Fehlerberichte werden ausschließlich an externe Tester weitergegeben.
- **B:** Tester arbeiten erst nach Abschluss aller Entwicklungsaufgaben mit.
- **C:** Jedes Teammitglied muss dieselbe Spezialisierung besitzen.
- **D:** Der Austausch zwischen Fachvertretern, Entwicklern und Testern verbessert die Zusammenarbeit.

**Lösung:** D

**Erklärung:** Der Ansatz fördert Kommunikation und Zusammenarbeit. Er verlangt keine identischen Spezialisierungen und verschiebt Testen nicht ans Projektende.

### ctfl-de-005 · FL-1.1.2 · K2

Ein Test zeigt, dass eine Bestellung doppelt gespeichert wird. Anschließend untersucht eine Entwicklerin die Ursache und korrigiert den Code. Welche Zuordnung ist richtig?

**Wähle 1 Antwort(en).**

- **A:** Sowohl das Aufdecken als auch das Beheben sind ausschließlich Debugging.
- **B:** Der Test deckt die Fehlerwirkung auf; Untersuchung und Korrektur gehören zum Debugging.
- **C:** Das Beheben ist ein Regressionstest.
- **D:** Das Aufdecken gehört nur zur Qualitätssicherung, nicht zum Testen.

**Lösung:** B

**Erklärung:** Dynamisches Testen kann eine Fehlerwirkung sichtbar machen. Debugging umfasst die Untersuchung, Lokalisierung und Behebung ihrer Ursache; anschließend folgt ein Fehlernachtest.

### ctfl-de-006 · FL-1.2.1 · K2

Warum ist das Review einer Anforderung vor der Implementierung sinnvoll?

**Wähle 1 Antwort(en).**

- **A:** Unklarheiten können früh entdeckt werden, bevor sie in Code und Testfälle übernommen werden.
- **B:** Danach sind dynamische Tests grundsätzlich unnötig.
- **C:** Es beweist, dass alle späteren Benutzerwünsche erfüllt werden.
- **D:** Es garantiert, dass der Code keine Fehlerzustände enthält.

**Lösung:** A

**Erklärung:** Frühes Testen von Anforderungen kann Folgearbeit und Kosten senken. Es ersetzt weder dynamisches Testen noch garantiert es ein fehlerfreies Produkt.

### ctfl-de-007 · FL-1.2.3 · K2

Eine übermüdete Entwicklerin verwechselt beim Programmieren > mit >=. Später wird ein berechtigter Antrag abgelehnt. Was ist hier der Fehlerzustand?

**Wähle 1 Antwort(en).**

- **A:** Die Übermüdung.
- **B:** Das Verwechseln der Operatoren als menschliche Handlung.
- **C:** Der falsche Vergleichsoperator im Programmcode.
- **D:** Die beobachtete Ablehnung des berechtigten Antrags.

**Lösung:** C

**Erklärung:** Der falsche Operator im Code ist der Fehlerzustand. Die Verwechslung ist die Fehlhandlung, die Ablehnung die Fehlerwirkung; Übermüdung kann eine zugrunde liegende Ursache sein.

### ctfl-de-008 · FL-1.3.1 · K2

Ein Modul enthält einen großen Anteil der bisher gefundenen Fehlerzustände. Welcher Testgrundsatz hilft bei der weiteren Planung?

**Wähle 1 Antwort(en).**

- **A:** Vollständiges Testen ist möglich.
- **B:** Tests nutzen sich niemals ab.
- **C:** Erfolgreiche Tests beweisen Fehlerfreiheit.
- **D:** Fehlerzustände treten häufig gehäuft auf.

**Lösung:** D

**Erklärung:** Fehlerhäufung bedeutet, dass ein kleiner Teil der Komponenten oft viele Fehlerzustände enthält. Diese Erkenntnis kann risikobasierte Schwerpunkte unterstützen.

### ctfl-de-009 · FL-1.3.1 · K2

Eine Testsuite wird monatelang unverändert wiederholt und findet kaum neue Fehler. Welche Reaktion passt zum Grundsatz, dass Tests sich abnutzen?

**Wähle 1 Antwort(en).**

- **A:** Die Testfälle, Testdaten und Schwerpunkte regelmäßig überprüfen und ergänzen.
- **B:** Die Tests vollständig abschalten, weil sie ihren Zweck verloren haben.
- **C:** Die erfolgreichen Tests als Nachweis vollständiger Fehlerfreiheit verwenden.
- **D:** Nur die Reihenfolge derselben Eingabedaten ändern und jede weitere Analyse vermeiden.

**Lösung:** A

**Erklärung:** Wiederholte identische Tests können neue Fehlerzustände übersehen. Aktualisierte Tests und neue Daten können zusätzliche Fehler aufdecken; bestehende Regressionstests bleiben dennoch nützlich.

### ctfl-de-010 · FL-1.4.1 · K2

Eine Testerin untersucht Anforderungen und identifiziert, welche Bedingungen geprüft werden müssen. Welche Aktivität führt sie hauptsächlich aus?

**Wähle 1 Antwort(en).**

- **A:** Testdurchführung.
- **B:** Testabschluss.
- **C:** Testanalyse.
- **D:** Testrealisierung.

**Lösung:** C

**Erklärung:** Testanalyse beantwortet, was zu testen ist, indem die Testbasis untersucht und Testbedingungen identifiziert werden. Testentwurf konkretisiert anschließend das Wie.

### ctfl-de-011 · FL-1.4.2 · K2

Ein Team testet ein sicherheitskritisches Steuergerät und ein anderes eine interne Informationsseite. Warum können ihre Testprozesse unterschiedlich sein?

**Wähle 1 Antwort(en).**

- **A:** Für interne Seiten darf kein Testprozess existieren.
- **B:** Risiken, Domäne und regulatorische Anforderungen beeinflussen den Testprozess.
- **C:** Der Testprozess hängt ausschließlich von der bevorzugten Programmiersprache ab.
- **D:** Ein normgerechter Testprozess ist für alle Produkte in jedem Detail identisch.

**Lösung:** B

**Erklärung:** Der Kontext beeinflusst Testansatz, Formalität, Werkzeuge und Dokumentation. Unterschiedliche Risiken und Vorgaben rechtfertigen unterschiedliche Vorgehensweisen.

### ctfl-de-012 · FL-1.4.3 · K2

Welches Arbeitsergebnis passt am besten zum Testentwurf?

**Wähle 1 Antwort(en).**

- **A:** Ein Testabschlussbericht über archivierte Ergebnisse.
- **B:** Ein Protokoll mit den tatsächlichen Ergebnissen eines ausgeführten Tests.
- **C:** Ein korrigierter Quellcode nach dem Debugging.
- **D:** Testfälle mit Eingaben und erwarteten Ergebnissen.

**Lösung:** D

**Erklärung:** Beim Testentwurf werden Testbedingungen in Testfälle und weitere Testmittel konkretisiert. Tatsächliche Ergebnisse entstehen bei der Durchführung.

### ctfl-de-013 · FL-1.4.4 · K2

Eine Anforderung wird geändert. Welchen unmittelbaren Nutzen bietet die Verknüpfung von Anforderungen und Testfällen?

**Wähle 1 Antwort(en).**

- **A:** Betroffene Testfälle lassen sich für die Änderungsanalyse identifizieren.
- **B:** Die Änderung muss dadurch nicht mehr getestet werden.
- **C:** Alle Testfälle erhalten automatisch neue erwartete Ergebnisse.
- **D:** Die Verknüpfung ersetzt die fachliche Bewertung der Änderung.

**Lösung:** A

**Erklärung:** Verfolgbarkeit unterstützt die Auswirkungsanalyse sowie Überdeckungs- und Statusaussagen. Sie aktualisiert Testfälle nicht automatisch und ersetzt keine Bewertung.

### ctfl-de-014 · FL-1.4.5 · K2

Welche Aufgabe gehört hauptsächlich zur Testmanagementrolle?

**Wähle 1 Antwort(en).**

- **A:** Einen einzelnen Testfall mit konkreten Testdaten ausführen.
- **B:** Ein fehlerhaftes SQL-Statement korrigieren.
- **C:** Testaktivitäten planen, überwachen und steuern.
- **D:** Eine Äquivalenzklasse für ein Eingabefeld ableiten.

**Lösung:** C

**Erklärung:** Die Testmanagementrolle verantwortet insbesondere Planung, Überwachung, Steuerung und Abschluss. Analyse, Entwurf und Durchführung gehören vor allem zur Testrolle.

### ctfl-de-015 · FL-1.5.1 · K2

Eine Testerin bespricht einen reproduzierbaren Fehler mit einer Entwicklerin. Welche Formulierung unterstützt eine sachliche Zusammenarbeit am besten?

**Wähle 1 Antwort(en).**

- **A:** Du hast den Login offensichtlich falsch programmiert.
- **B:** Mit diesen Schritten und Testdaten tritt die Abweichung auf; lass uns das erwartete Verhalten abgleichen.
- **C:** Ich veröffentliche zuerst eine Bewertung deiner Fähigkeiten.
- **D:** Da der Test fehlgeschlagen ist, ist eine Ursachenanalyse unnötig.

**Lösung:** B

**Erklärung:** Sachliche, nachvollziehbare Kommunikation richtet den Fokus auf das Produkt und die Beobachtung. Persönliche Schuldzuweisungen erschweren die Zusammenarbeit.

### ctfl-de-016 · FL-1.5.3 · K2

Was ist ein möglicher Nachteil eines vollständig getrennten, unabhängigen Testteams?

**Wähle 1 Antwort(en).**

- **A:** Es kann grundsätzlich keine anderen Fehler als Entwickler finden.
- **B:** Unabhängiges Testen verhindert jede objektive Bewertung.
- **C:** Unabhängige Tester benötigen keine Produktkenntnis.
- **D:** Abstimmung und Zusammenarbeit können schwieriger werden.

**Lösung:** D

**Erklärung:** Unabhängigkeit kann andere Sichtweisen ermöglichen, aber auch Isolation, Kommunikationsprobleme und ein Gegeneinander begünstigen.

### ctfl-de-017 · FL-1.3.1 · K2

Alle spezifizierten Tests bestehen. Nutzer lehnen das Produkt trotzdem ab, weil es ihre eigentlichen Aufgaben nicht unterstützt. Welcher Grundsatz passt am besten?

**Wähle 1 Antwort(en).**

- **A:** Irrtum der Fehlerfreiheit: Ein technisch korrektes Produkt kann dennoch unbrauchbar sein.
- **B:** Vollständiges Testen ist immer wirtschaftlich.
- **C:** Fehlerhäufung bedeutet, dass alle Fehler im selben Modul liegen.
- **D:** Ein fehlerfreier Testlauf ersetzt die Validierung.

**Lösung:** A

**Erklärung:** Das bloße Finden und Beheben von Fehlerzuständen hilft nicht ausreichend, wenn das Produkt den tatsächlichen Bedürfnissen nicht gerecht wird.

### ctfl-de-018 · FL-1.4.1 · K2

Welche ZWEI Tätigkeiten gehören zur Testrealisierung?

**Wähle 2 Antwort(en).**

- **A:** Testdaten und Testumgebung für die Durchführung vorbereiten.
- **B:** Die Geschäftsziele des gesamten Unternehmens festlegen.
- **C:** Testabläufe und ausführbare Testskripte erstellen.
- **D:** Nach Projektende ausschließlich die Erfahrungen zusammenfassen.

**Lösung:** A, C

**Erklärung:** Testrealisierung schafft die Voraussetzungen für die Durchführung, etwa durch Testabläufe, Skripte, Daten und Umgebung. Die abschließende Erfahrungsauswertung gehört zum Testabschluss.

## 2. Testen während des Softwareentwicklungslebenszyklus

### ctfl-de-019 · FL-2.1.2 · K1

Welche gute Testpraktik gilt unabhängig vom verwendeten Entwicklungslebenszyklus?

**Wähle 1 Antwort(en).**

- **A:** Tester beginnen erst nach dem vollständigen Systembau.
- **B:** Testanalyse und Testentwurf für eine Teststufe beginnen möglichst früh während der zugehörigen Entwicklungsaktivität.
- **C:** Reviews sind auf sequenzielle Modelle beschränkt.
- **D:** Jede Teststufe muss dieselben Testziele besitzen.

**Lösung:** B

**Erklärung:** Früher Beginn und die Zuordnung von Test- zu Entwicklungsaktivitäten sind modellübergreifende Praktiken. Teststufen haben jeweils eigene Ziele.

### ctfl-de-020 · FL-2.1.3 · K1

Welcher Ansatz verwendet typischerweise den Zyklus: zunächst einen fehlgeschlagenen Komponententest schreiben, dann Code ergänzen, dann refaktorieren?

**Wähle 1 Antwort(en).**

- **A:** Wartungstest.
- **B:** Explorativer Test.
- **C:** Testgetriebene Entwicklung (TDD).
- **D:** Reine Testautomatisierung nach Projektabschluss.

**Lösung:** C

**Erklärung:** TDD steuert die Implementierung mit zunächst fehlschlagenden Tests und dem anschließenden Refactoring. Das bloße Automatisieren vorhandener Tests ist kein TDD.

### ctfl-de-021 · FL-2.1.2 · K1

Welche Aussage ist eine modellübergreifend gute Testpraktik?

**Wähle 1 Antwort(en).**

- **A:** Teststufen können jeweils unterschiedliche, passende Testziele haben.
- **B:** Nicht-funktionale Tests sind ausschließlich nach der Abnahme erlaubt.
- **C:** Tester dürfen Anforderungen nicht vor der Programmierung prüfen.
- **D:** Testen ist nur bei einem eigenen Testteam erforderlich.

**Lösung:** A

**Erklärung:** Jede Teststufe benötigt geeignete eigene Ziele. Frühe Reviews und frühzeitige Testvorbereitung sind auch ohne separates Testteam sinnvoll.

### ctfl-de-022 · FL-2.1.3 · K1

Welcher Ansatz beschreibt gewünschtes Verhalten häufig durch Beispiele in einer für Fachvertreter verständlichen Sprache wie Given/When/Then?

**Wähle 1 Antwort(en).**

- **A:** Anweisungsüberdeckungsanalyse.
- **B:** Reines Debugging.
- **C:** Lasttest.
- **D:** Verhaltensgetriebene Entwicklung (BDD).

**Lösung:** D

**Erklärung:** BDD beschreibt Verhalten anhand verständlicher Beispiele, häufig mit Given/When/Then. Es soll ein gemeinsames Verständnis zwischen Beteiligten unterstützen.

### ctfl-de-023 · FL-2.2.1 · K2

Ein Test prüft das Zusammenspiel zwischen dem Portal und einem externen Identitätsdienst. Welche Teststufe passt am besten?

**Wähle 1 Antwort(en).**

- **A:** Komponententest.
- **B:** Systemintegrationstest.
- **C:** Statischer Test.
- **D:** Ein isolierter Algorithmustest ohne Schnittstelle.

**Lösung:** B

**Erklärung:** Systemintegrationstests untersuchen Schnittstellen zwischen dem getesteten System und anderen Systemen bzw. externen Diensten.

### ctfl-de-024 · FL-2.2.2 · K2

Ein Team misst, wie schnell eine Suche bei 500 gleichzeitig aktiven Nutzern antwortet. Welche Testart steht im Mittelpunkt?

**Wähle 1 Antwort(en).**

- **A:** Funktionaler Test der Suchbegriffe.
- **B:** Review der Suchanforderung.
- **C:** Nicht-funktionaler Performanztest.
- **D:** Fehlernachtest jeder zuvor gemeldeten Abweichung.

**Lösung:** C

**Erklärung:** Antwortzeit und Verhalten unter Last sind nicht-funktionale Qualitätsmerkmale. Ein funktionaler Test betrachtet primär, was die Suche fachlich leistet.

### ctfl-de-025 · FL-2.2.3 · K2

Nach einer Login-Korrektur wird zuerst der ursprünglich fehlgeschlagene Fall wiederholt und danach die Profilbearbeitung geprüft. Welche Zuordnung passt?

**Wähle 1 Antwort(en).**

- **A:** Zuerst Fehlernachtest, danach Regressionstest auf mögliche Nebenwirkungen.
- **B:** Zuerst Regressionstest, danach ausschließlich Debugging.
- **C:** Beide Tätigkeiten sind statische Tests.
- **D:** Der erste Test ersetzt alle weiteren Tests der Anwendung.

**Lösung:** A

**Erklärung:** Der Fehlernachtest prüft die Wirksamkeit einer Korrektur. Regressionstests suchen nach unerwünschten Auswirkungen von Änderungen auf andere oder bisher funktionierende Bereiche.

### ctfl-de-026 · FL-2.3.1 · K2

Eine produktive Anwendung wird auf eine neue Datenbankversion migriert. Warum sind Wartungstests angebracht?

**Wähle 1 Antwort(en).**

- **A:** Nur Änderungen am Quellcode können Tests auslösen.
- **B:** Eine Datenbankmigration macht Tests grundsätzlich überflüssig.
- **C:** Wartungstests prüfen ausschließlich neue Benutzerkonten.
- **D:** Eine Änderung der Betriebsumgebung kann bestehendes Verhalten beeinflussen.

**Lösung:** D

**Erklärung:** Migrationen und Änderungen der Betriebsumgebung sind typische Auslöser für Wartungstests. Eine Auswirkungsanalyse unterstützt die Festlegung des Umfangs.

### ctfl-de-027 · FL-2.1.1 · K2

Ein Team liefert alle zwei Wochen ein neues Inkrement. Welche Konsequenz für das Testen ist am passendsten?

**Wähle 1 Antwort(en).**

- **A:** Regressionstests erst nach der letzten Iteration durchführen.
- **B:** Testen in jede Iteration integrieren und geeignete Regressionstests wiederholt ausführen.
- **C:** Testplanung durch den kurzen Rhythmus vollständig abschaffen.
- **D:** Statische Tests sind wegen der Iterationen nicht möglich.

**Lösung:** B

**Erklärung:** Iterative Entwicklung verlangt zeitnahes Testen neuer und geänderter Funktionen sowie wiederholte Regressionstests. Der Testprozess wird an den kurzen Rhythmus angepasst.

### ctfl-de-028 · FL-2.1.4 · K2

Eine CI/CD-Pipeline führt bei Änderungen automatisierte Tests aus. Welche Aussage über DevOps ist richtig?

**Wähle 1 Antwort(en).**

- **A:** Die Pipeline ersetzt alle manuellen und explorativen Tests.
- **B:** Bei grüner Pipeline sind keine Qualitätsrisiken mehr vorhanden.
- **C:** Schnelles Feedback wird unterstützt; ergänzende Testaktivitäten bleiben erforderlich.
- **D:** DevOps trennt Entwicklung und Betrieb grundsätzlich stärker voneinander.

**Lösung:** C

**Erklärung:** DevOps und Automatisierung unterstützen häufiges Feedback und Zusammenarbeit. Automatisierung allein deckt nicht alle Qualitätsaspekte und Testbedürfnisse ab.

### ctfl-de-029 · FL-2.1.5 · K2

Welche Maßnahme ist ein Beispiel für Shift-Left?

**Wähle 1 Antwort(en).**

- **A:** Akzeptanzkriterien vor der Implementierung gemeinsam prüfen.
- **B:** Alle Testaktivitäten auf den Tag nach der Produktivsetzung verschieben.
- **C:** Nur die Reihenfolge der Bildschirmfelder ändern.
- **D:** Späte Systemtests dauerhaft durch das Vertrauen in Entwickler ersetzen.

**Lösung:** A

**Erklärung:** Shift-Left verlagert geeignete Testaktivitäten im Lebenszyklus nach vorn. Es bedeutet nicht, dass spätere Teststufen oder Tests im Betrieb entfallen.

### ctfl-de-030 · FL-2.1.6 · K2

In einer Retrospektive wird erkannt, dass Testdaten regelmäßig zu spät vorliegen. Was ist die sinnvollste Folgemaßnahme?

**Wähle 1 Antwort(en).**

- **A:** Nur die verantwortlichen Personen benennen.
- **B:** Das Problem erst beim nächsten Release erneut besprechen.
- **C:** Die Retrospektive als Ersatz für Testplanung verwenden.
- **D:** Eine konkrete Verbesserung mit Verantwortung und Überprüfung der Wirkung vereinbaren.

**Lösung:** D

**Erklärung:** Retrospektiven unterstützen kontinuierliche Verbesserung, wenn Erkenntnisse in umsetzbare Maßnahmen übergehen und deren Wirkung überprüft wird.

## 3. Statischer Test

### ctfl-de-031 · FL-3.1.1 · K1

Welches Arbeitsergebnis kann durch einen statischen Test geprüft werden?

**Wähle 1 Antwort(en).**

- **A:** Nur das gerade ausgeführte Binärprogramm.
- **B:** Eine Anforderungsspezifikation.
- **C:** Ausschließlich eine laufende Netzwerkverbindung.
- **D:** Nur der tatsächliche Speicherverbrauch unter Last.

**Lösung:** B

**Erklärung:** Statische Tests prüfen Arbeitsergebnisse ohne Ausführung des Testobjekts, etwa Anforderungen, Entwürfe, Testfälle oder Quellcode.

### ctfl-de-032 · FL-3.2.1 · K1

Welcher Vorteil gehört zu frühzeitigem und häufigem Stakeholder-Feedback?

**Wähle 1 Antwort(en).**

- **A:** Es garantiert unveränderliche Anforderungen.
- **B:** Es ersetzt alle Tests durch Fachvertreter.
- **C:** Missverständnisse über Anforderungen können früher erkannt werden.
- **D:** Es verhindert jede spätere Prioritätsänderung.

**Lösung:** C

**Erklärung:** Frühes Feedback kann Missverständnisse und ungeeignete Lösungen rechtzeitig sichtbar machen. Es garantiert keine unveränderlichen Anforderungen.

### ctfl-de-033 · FL-3.2.3 · K1

Welche Verantwortung hat ein Moderator bzw. Reviewleiter typischerweise in einem Review?

**Wähle 1 Antwort(en).**

- **A:** Für einen effektiven Ablauf der Reviewbesprechung sorgen.
- **B:** Alle gemeldeten Fehlerzustände allein im Code beheben.
- **C:** Unabhängig von den Beteiligten sämtliche fachlichen Anforderungen bestimmen.
- **D:** Die Rolle jedes Reviewers durch eigene Feststellungen ersetzen.

**Lösung:** A

**Erklärung:** Der Moderator unterstützt die wirksame Durchführung der Reviewbesprechung. Die Behebung von Befunden liegt typischerweise beim Autor des Arbeitsergebnisses.

### ctfl-de-034 · FL-3.2.5 · K1

Welcher Faktor unterstützt den Erfolg eines Reviews?

**Wähle 1 Antwort(en).**

- **A:** Befunde als persönliche Leistungsbewertung einzelner Autoren verwenden.
- **B:** Auf individuelle Vorbereitung grundsätzlich verzichten.
- **C:** Möglichst viele Themen ohne festgelegtes Ziel behandeln.
- **D:** Klare Ziele, geeignete Beteiligte und ausreichende Vorbereitungszeit.

**Lösung:** D

**Erklärung:** Ein wirksames Review benötigt passende Ziele, Beteiligte, Vorbereitung und eine vertrauensvolle Atmosphäre. Persönliche Bewertungen können die Offenheit beeinträchtigen.

### ctfl-de-035 · FL-3.1.2 · K2

Warum kann ein Review von Anforderungen wirtschaftlich wertvoll sein?

**Wähle 1 Antwort(en).**

- **A:** Es lässt sämtliche Fehlerwirkungen im Produktivbetrieb verschwinden.
- **B:** Es kann Fehlerzustände vor ihrer Umsetzung in weitere Arbeitsergebnisse aufdecken.
- **C:** Es benötigt keine Fachkenntnisse und keinen Aufwand.
- **D:** Es beweist, dass die spätere Implementierung korrekt sein wird.

**Lösung:** B

**Erklärung:** Früh gefundene Fehlerzustände können vor ihrer Weitergabe an Entwurf, Code und Tests korrigiert werden. Dadurch kann Folgeaufwand sinken.

### ctfl-de-036 · FL-3.1.3 · K2

Ein Reviewer findet zwei widersprüchliche Angaben in einer Spezifikation. Ein ausgeführter Test zeigt einen falschen Gesamtpreis. Was unterscheidet diese Beobachtungen?

**Wähle 1 Antwort(en).**

- **A:** Beide Beobachtungen erfordern zwingend Programmausführung.
- **B:** Der falsche Gesamtpreis ist ausschließlich ein statischer Befund.
- **C:** Das Review findet direkt einen Fehlerzustand; der dynamische Test zeigt eine Fehlerwirkung.
- **D:** Widersprüche in Anforderungen sind keine möglichen Testbefunde.

**Lösung:** C

**Erklärung:** Statischer Test kann Fehlerzustände direkt in Arbeitsergebnissen finden. Dynamischer Test führt das Testobjekt aus und kann dadurch Fehlerwirkungen sichtbar machen.

### ctfl-de-037 · FL-3.2.2 · K2

Welche Reihenfolge entspricht dem generischen Reviewprozess?

**Wähle 1 Antwort(en).**

- **A:** Planung → Reviewbeginn → individuelles Review → Kommunikation und Analyse → Behebung und Berichterstattung.
- **B:** Behebung → Planung → individuelles Review → Reviewbeginn → Kommunikation.
- **C:** Testdurchführung → Debugging → Produktivsetzung → Reviewplanung.
- **D:** Kommunikation → Produktivsetzung → Planung → Testentwurf.

**Lösung:** A

**Erklärung:** Das Review wird geplant und gestartet, danach bereiten Reviewer ihre Befunde individuell vor. Befunde werden analysiert und anschließend bearbeitet und berichtet.

### ctfl-de-038 · FL-3.2.4 · K2

Welche Aussage unterscheidet einen Walkthrough am besten von einer Inspektion?

**Wähle 1 Antwort(en).**

- **A:** Eine Inspektion ist immer informell und ohne definierte Rollen.
- **B:** Ein Walkthrough muss zwingend vom Management geleitet werden.
- **C:** Bei einer Inspektion sind individuelle Vorbereitung und Prozessvorgaben verboten.
- **D:** Ein Walkthrough wird typischerweise vom Autor geführt; eine Inspektion folgt einem besonders formalen Vorgehen.

**Lösung:** D

**Erklärung:** Walkthroughs werden vom Autor geführt und können dem gemeinsamen Verständnis dienen. Inspektionen sind die formalste Reviewart mit festgelegtem Prozess und definierten Rollen.

## 4. Testanalyse und -entwurf

### ctfl-de-039 · FL-4.1.1 · K2

Ein Team leitet Tests aus Geschäftsregeln ab, ein anderes aus dem Kontrollfluss des Codes. Welche Zuordnung passt?

**Wähle 1 Antwort(en).**

- **A:** Geschäftsregeln: White-Box; Kontrollfluss: Black-Box.
- **B:** Geschäftsregeln: Black-Box; Kontrollfluss: White-Box.
- **C:** Beides sind ausschließlich erfahrungsbasierte Tests.
- **D:** Beides sind ausschließlich statische Tests.

**Lösung:** B

**Erklärung:** Black-Box-Verfahren orientieren sich am spezifizierten Verhalten; White-Box-Verfahren an interner Struktur und Verarbeitung.

### ctfl-de-040 · FL-4.1.1 · K2

Eine Testerin wählt Tests aufgrund typischer Fehler aus früheren Projekten. Welche Verfahrensfamilie passt am besten?

**Wähle 1 Antwort(en).**

- **A:** White-Box-Verfahren mit zwingender Zweigüberdeckung.
- **B:** Ausschließlich formale Entscheidungstabellen.
- **C:** Erfahrungsbasierte Testverfahren.
- **D:** Ausschließlich statische Kontrollflussanalyse.

**Lösung:** C

**Erklärung:** Erfahrungsbasierte Verfahren nutzen Wissen über Produkt, Domäne und typische Fehler. Sie ergänzen spezifikations- und strukturorientierte Verfahren.

### ctfl-de-041 · FL-4.2.1 · K3

Ein Feld akzeptiert ganze Zahlen von 10 bis 50 einschließlich. Definiert sind drei Klassen: kleiner 10, 10 bis 50, größer 50. Welche minimale Menge deckt alle Klassen ab?

**Wähle 1 Antwort(en).**

- **A:** 9, 30, 51.
- **B:** 10, 30, 50.
- **C:** 9, 10, 30.
- **D:** 30, 50, 51.

**Lösung:** A

**Erklärung:** 9 vertritt die untere ungültige Klasse, 30 die gültige und 51 die obere ungültige Klasse. Jede der drei Klassen wird genau einmal abgedeckt.

### ctfl-de-042 · FL-4.2.1 · K3

Die Versandkosten betragen bei ganzzahligen Warenwerten unter 40 Euro 5 Euro, von 40 bis 99 Euro 2 Euro und ab 100 Euro 0 Euro. Eingaben sind nichtnegative ganze Zahlen. Welche Menge deckt die drei gültigen Äquivalenzklassen minimal ab?

**Wähle 1 Antwort(en).**

- **A:** 0, 20, 39.
- **B:** 40, 60, 99.
- **C:** 39, 40, 60.
- **D:** 20, 70, 120.

**Lösung:** D

**Erklärung:** 20 liegt unter 40, 70 zwischen 40 und 99 und 120 ab 100. Die anderen Mengen lassen mindestens eine der vorgegebenen Klassen aus.

### ctfl-de-043 · FL-4.2.2 · K3

Ein Feld akzeptiert ganze Zahlen von 20 bis 80 einschließlich. Welche Menge erreicht 100 % 2-Wert-Grenzwertüberdeckung an beiden Grenzen?

**Wähle 1 Antwort(en).**

- **A:** 20, 21, 79, 80.
- **B:** 19, 20, 80, 81.
- **C:** 19, 21, 79, 81.
- **D:** 20, 50, 80.

**Lösung:** B

**Erklärung:** Für die beiden Klassengrenzen werden die direkt benachbarten Werte auf beiden Seiten benötigt: 19/20 und 80/81.

### ctfl-de-044 · FL-4.2.2 · K3

Für ein ganzzahliges Feld ist 30 die untere gültige Grenze. Betrachtet wird nur diese Grenze. Welche Menge deckt die 3-Wert-Grenzwertanalyse an dieser Grenze einschließlich des angrenzenden ungültigen Grenzwerts vollständig ab?

**Wähle 1 Antwort(en).**

- **A:** 29, 30.
- **B:** 29, 30, 31.
- **C:** 28, 29, 30, 31.
- **D:** 28, 30, 32.

**Lösung:** C

**Erklärung:** Die angrenzenden Klassen haben die Grenzwerte 29 und 30. Für 3-Wert-Grenzwertanalyse werden jeweils Grenzwert und beide Nachbarn benötigt: {28,29,30} und {29,30,31}, insgesamt vier verschiedene Werte.

### ctfl-de-045 · FL-4.2.3 · K3

Zwei boolesche Bedingungen sind Mitgliedschaft (J/N) und Gutschein (J/N). Alle vier Kombinationen sind ausführbar. Bisher wurden (J,J), (J,N) und (N,J) geprüft. Welche Kombination fehlt für vollständige Regelüberdeckung der unminimierten Tabelle?

**Wähle 1 Antwort(en).**

- **A:** (N,N).
- **B:** (J,J).
- **C:** (J,N).
- **D:** Keine, drei Tests decken immer zwei boolesche Bedingungen ab.

**Lösung:** A

**Erklärung:** Zwei unabhängige boolesche Bedingungen ergeben vier Kombinationen. Die einzige noch nicht ausgeführte Regel ist (N,N).

### ctfl-de-046 · FL-4.2.3 · K3

Ein Rabatt wird gewährt, wenn M=J UND (G=J ODER W=J). M bedeutet Mitglied, G gültiger Gutschein, W Warenwert erreicht. Welche Kombination muss einen Rabatt auslösen?

**Wähle 1 Antwort(en).**

- **A:** M=N, G=J, W=J.
- **B:** M=J, G=N, W=N.
- **C:** M=N, G=N, W=J.
- **D:** M=J, G=N, W=J.

**Lösung:** D

**Erklärung:** In der letzten Kombination ist M wahr und mindestens eine der Bedingungen G oder W wahr. Die übrigen Kombinationen verletzen mindestens einen Teil der Regel.

### ctfl-de-047 · FL-4.2.4 · K3

Ein Konto hat die Zustände Aktiv und Gesperrt. Übergänge: Aktiv --Fehlversuch--> Aktiv, Aktiv --Sperren--> Gesperrt, Gesperrt --Entsperren--> Aktiv. Start ist Aktiv. Welche Ereignisfolge deckt alle drei gültigen Übergänge ab?

**Wähle 1 Antwort(en).**

- **A:** Sperren, Entsperren.
- **B:** Fehlversuch, Sperren, Entsperren.
- **C:** Fehlversuch, Fehlversuch.
- **D:** Entsperren, Sperren.

**Lösung:** B

**Erklärung:** Die Folge durchläuft erst die Schleife in Aktiv, dann den Übergang nach Gesperrt und schließlich zurück nach Aktiv. Zwei Ereignisse können die drei Übergänge hier nicht vollständig abdecken.

### ctfl-de-048 · FL-4.2.4 · K3

Ein Ticket hat die Zustände Offen, In Arbeit und Erledigt. Gültige Übergänge sind Offen --Start--> In Arbeit, In Arbeit --Abschluss--> Erledigt und Erledigt --Wiederöffnen--> Offen. Welche Folge ab Offen erreicht vollständige Überdeckung der gültigen Übergänge?

**Wähle 1 Antwort(en).**

- **A:** Start, Abschluss.
- **B:** Start, Wiederöffnen, Abschluss.
- **C:** Start, Abschluss, Wiederöffnen.
- **D:** Abschluss, Wiederöffnen, Start.

**Lösung:** C

**Erklärung:** Nur Start → Abschluss → Wiederöffnen ist ab Offen durchgehend gültig und nutzt jeden der drei angegebenen Übergänge.

### ctfl-de-049 · FL-4.3.1 · K2

Eine Testsuite führt 36 von 45 ausführbaren Anweisungen aus. Wie hoch ist die Anweisungsüberdeckung?

**Wähle 1 Antwort(en).**

- **A:** 80 %.
- **B:** 75 %.
- **C:** 90 %.
- **D:** 125 %.

**Lösung:** A

**Erklärung:** Anweisungsüberdeckung = ausgeführte Anweisungen / alle ausführbaren Anweisungen × 100 = 36/45 × 100 = 80 %.

### ctfl-de-050 · FL-4.3.2 · K2

Ein Programm enthält genau eine if-Entscheidung mit einem then-Zweig und einem leeren else-Zweig. Ein Test führt nur den then-Zweig aus. Welche Aussage ist richtig?

**Wähle 1 Antwort(en).**

- **A:** Der leere else-Zweig kann bei Zweigüberdeckung ignoriert werden.
- **B:** Eine ausgeführte then-Anweisung beweist vollständige Zweigüberdeckung.
- **C:** Zweigüberdeckung ist ohne zwei nichtleere Blöcke nicht definiert.
- **D:** Der False-Ausgang der Entscheidung muss ebenfalls ausgeführt werden.

**Lösung:** D

**Erklärung:** Auch ein Entscheidungszweig ohne ausführbare Anweisung zählt als Zweig. Der True- und der False-Ausgang müssen für vollständige Zweigüberdeckung durchlaufen werden.

### ctfl-de-051 · FL-4.3.3 · K2

Welche Aussage beschreibt eine Grenze des White-Box-Tests?

**Wähle 1 Antwort(en).**

- **A:** Er kann interne Verarbeitung grundsätzlich nicht untersuchen.
- **B:** Auch vollständige strukturelle Überdeckung beweist nicht, dass alle benötigten Funktionen implementiert sind.
- **C:** Er macht Black-Box-Verfahren immer überflüssig.
- **D:** Er kann ausschließlich anhand von Benutzeroberflächen erfolgen.

**Lösung:** B

**Erklärung:** White-Box-Verfahren bewerten vorhandene Struktur. Fehlende Anforderungen oder komplett ausgelassene Funktionen können trotz hoher struktureller Überdeckung unentdeckt bleiben.

### ctfl-de-052 · FL-4.3.2 · K2

Für dasselbe Testobjekt und dasselbe Kontrollflussmodell wird 100 % Zweigüberdeckung erreicht. Welche Aussage trifft zu?

**Wähle 1 Antwort(en).**

- **A:** Damit ist jeder mögliche Ausführungspfad getestet.
- **B:** Damit ist die fachliche Fehlerfreiheit bewiesen.
- **C:** Damit wird auch 100 % Anweisungsüberdeckung erreicht.
- **D:** Damit sind alle Kombinationen atomarer Bedingungen getestet.

**Lösung:** C

**Erklärung:** Zweigüberdeckung schließt Anweisungsüberdeckung ein. Sie garantiert weder vollständige Pfad- oder Bedingungskombinationsüberdeckung noch Fehlerfreiheit.

### ctfl-de-053 · FL-4.4.1 · K2

Eine Testerin probiert bei einem neuen Datumsfeld den 31. April, weil ähnliche Felder früher ungültige Kalendertage akzeptierten. Welches Verfahren steht im Mittelpunkt?

**Wähle 1 Antwort(en).**

- **A:** Intuitive Testfallermittlung anhand typischer Fehler.
- **B:** Zweigtest anhand eines Kontrollflussgraphen.
- **C:** Ausschließlich formale Entscheidungstabellenüberdeckung.
- **D:** Messung der Anweisungsüberdeckung.

**Lösung:** A

**Erklärung:** Die Auswahl beruht auf Wissen über frühere oder typische Fehler. Das ist intuitive Testfallermittlung, auch wenn der Test zusätzlich mit anderen Verfahren ableitbar wäre.

### ctfl-de-054 · FL-4.4.2 · K2

Welche Beschreibung passt zum explorativen Test?

**Wähle 1 Antwort(en).**

- **A:** Alle Tests werden einmalig vorab vollständig spezifiziert und unverändert abgearbeitet.
- **B:** Es werden beliebige Klicks ohne Lernziel und Beobachtung durchgeführt.
- **C:** Nur automatisierte Regressionstests werden ausgeführt.
- **D:** Lernen über das Produkt, Testentwurf und Testdurchführung beeinflussen sich gegenseitig während der Arbeit.

**Lösung:** D

**Erklärung:** Exploratives Testen verbindet Lernen, Entwurf und Durchführung. Eine Test-Charta und Zeitbegrenzung können Struktur und Nachvollziehbarkeit unterstützen.

### ctfl-de-055 · FL-4.4.3 · K2

Ein Team prüft jede neue Formularseite anhand einer Liste mit Punkten zu Pflichtfeldern, Fehlermeldungen und Tastaturbedienung. Welche Aussage passt?

**Wähle 1 Antwort(en).**

- **A:** Eine Checkliste ist nur dann gültig, wenn sie alle konkreten Klicks vorgibt.
- **B:** Die Liste unterstützt checklistenbasiertes Testen und sollte aus Erfahrungen weiterentwickelt werden.
- **C:** Checklisten garantieren vollständige Anforderungsüberdeckung.
- **D:** Eine einmal erstellte Checkliste darf nicht mehr geändert werden.

**Lösung:** B

**Erklärung:** Checklisten halten wichtige Prüfgesichtspunkte fest, ohne zwingend alle Schritte vorzugeben. Ihre Qualität profitiert von Erfahrungen und Aktualisierung.

### ctfl-de-056 · FL-4.4.2 · K2

Wozu dient eine Test-Charta in einer explorativen Testsitzung am ehesten?

**Wähle 1 Antwort(en).**

- **A:** Sie legt die endgültige Fehleranzahl fest.
- **B:** Sie ersetzt das Beobachten tatsächlicher Ergebnisse.
- **C:** Sie beschreibt Ziel, Fokus und Rahmen der Untersuchung.
- **D:** Sie verlangt eine vollständig unveränderliche Folge aller Testschritte.

**Lösung:** C

**Erklärung:** Eine Charta gibt explorativen Sitzungen eine Richtung, etwa ein Testziel, betrachtete Risiken und den Umfang. Sie lässt Raum für lerngetriebene Anpassungen.

### ctfl-de-057 · FL-4.5.1 · K2

Fachvertreter, Entwickler und Tester besprechen gemeinsam eine User-Story. Welcher Nutzen steht im Vordergrund?

**Wähle 1 Antwort(en).**

- **A:** Unterschiedliche Perspektiven helfen, ein gemeinsames Verständnis und testbare Beispiele zu entwickeln.
- **B:** Akzeptanzkriterien können dadurch grundsätzlich entfallen.
- **C:** Die Tester übernehmen allein die Definition des Geschäftsnutzens.
- **D:** Die Story muss dadurch keine fachliche Anforderung mehr enthalten.

**Lösung:** A

**Erklärung:** Gemeinsames Ausarbeiten verbindet fachliche, technische und qualitätsbezogene Perspektiven und kann Mehrdeutigkeiten vor der Umsetzung reduzieren.

### ctfl-de-058 · FL-4.5.2 · K2

Welche Aussage beschreibt den Unterschied zwischen szenario- und regelorientierten Akzeptanzkriterien?

**Wähle 1 Antwort(en).**

- **A:** Szenarien sind immer untestbar, Regeln immer automatisiert.
- **B:** Regeln müssen ausschließlich Quellcode enthalten.
- **C:** Beide dürfen nur nach der Implementierung entstehen.
- **D:** Szenarien beschreiben konkrete Abläufe; Regeln formulieren Bedingungen bzw. Einschränkungen des gewünschten Verhaltens.

**Lösung:** D

**Erklärung:** Szenarioorientierte Kriterien verwenden beispielsweise Given/When/Then. Regelorientierte Kriterien können als prüfbare Liste fachlicher Regeln beschrieben werden.

### ctfl-de-059 · FL-4.5.3 · K3

Vor der Implementierung gilt das Akzeptanzkriterium: Ein angemeldeter Mitarbeiter darf eine noch nicht belegte Schulung buchen. Welche ZWEI Tests konkretisieren das beschriebene erfolgreiche Verhalten? In beiden Tests sind alle anderen Voraussetzungen erfüllt.

**Wähle 2 Antwort(en).**

- **A:** Nicht angemeldeter Benutzer bucht eine bereits belegte Schulung und erhält Erfolg.
- **B:** Angemeldeter Mitarbeiter bucht eine freie Schulung; eine Buchungsbestätigung erscheint.
- **C:** Angemeldeter Mitarbeiter bucht eine bereits belegte Schulung und erhält Erfolg.
- **D:** Angemeldeter Mitarbeiter bucht eine freie Schulung; anschließend ist seine Buchung in der Übersicht vorhanden.

**Lösung:** B, D

**Erklärung:** Die beiden gewählten Tests konkretisieren den erlaubten Buchungsfall durch beobachtbare Ergebnisse. Die anderen Optionen erwarten Erfolg trotz verletzter Voraussetzungen.

### ctfl-de-060 · FL-4.5.3 · K3

In einem ATDD-Workshop wird vereinbart: Nach drei aufeinanderfolgenden falschen Passwörtern wird das Konto gesperrt. Ein korrektes Passwort setzt den Fehlversuchszähler zurück. Welche Folge prüft gezielt das Zurücksetzen? Start: entsperrt, Zähler 0.

**Wähle 1 Antwort(en).**

- **A:** Falsch, falsch, falsch; anschließend ist das Konto gesperrt.
- **B:** Korrekt; anschließend ist der Nutzer angemeldet.
- **C:** Falsch, falsch, korrekt, abmelden, falsch; anschließend ist das Konto noch entsperrt.
- **D:** Falsch, falsch, falsch, falsch; anschließend ist das Konto gesperrt.

**Lösung:** C

**Erklärung:** Vor dem korrekten Login stehen zwei Fehlversuche an. Wird der Zähler zurückgesetzt, ist der folgende Fehlversuch erst der erste. Ohne Zurücksetzen würde er die Sperre auslösen.

### ctfl-de-061 · FL-4.2.1 · K3

Für ein einzelnes Eingabefeld wurden vier nichtleere, disjunkte Äquivalenzklassen festgelegt. Jeder Testwert gehört genau einer Klasse an. Drei Tests verwenden Werte aus derselben Klasse. Wie hoch ist die Klassenüberdeckung?

**Wähle 1 Antwort(en).**

- **A:** 25 %.
- **B:** 50 %.
- **C:** 75 %.
- **D:** 100 %.

**Lösung:** A

**Erklärung:** Die Anzahl unterschiedlicher abgedeckter Klassen zählt. Eine von vier Klassen ist abgedeckt, also 25 %, unabhängig davon, dass drei Werte dieser Klasse getestet werden.

### ctfl-de-062 · FL-4.2.2 · K3

Ein ganzzahliges Feld akzeptiert 5 bis 9 einschließlich. Welche Menge erreicht vollständige 3-Wert-Grenzwertüberdeckung an beiden Grenzen?

**Wähle 1 Antwort(en).**

- **A:** 4, 5, 9, 10.
- **B:** 4, 5, 6, 8, 9, 10.
- **C:** 3, 5, 7, 9, 11.
- **D:** 3, 4, 5, 6, 8, 9, 10, 11.

**Lösung:** D

**Erklärung:** Die Klassengrenzwerte sind 4/5 und 9/10. Mit beiden Nachbarn jedes Grenzwerts entstehen die Vereinigungen {3,4,5,6} und {8,9,10,11}.

### ctfl-de-063 · FL-4.2.3 · K3

Eine unminimierte Entscheidungstabelle hat drei unabhängige boolesche Bedingungen. Alle Kombinationen sind möglich und keine Spalte wird zusammengefasst. Wie viele Regeln müssen für 100 % Regelüberdeckung ausgeführt werden?

**Wähle 1 Antwort(en).**

- **A:** 3.
- **B:** 8.
- **C:** 6.
- **D:** 9.

**Lösung:** B

**Erklärung:** Jede der drei Bedingungen hat zwei Werte. Damit existieren 2 × 2 × 2 = 8 ausführbare Kombinationen bzw. Regeln der unminimierten Tabelle.

### ctfl-de-064 · FL-4.2.4 · K3

Ein Modell hat die gültigen Übergänge A→B, B→C und C→B. Ein Test ab A führt A→B→C aus. Wie hoch ist die Überdeckung der gültigen Übergänge?

**Wähle 1 Antwort(en).**

- **A:** 100 %, weil alle Zustände besucht wurden.
- **B:** 50 %, weil nur zwei Ereignisse ausgelöst wurden.
- **C:** 2/3, also ungefähr 66,7 %.
- **D:** 0 %, weil der Startzustand nicht erneut erreicht wird.

**Lösung:** C

**Erklärung:** Zwei von drei gültigen Übergängen sind ausgeführt. Vollständige Zustandsüberdeckung ist hier erreicht, vollständige Übergangsüberdeckung jedoch nicht.

## 5. Management der Testaktivitäten

### ctfl-de-065 · FL-5.1.2 · K1

Welchen Beitrag kann ein Tester in der Iterationsplanung leisten?

**Wähle 1 Antwort(en).**

- **A:** Testaufwand, Testbarkeit und Qualitätsrisiken der geplanten Storys einbringen.
- **B:** Die gesamte fachliche Priorisierung ohne Product Owner festlegen.
- **C:** Jede Story pauschal ohne Prüfung als testbar bestätigen.
- **D:** Den Aufwand erst nach Ende der Iteration schätzen.

**Lösung:** A

**Erklärung:** Tester unterstützen die Planung unter anderem durch Aufwandsschätzungen, Risikohinweise, Prüfung der Testbarkeit und die Konkretisierung von Akzeptanzkriterien.

### ctfl-de-066 · FL-5.1.6 · K1

Welche Aussage entspricht der üblichen Testpyramide?

**Wähle 1 Antwort(en).**

- **A:** Die meisten Tests sollen langsame End-to-End-Tests über die Oberfläche sein.
- **B:** Komponententests stehen an der Spitze und werden nur selten ausgeführt.
- **C:** Alle Ebenen müssen dieselbe Anzahl Tests enthalten.
- **D:** Viele kleine, schnelle Tests bilden die Basis; auf höheren Ebenen gibt es typischerweise weniger, gröbere Tests.

**Lösung:** D

**Erklärung:** Die Pyramide beschreibt unterschiedliche Granularität und eine typische Verteilung vieler schneller Tests unten und weniger umfangreicher Tests oben.

### ctfl-de-067 · FL-5.2.1 · K1

Welche ZWEI Attribute bestimmen die Risikostufe?

**Wähle 2 Antwort(en).**

- **A:** Anzahl der Teammitglieder.
- **B:** Eintrittswahrscheinlichkeit.
- **C:** Schadensausmaß.
- **D:** Länge des Testfallnamens.

**Lösung:** B, C

**Erklärung:** Die Risikostufe wird aus Eintrittswahrscheinlichkeit und Schadensausmaß bestimmt. Teamgröße und Testnamen sind keine definierenden Risikoattribute.

### ctfl-de-068 · FL-5.3.1 · K1

Welche Angabe ist eine typische Metrik des Testfortschritts?

**Wähle 1 Antwort(en).**

- **A:** Die Lieblingsprogrammiersprache der Tester.
- **B:** Die Anzahl der Bildschirmfarben.
- **C:** Die Anzahl der ausgeführten und noch offenen Testfälle.
- **D:** Der Name des zuletzt bearbeiteten Dokuments ohne Status.

**Lösung:** C

**Erklärung:** Testfortschritt lässt sich unter anderem anhand geplanter, ausgeführter, bestandener und offener Testfälle beobachten.

### ctfl-de-069 · FL-5.1.1 · K2

Welche Information gehört sinnvollerweise in ein Testkonzept?

**Wähle 1 Antwort(en).**

- **A:** Testziele, Umfang, Testansatz, Ressourcen und wesentliche Risiken.
- **B:** Nur die privaten Kontaktdaten aller Benutzer.
- **C:** Ausschließlich der vollständige Produktivdatenbestand.
- **D:** Nur die tatsächlichen Ergebnisse der letzten Testdurchführung.

**Lösung:** A

**Erklärung:** Ein Testkonzept beschreibt die geplanten Testaktivitäten und ihren Rahmen. Dazu gehören etwa Ziele, Umfang, Ansatz, Ressourcen, Zeitplan und Risiken.

### ctfl-de-070 · FL-5.1.3 · K2

Welche Zuordnung von Kriterien ist richtig?

**Wähle 1 Antwort(en).**

- **A:** Eine verfügbare Testumgebung ist ausschließlich ein Endekriterium.
- **B:** Endekriterien legen fest, wann erstmals getestet werden darf.
- **C:** Eingangs- und Endekriterien sind identische Listen ohne Bezug zu Aktivitäten.
- **D:** Eine verfügbare Testumgebung kann Eingangskriterium sein; eine erreichte Zielüberdeckung kann Endekriterium sein.

**Lösung:** D

**Erklärung:** Eingangskriterien beschreiben Voraussetzungen für den Beginn einer Aktivität. Endekriterien legen fest, was für ihren Abschluss erreicht werden soll.

### ctfl-de-071 · FL-5.1.7 · K2

Welches Beispiel passt im Testquadrantenmodell zu geschäftsorientierten Tests, die das Team unterstützen (Q2)?

**Wähle 1 Antwort(en).**

- **A:** Ein isolierter technischer Komponententest.
- **B:** Fachliche Beispiele und funktionale Akzeptanztests.
- **C:** Ein technischer Belastungstest zur Produktkritik.
- **D:** Eine Messung der CPU-Auslastung im Stresstest.

**Lösung:** B

**Erklärung:** Q2 umfasst geschäftsorientierte Tests zur Unterstützung des Teams, zum Beispiel funktionale Tests und Beispiele für Akzeptanzkriterien. Technische Unterstützung liegt in Q1, technische Produktkritik in Q4.

### ctfl-de-072 · FL-5.2.2 · K2

Welche Zuordnung ist richtig?

**Wähle 1 Antwort(en).**

- **A:** Verspätete Bereitstellung einer Testumgebung: Produktrisiko; falsche Rechnungen: Projektrisiko.
- **B:** Beides sind ausschließlich Produktrisiken.
- **C:** Verspätete Testumgebung: Projektrisiko; falsche Rechnungen: Produktrisiko.
- **D:** Beides sind ausschließlich Projektrisiken.

**Lösung:** C

**Erklärung:** Projektrisiken bedrohen die Projektdurchführung, etwa Termine und Ressourcen. Produktrisiken betreffen mögliche Qualitätsprobleme des Produkts.

### ctfl-de-073 · FL-5.2.3 · K2

Die Risikoanalyse bewertet fehlerhafte Zahlungen als besonders kritisch. Wie sollte dies den Testansatz beeinflussen?

**Wähle 1 Antwort(en).**

- **A:** Zahlungsfunktionen früher und gründlicher testen und passende Testverfahren wählen.
- **B:** Nur weniger kritische Funktionen testen, weil kritische Fehler ohnehin auffallen.
- **C:** Für alle Funktionen zwingend identischen Aufwand verwenden.
- **D:** Zahlungen ausschließlich nach Produktivsetzung prüfen.

**Lösung:** A

**Erklärung:** Die Produktrisikoanalyse beeinflusst Umfang, Gründlichkeit, Priorität und Verfahren. Höhere Risiken rechtfertigen typischerweise stärkere Testschwerpunkte.

### ctfl-de-074 · FL-5.2.4 · K2

Ein hohes Produktrisiko wurde erkannt. Welche Maßnahme kann dieses Risiko gezielt mindern?

**Wähle 1 Antwort(en).**

- **A:** Das Risiko aus dem Bericht entfernen.
- **B:** Den Verantwortlichen durch eine andere Person ersetzen, ohne die Ursache zu betrachten.
- **C:** Den betroffenen Bereich grundsätzlich aus allen Tests ausschließen.
- **D:** Zusätzliche geeignete Tests und Reviews für den betroffenen Bereich durchführen.

**Lösung:** D

**Erklärung:** Gezielte Qualitätssicherungs- und Testmaßnahmen können Wahrscheinlichkeit oder Auswirkungen von Qualitätsproblemen reduzieren. Eine bloße Änderung der Berichterstattung mindert das Risiko nicht.

### ctfl-de-075 · FL-5.3.2 · K2

Welche Information ist für einen Testabschlussbericht an die Releaseverantwortlichen besonders relevant?

**Wähle 1 Antwort(en).**

- **A:** Nur eine ungefilterte Liste aller Mausklicks.
- **B:** Erreichte Ziele, Abweichungen, verbleibende Fehler und Restrisiken.
- **C:** Ausschließlich die Arbeitszeiten einzelner Entwickler.
- **D:** Nur die Anzahl erfolgreich gestarteter Browser.

**Lösung:** B

**Erklärung:** Ein Abschlussbericht unterstützt die Bewertung des Testgegenstands durch Ergebnisse, Zielerreichung, Abweichungen und verbleibende Risiken.

### ctfl-de-076 · FL-5.3.3 · K2

Das Management benötigt eine Releaseentscheidung, das Entwicklungsteam konkrete Fehlerdetails. Wie sollte der Teststatus kommuniziert werden?

**Wähle 1 Antwort(en).**

- **A:** Für beide Zielgruppen nur denselben unkommentierten Rohdatenexport liefern.
- **B:** Ergebnisse grundsätzlich nur mündlich und ohne nachvollziehbare Grundlage mitteilen.
- **C:** Inhalt und Detailgrad an den Informationsbedarf der jeweiligen Zielgruppe anpassen.
- **D:** Dem Management ausschließlich Stacktraces ohne Auswirkung auf das Produkt zeigen.

**Lösung:** C

**Erklärung:** Wirksame Kommunikation berücksichtigt Zielgruppe und Entscheidungssituation. Management braucht oft verdichtete Qualitäts- und Risikoaussagen, Entwickler konkrete technische Befunde.

### ctfl-de-077 · FL-5.4.1 · K2

Ein Fehler lässt sich nur mit einer bestimmten Kombination von Anwendungsversion, Testdaten und Umgebung reproduzieren. Wie hilft Konfigurationsmanagement?

**Wähle 1 Antwort(en).**

- **A:** Es macht die verwendeten Versionen und Konfigurationen identifizierbar und reproduzierbar.
- **B:** Es korrigiert automatisch den fehlerhaften Code.
- **C:** Es ersetzt die Beschreibung der Reproduktionsschritte.
- **D:** Es sorgt dafür, dass Versionen nicht mehr dokumentiert werden müssen.

**Lösung:** A

**Erklärung:** Konfigurationsmanagement unterstützt die Identifikation und kontrollierte Verwaltung von Testobjekten und Testmitteln. Das verbessert Reproduzierbarkeit und Nachvollziehbarkeit.

### ctfl-de-078 · FL-5.1.4 · K3

Für eine Testaufgabe werden a=4, m=7 und b=16 Personenstunden geschätzt. Wie lautet die Drei-Punkt-Schätzung E=(a+4m+b)/6?

**Wähle 1 Antwort(en).**

- **A:** 7 Stunden.
- **B:** 9 Stunden.
- **C:** 12 Stunden.
- **D:** 8 Stunden.

**Lösung:** D

**Erklärung:** E = (4 + 4×7 + 16) / 6 = 48 / 6 = 8 Personenstunden. Der wahrscheinlichste Wert allein ist nicht das gewichtete Ergebnis.

### ctfl-de-079 · FL-5.1.4 · K3

In vergleichbaren Projekten betrug das Verhältnis Entwicklungsaufwand zu Testaufwand 5:2. Für die Entwicklung sind 250 Personentage geplant. Welcher Testaufwand ergibt sich aus dieser Verhältniszahl?

**Wähle 1 Antwort(en).**

- **A:** 50 Personentage.
- **B:** 100 Personentage.
- **C:** 125 Personentage.
- **D:** 625 Personentage.

**Lösung:** B

**Erklärung:** Bei 5:2 ist der Testaufwand 2/5 des Entwicklungsaufwands: 250 × 2/5 = 100 Personentage. Es handelt sich um eine Schätzung unter Annahme vergleichbarer Projekte.

### ctfl-de-080 · FL-5.1.5 · K3

T1 hat höchste Priorität, benötigt aber zuvor T3. T2 hat mittlere Priorität; T3 niedrige. Alle Ressourcen sind verfügbar, weitere Abhängigkeiten bestehen nicht. Welche Reihenfolge berücksichtigt Priorität und Abhängigkeit am besten?

**Wähle 1 Antwort(en).**

- **A:** T1, T2, T3.
- **B:** T2, T1, T3.
- **C:** T3, T1, T2.
- **D:** T1, T3, T2.

**Lösung:** C

**Erklärung:** Zuerst muss die Voraussetzung T3 ausgeführt werden. Danach kann T1 mit höchster Priorität folgen; anschließend T2.

### ctfl-de-081 · FL-5.1.5 · K3

Bei zusätzlicher Überdeckungspriorisierung deckt der erste Test bereits A,B,C ab. T2 deckt A,D ab, T3 D,E,F und T4 B,C. Welcher Test soll als Nächstes ausgeführt werden?

**Wähle 1 Antwort(en).**

- **A:** T3.
- **B:** T2.
- **C:** T4.
- **D:** Alle liefern dieselbe zusätzliche Überdeckung.

**Lösung:** A

**Erklärung:** T3 ergänzt D,E,F und liefert drei neue Überdeckungselemente. T2 ergänzt nur D, T4 kein neues Element.

### ctfl-de-082 · FL-5.5.1 · K3

Auf Build 2.8 lässt sich mit Rolle Mitarbeiter ein fremdes Profil speichern. Erwartet ist HTTP 403; tatsächlich folgen HTTP 200 und eine Datenänderung. Welcher Bericht ist am besten zur Bearbeitung geeignet?

**Wähle 1 Antwort(en).**

- **A:** Titel: Geht nicht. Beschreibung: Bitte dringend beheben.
- **B:** Titel: Entwicklerfehler. Beschreibung: Vermutlich falsche Datenbank, keine weiteren Angaben.
- **C:** Titel: Profilproblem. Beschreibung: Passiert manchmal, erwartetes Ergebnis unbekannt.
- **D:** Titel: Mitarbeiter kann fremdes Profil ändern. Beschreibung: Build 2.8, Rolle und Voraussetzungen, reproduzierbare Schritte, HTTP 403 erwartet, HTTP 200 und Datenänderung beobachtet, bereinigter Request als Beleg.

**Lösung:** D

**Erklärung:** Der letzte Bericht enthält eine präzise Zusammenfassung, Kontext, Reproduktionsschritte, Soll-/Ist-Ergebnis und Belege. Das unterstützt Analyse und Behebung, ohne nur Vermutungen zu liefern.

### ctfl-de-083 · FL-5.5.1 · K3

Ein Test zeigt auf Firefox bei einem neuen Benutzer einen Fehler nach Klick auf Speichern. Welcher ZUSATZ macht den Fehlerbericht am stärksten reproduzierbar?

**Wähle 1 Antwort(en).**

- **A:** Die persönliche Einschätzung, wer den Fehler programmiert hat.
- **B:** Genaue Version, Ausgangszustand, verwendete Testdaten, Schritte sowie erwartetes und tatsächliches Ergebnis.
- **C:** Nur die Aussage, dass es auf einem anderen Rechner ebenfalls schlecht aussieht.
- **D:** Eine höhere Prioritätszahl ohne weitere Beobachtungen.

**Lösung:** B

**Erklärung:** Reproduzierbarkeit erfordert nachvollziehbaren Kontext und konkrete Beobachtungen. Schuldzuweisungen oder Priorität allein liefern diese Informationen nicht.

### ctfl-de-084 · FL-5.1.4 · K3

In den letzten drei vergleichbaren Iterationen betrug der Testaufwand 18, 24 und 30 Personenstunden. Für die nächste Iteration wird ausdrücklich der einfache Durchschnitt extrapoliert. Wie hoch ist die Schätzung?

**Wähle 1 Antwort(en).**

- **A:** 18 Stunden.
- **B:** 30 Stunden.
- **C:** 24 Stunden.
- **D:** 72 Stunden.

**Lösung:** C

**Erklärung:** Der einfache Durchschnitt beträgt (18 + 24 + 30) / 3 = 24 Personenstunden. Die Annahme vergleichbarer Iterationen ist für die Aussagekraft wichtig.

### ctfl-de-085 · FL-5.1.3 · K2

Ein Endekriterium lautet: Alle kritischen Fehler sind behoben. Ein kritischer Fehler ist noch offen, der Veröffentlichungstermin ist erreicht. Welche Aussage ist richtig?

**Wähle 1 Antwort(en).**

- **A:** Das Endekriterium ist nicht erfüllt; eine Freigabe erfordert eine bewusste Entscheidung der Verantwortlichen über das verbleibende Risiko.
- **B:** Ein erreichter Termin erfüllt automatisch jedes fachliche Endekriterium.
- **C:** Der Tester muss den Fehler aus dem Bericht löschen.
- **D:** Das Endekriterium war rückwirkend ein Eingangskriterium.

**Lösung:** A

**Erklärung:** Ein Termin macht ein Qualitätskriterium nicht automatisch erfüllt. Die Abweichung und das verbleibende Risiko müssen transparent in die Entscheidung einfließen.

### ctfl-de-086 · FL-5.2.2 · K2

Welche ZWEI Beispiele sind Produktrisiken?

**Wähle 2 Antwort(en).**

- **A:** Eine wichtige Testerin fällt vorübergehend aus.
- **B:** Die Testumgebung wird eine Woche später geliefert.
- **C:** Unberechtigte Personen können Gehaltsdaten einsehen.
- **D:** Die Suche liefert bei zulässiger Last unvertretbar lange Antwortzeiten.

**Lösung:** C, D

**Erklärung:** Unbefugter Datenzugriff und unzureichende Performanz betreffen die Produktqualität. Personalausfall und verspätete Ressourcen bedrohen primär den Projektablauf.

## 6. Testwerkzeuge

### ctfl-de-087 · FL-6.1.1 · K2

Welches Werkzeug unterstützt die Prüfung von Quellcode auf bestimmte Regelverletzungen ohne Ausführung des Programms?

**Wähle 1 Antwort(en).**

- **A:** Ein Werkzeug für statische Analyse.
- **B:** Ausschließlich ein Lastgenerator.
- **C:** Ein Bildschirmrekorder ohne Analysefunktion.
- **D:** Ein Testdatenarchiv ohne Prüffunktion.

**Lösung:** A

**Erklärung:** Statische Analysewerkzeuge untersuchen Code oder andere formale Arbeitsergebnisse ohne Programmausführung, beispielsweise auf definierte Regelverletzungen.

### ctfl-de-088 · FL-6.2.1 · K1

Welche ZWEI Aussagen nennen einen möglichen Nutzen bzw. ein Risiko der Testautomatisierung?

**Wähle 2 Antwort(en).**

- **A:** Automatisierung garantiert dauerhaft wartungsfreie Tests.
- **B:** Automatisierte Tests ersetzen jede menschliche Bewertung.
- **C:** Wiederkehrende Prüfungen können konsistenter und schneller ausgeführt werden.
- **D:** Der erforderliche Wartungsaufwand kann unterschätzt werden.

**Lösung:** C, D

**Erklärung:** Automatisierung kann Wiederholbarkeit und Geschwindigkeit verbessern. Aufwand für Einführung, Pflege und Anpassung bleibt ein wichtiges Risiko.

### ctfl-de-089 · FL-6.1.1 · K2

Ein Team will erkennen, welche Codebereiche von automatisierten Tests ausgeführt werden. Welche Werkzeugkategorie passt?

**Wähle 1 Antwort(en).**

- **A:** Ein reines Ticketarchiv.
- **B:** Ein Werkzeug zur Testüberdeckung.
- **C:** Ein Diagrammeditor ohne Laufzeitanbindung.
- **D:** Ein Passwortmanager.

**Lösung:** B

**Erklärung:** Überdeckungswerkzeuge messen die bei Tests ausgeführten Strukturen, etwa Anweisungen oder Zweige. Die Messung ist kein Beweis für Fehlerfreiheit.

### ctfl-de-090 · FL-6.2.1 · K1

Welche Aussage beschreibt ein typisches Risiko bei der Einführung eines Testwerkzeugs?

**Wähle 1 Antwort(en).**

- **A:** Jedes Werkzeug verhindert grundsätzlich Zusammenarbeit.
- **B:** Automatisierte Tests können prinzipiell nicht wiederholt werden.
- **C:** Unrealistische Erwartungen an Nutzen und Einführungsaufwand.
- **D:** Eine frühere Fehlererkennung ist immer schädlich.

**Lösung:** C

**Erklärung:** Überzogene Erwartungen, unterschätzter Aufwand und unzureichende Integration können den erwarteten Werkzeugnutzen gefährden. Ein Werkzeug allein löst keine Prozessprobleme.

## Quellen

- [GTB: aktueller deutscher Lehrplan](https://www.gtb.de/der-certified-tester/lehrplaene/)
- [ISTQB CTFL: Prüfungsdaten und Downloads](https://istqb.org/certifications/certified-tester-foundation-level-ctfl-v4-0/)
- [ISTQB Exam Structures & Rules Tables v1.19, CTFL Seiten 4–5](https://istqb.org/?download_id=3832&sdm_process_download=1)
- [ISTQB Exam Structures and Rules v1.2](https://istqb.org/?download_id=3829&sdm_process_download=1)
