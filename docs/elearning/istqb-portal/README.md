# ISTQB Foundation Level: Fragenpool und Copilot-Auftrag

Das Paket enthält:

- `COPILOT-AUFTRAG.md`: vollständiger Implementierungsauftrag für Copilot im vorhandenen Mitarbeiterportal.
- `istqb-ctfl-fragenpool.json`: 90 eigene Fragen mit stabilen IDs, Lösungen, Erklärungen, Lernzielen, K-Stufen und Prüfungsbauplan.
- `FRAGEN-MIT-LOESUNGEN.md`: alle Fragen lesbar mit Lösungen, zur fachlichen Prüfung und Pflege.
- `VALIDIERUNG.json`: strukturelle Prüfungen und Ergebnis von 1000 zufälligen Prüfungsziehungen.

## Verwendung

1. ZIP entpacken und den Inhalt beispielsweise unter `docs/istqb-vorbereitung/` im Portal-Repository ablegen. Die Lösung enthaltende JSON-Datei nicht in einen öffentlichen Frontend-Ordner legen.
2. In VS Code den Projektordner öffnen. Copilot Agent-Modus öffnen.
3. `COPILOT-AUFTRAG.md` und `istqb-ctfl-fragenpool.json` als Kontext hinzufügen. Den Auftrag ausführen lassen. Alternativ den vollständigen Markdown-Auftrag in den Chat kopieren und die JSON-Datei anhängen.

Kurzer Startbefehl:

> Implementiere den vollständigen Auftrag in `docs/istqb-vorbereitung/COPILOT-AUFTRAG.md` im bestehenden Mitarbeiterportal. Verwende `docs/istqb-vorbereitung/istqb-ctfl-fragenpool.json` als initialen Fragenpool. Prüfe zuerst die vorhandene Architektur, integriere beide Modi und führe die beschriebenen relevanten Prüfungen aus.

Wenn du einen anderen Ablagepfad wählst, passe ihn im Startbefehl an.

## Umfang und Regeln

Der aktive Portalbestand verwendet zusätzlich die bereinigten Screenshotquellen
`grundlagen-screenshot-fragen.json` (93 Fragen),
`lebenszyklus-screenshot-fragen.json` (60 Fragen),
`statisch-screenshot-fragen.json` (31 Fragen),
`testentwurf-screenshot-fragen.json` (87 Fragen),
`testmanagement-screenshot-fragen.json` (47 Fragen) und
`testwerkzeuge-screenshot-fragen.json` (28 Fragen). In den Kapiteln 1, 5 und 6 wurden 97 historische
oder nicht mit CTFL 4.0.2 vereinbare Fragen ausgeschlossen. Die jeweiligen
`excludedQuestions` dokumentieren Quellnummern, Gründe und Lehrplanbezüge;
sie werden nicht importiert. Bestehende IDs werden nicht neu nummeriert.
Kapitel 4 ersetzt die bisherigen 26 Übungsfragen. Aus 123 Ordner-Screenshots und
einer nachgereichten Entscheidungstabelle wurden 87 aktive Fragen mit 14
Abbildungen übernommen. Zwei ergänzte Entscheidungstabellen für die Backshopfrage
(ID 017) und die Friseurfrage (ID 046) zeigen jeweils nur die vier bisherigen
Regeln, ohne Legende. Damit enthält Kapitel 4 insgesamt 16 Abbildungen.
Zwei Wiederholungen derselben Frage und eine zusätzliche
Testmanagement-Aufnahme sind separat erfasst; 34 historische, fehlerhafte oder
mehrdeutige Fragen sind mit Grund ausgeschlossen.
Die bestätigten Originalschlüssel 69 und 121 bleiben nur im Ausschlussvermerk.
Zwei verschiedene Fragen mit aufgedruckter Nummer 11 werden nicht zusammengelegt:
Die Bonusfrage erhält ID 123; die zusätzliche Entscheidungstabelle ID 122.
14 aktive Schlüssel stammen aus den nachgereichten gelben Lösungsboxen.
36 Fragen sind zusätzlich für die Simulation geeignet; sechs aktuelle
Kapitel-4-Fragen ergänzen fehlende Simulationslernziele und stehen auch zum Üben bereit.

Kapitel 2 ersetzt die bisherigen zwölf Übungsfragen durch 60 Fragen aus 94
Screenshots (93 eigenständige Kandidaten). 33 historische, mehrdeutige oder
fachlich ungeeignete Kandidaten sind mit Grund ausgeschlossen. Die doppelte
Aufnahme von Frage 36 ist separat erfasst; eine Frage 37 wird nicht erfunden.
Die Lösungen zu 10, 53, 71 und 78 folgen den gelben Originalauflösungsboxen.
Frage 15 enthält den zugeschnittenen Originalgraphen; ihr Schlüssel „A-a-E“
wurde aus den Kanten hergeleitet, nicht aus einer gelben Box übernommen.
34 Fragen sind auch für die Simulation geeignet. Drei aktuelle Ausgangsfragen
zu DevOps, Shift-Left und Retrospektiven bleiben als `both`
erhalten. Kontextabhängige Originalfragen bleiben nur Übung, mit Erläuterung
der Einschränkungen gegenüber der aktuellen Lehre.

Kapitel 3 ersetzt die bisherigen acht Übungsfragen durch 31 Fragen aus 56
Screenshots. 25 historische, mehrdeutige oder fachlich ungeeignete Aufgaben sind
mit Ausschlussgrund dokumentiert, unter anderem zyklomatische Komplexität,
dd-/du-/ur-Anomalien und die historische Reviewphasenfolge.
Bei Frage 27 sind zudem die numerischen Antwortkombinationen nicht vollständig
lesbar; es wird keine Kombination erfunden.
Die fünf Originalschlüssel 5/D, 32/D, 43/A, 54/A und 56/C stammen aus den gelben
Lösungsboxen. Der Originalgraph zu Frage 5 ist ohne Antwortmarkierungen eingebunden.
Die nachgereichte Lösung bestätigt auch die zuvor abgeschnittene Quellnummer 32.
Kontextabhängige Originalschlüssel bleiben nur Übung und werden erläutert.
Zwölf Fragen sind zusätzlich für die Simulation geeignet; zwei aktuelle
Ausgangsfragen zu Stakeholder-Feedback und Review-Erfolgsfaktoren bleiben
als `both` für Übung und Simulation erhalten.

Damit sind die Übungsfragen aller sechs Kapitel ersetzt.
Der Sitzungsumfang im Übungsmodus ist 20 Fragen (Standard), 40 Fragen oder alle
verfügbaren Fragen der gewählten Filter. Kleinere Bestände werden ohne Wiederholung
vollständig verwendet.
Bei Auswahl aller sechs Kapitel werden 40 Fragen nach der CTFL-Kapitelverteilung
8/6/4/11/9/2 ausgewählt. Für 20 Fragen gilt die proportional gerundete Verteilung
4/3/2/6/4/1 (größte Reste, bei Gleichstand zuerst das niedrigere Kapitel).
Fehlende Plätze durch Wissensstufen- oder Fehlerfilter werden mit passenden Fragen
anderer gewählter Kapitel aufgefüllt, ohne Wiederholungen. Unbeantwortete Fragen
bleiben innerhalb jeder Kapitelquote und beim Auffüllen bevorzugt.
Bei Auswahl von weniger als sechs Kapiteln werden die Fragen gleichmäßig auf die
gewählten Kapitel verteilt (zwei Kapitel: 50/50, drei: je rund ein Drittel usw.).
Unteilbare Restplätze werden zufällig vergeben. Auch hier werden fehlende Plätze
aus anderen gewählten Kapiteln aufgefüllt.
„Alle verfügbaren Fragen“ verwendet unabhängig von der Kapitelauswahl alle Treffer,
ohne Kapitelquote.
Eine feste Wissensstufenverteilung gilt weiterhin nur in der Prüfungssimulation.
Der vollständige Portalpool enthält nach Import 379 sichtbare Übungsfragen, einschließlich
33 Ergänzungsfragen für aktuelle Simulationslernziele. Es gibt keine reinen Prüfungsfragen.
Die Simulation verwendet geeignete Fragen aus diesem Bestand nach dem Prüfungsbauplan;
kontextabhängige Originalfragen bleiben weiterhin nur Übung. Kapitelbestände:
101 / 63 / 33 / 93 / 61 / 28. Import und Bestandserhalt sind in
[production-deployment.md](../../production-deployment.md#istqb-kursfragen-gezielt-importieren) beschrieben.

Die 90 Fragen decken alle 64 expliziten Lernziele des deutschen CTFL-Lehrplans 4.0.2 mindestens einmal ab. Es gibt 85 Einzel- und 5 Mehrfachauswahlfragen. Die Fragen sind ein eigener Startbestand für die Prüfungsvorbereitung. Abdeckung aller Lernziele bedeutet nicht, dass jede mögliche Frage oder jede Nuance des Lehrplans im Pool enthalten ist.

Die Simulation zieht 40 Fragen mit 60 Minuten Bearbeitungszeit; für die Nicht-Muttersprache-Übungsoption gelten 75 Minuten. Bestanden ab 26 Punkten. Alle Fragen geben einen Punkt, bei Mehrfachauswahl nur für die vollständig richtige Menge. Keine Teil- oder Minuspunkte. Lösungen werden erst nach Prüfungsende gezeigt. Die Kapitelverteilung beträgt 8/6/4/11/9/2 und die K-Stufen-Verteilung 8/24/8 für K1/K2/K3.

Einzelne Lernziele besitzen derzeit nur eine Frage. Deshalb wiederholen sich bei neuen Prüfungen einige Fragen zwangsläufig. Poolerweiterungen sollten zusätzliche Varianten insbesondere in diesen Gruppen ergänzen. Die zufällige Verteilung ist geprüft; das Paket enthält noch keine lauffähige Portalimplementierung. Deren Umsetzung und Integration übernimmt Copilot anhand des Auftrags.

## Inhaltsgrundlage

Primär: `ISTQB_CTFL_Lehrplan-2025_V4.0.2_DE.pdf`, deutsche Ausgabe 01.03.2025, ATB/GTB/STB, auf Basis des englischen ISTQB-Lehrplans 4.0.1. Die ältere hochgeladene Datei von 2023 wurde zur Einordnung der Version geprüft.

Offizielle Quellen und Versionsstände sind in Auftrag und JSON hinterlegt. Die technischen Portalregeln zu Autosave, Ergebnisansicht, Wiederaufnahme und Benutzerzugriff sind Implementierungsentscheidungen. Der Hilfsmittelverzicht wird als Simulationsregel erklärt und nicht durch Überwachung durchgesetzt.

**Eigene, inoffizielle Übungsfragen. Keine offiziellen ISTQB-Prüfungsfragen, keine Zertifizierungsprüfung.**
