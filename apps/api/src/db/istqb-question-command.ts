import { readFile } from "node:fs/promises";
import { pool } from "./pool.js";
import { importIstqbQuestions } from "./istqb-question-import.js";

try {
  const markdown = await readFile(
    new URL("../../../../docs/elearning/istqb-portal/FRAGEN-MIT-LOESUNGEN.md", import.meta.url),
    "utf8",
  );
  const result = await importIstqbQuestions(pool, markdown);
  console.info(`ISTQB Foundation: ${result.questionCount} Fragen ${result.changed ? "importiert (vorherige Fragen ersetzt)" : "bereits aktuell"}. Kursdaten, Lernmaterialien und Prüfungsergebnisse unverändert.`);
} finally {
  await pool.end();
}
