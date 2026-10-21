import { readFile } from "node:fs/promises";
import { pool } from "./pool.js";
import { importIstqbQuestions } from "./istqb-question-import.js";

try {
  const [chapter = "all", ...extraArguments] = process.argv.slice(2);
  if (!["all", "1", "2", "3", "4", "5", "6"].includes(chapter) || extraArguments.length > 0) {
    throw new Error("Usage: istqb-question-command.ts [all|1|2|3|4|5|6]");
  }
  const markdown = await readFile(
    new URL("../../../../docs/elearning/istqb-portal/FRAGEN-MIT-LOESUNGEN.md", import.meta.url),
    "utf8",
  );
  const screenshotBank: unknown = !["all", "1"].includes(chapter) ? undefined : JSON.parse(await readFile(
    new URL("../../../../docs/elearning/istqb-portal/grundlagen-screenshot-fragen.json", import.meta.url),
    "utf8",
  ));
  const toolsBank: unknown = !["all", "6"].includes(chapter) ? undefined : JSON.parse(await readFile(
    new URL("../../../../docs/elearning/istqb-portal/testwerkzeuge-screenshot-fragen.json", import.meta.url),
    "utf8",
  ));
  const managementBank: unknown = !["all", "5"].includes(chapter) ? undefined : JSON.parse(await readFile(
    new URL("../../../../docs/elearning/istqb-portal/testmanagement-screenshot-fragen.json", import.meta.url),
    "utf8",
  ));
  const designBank: unknown = !["all", "4"].includes(chapter) ? undefined : JSON.parse(await readFile(
    new URL("../../../../docs/elearning/istqb-portal/testentwurf-screenshot-fragen.json", import.meta.url),
    "utf8",
  ));
  const lifecycleBank: unknown = !["all", "2"].includes(chapter) ? undefined : JSON.parse(await readFile(
    new URL("../../../../docs/elearning/istqb-portal/lebenszyklus-screenshot-fragen.json", import.meta.url),
    "utf8",
  ));
  const staticBank: unknown = !["all", "3"].includes(chapter) ? undefined : JSON.parse(await readFile(
    new URL("../../../../docs/elearning/istqb-portal/statisch-screenshot-fragen.json", import.meta.url),
    "utf8",
  ));
  const result = await importIstqbQuestions(pool, markdown, screenshotBank, toolsBank, managementBank, designBank, lifecycleBank, staticBank);
  const chapters = chapter === "all" ? "1, 2, 3, 4, 5 und 6" : chapter;
  console.info(`ISTQB Foundation: ${result.questionCount} Fragen ${result.changed ? `importiert (Kapitel ${chapters} ersetzt, nötige Prüfungsfallbacks erhalten)` : "bereits aktuell"}. Andere Kapitel, Kursdaten, Lernmaterialien und Prüfungsergebnisse unverändert.`);
} finally {
  await pool.end();
}
