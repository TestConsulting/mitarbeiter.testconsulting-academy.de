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

Die 90 Fragen decken alle 64 expliziten Lernziele des deutschen CTFL-Lehrplans 4.0.2 mindestens einmal ab. Es gibt 85 Einzel- und 5 Mehrfachauswahlfragen. Die Fragen sind ein eigener Startbestand für die Prüfungsvorbereitung. Abdeckung aller Lernziele bedeutet nicht, dass jede mögliche Frage oder jede Nuance des Lehrplans im Pool enthalten ist.

Die Simulation zieht 40 Fragen mit 60 Minuten Bearbeitungszeit; für die Nicht-Muttersprache-Übungsoption gelten 75 Minuten. Bestanden ab 26 Punkten. Alle Fragen geben einen Punkt, bei Mehrfachauswahl nur für die vollständig richtige Menge. Keine Teil- oder Minuspunkte. Lösungen werden erst nach Prüfungsende gezeigt. Die Kapitelverteilung beträgt 8/6/4/11/9/2 und die K-Stufen-Verteilung 8/24/8 für K1/K2/K3.

Einzelne Lernziele besitzen derzeit nur eine Frage. Deshalb wiederholen sich bei neuen Prüfungen einige Fragen zwangsläufig. Poolerweiterungen sollten zusätzliche Varianten insbesondere in diesen Gruppen ergänzen. Die zufällige Verteilung ist geprüft; das Paket enthält noch keine lauffähige Portalimplementierung. Deren Umsetzung und Integration übernimmt Copilot anhand des Auftrags.

## Inhaltsgrundlage

Primär: `ISTQB_CTFL_Lehrplan-2025_V4.0.2_DE.pdf`, deutsche Ausgabe 01.03.2025, ATB/GTB/STB, auf Basis des englischen ISTQB-Lehrplans 4.0.1. Die ältere hochgeladene Datei von 2023 wurde zur Einordnung der Version geprüft.

Offizielle Quellen und Versionsstände sind in Auftrag und JSON hinterlegt. Die technischen Portalregeln zu Autosave, Ergebnisansicht, Wiederaufnahme und Benutzerzugriff sind Implementierungsentscheidungen. Der Hilfsmittelverzicht wird als Simulationsregel erklärt und nicht durch Überwachung durchgesetzt.

**Eigene, inoffizielle Übungsfragen. Keine offiziellen ISTQB-Prüfungsfragen, keine Zertifizierungsprüfung.**
