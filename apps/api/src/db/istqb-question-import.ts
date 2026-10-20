import { isDeepStrictEqual } from "node:util";
import type { PracticeQuestion } from "@portal/shared";
import type { Pool } from "pg";

export function parseIstqbQuestions(markdown: string): PracticeQuestion[] {
  const text = markdown.replace(/\r\n/g, "\n");
  const headings = [...text.matchAll(/^#{2,3} .+$/gm)];
  const questions: PracticeQuestion[] = [];
  let chapter: { number: number; title: string } | undefined;
  for (const [index, heading] of headings.entries()) {
    const chapterHeading = /^## ([1-6])\. (.+)$/.exec(heading[0]);
    if (chapterHeading) chapter = { number: Number(chapterHeading[1]), title: chapterHeading[2] };
    if (!heading[0].startsWith("### ")) continue;
    const identity = /^### (ctfl-de-\d{3}) · (FL-([1-6])\.\d+\.\d+) · (K[123])$/.exec(heading[0]);
    if (!identity) throw new Error(`Ungültige Fragenüberschrift: ${heading[0]}`);
    const kLevel = identity[4];
    if (!chapter || chapter.number !== Number(identity[3]) || (kLevel !== "K1" && kLevel !== "K2" && kLevel !== "K3")) {
      throw new Error(`Ungültige Kapitelzuordnung: ${heading[0]}`);
    }
    const id = identity[1];
    const body = text.slice(heading.index + heading[0].length, headings[index + 1]?.index).trim();
    const fields = /^([\s\S]+?)\n\n\*\*Wähle ([12]) Antwort\(en\)\.\*\*\n\n([\s\S]+?)\n\n\*\*Lösung:\*\* ([A-D](?:, [A-D])*)\n\n\*\*Erklärung:\*\* ([\s\S]+)$/.exec(body);
    if (!fields) throw new Error(`Frage ${id}: Fragetext, Auswahlanzahl, Lösungen oder Erklärung fehlen.`);
    const [, question, selections, optionText, solution, explanation] = fields;
    const options = optionText.split("\n").map((line) => {
      const option = /^- \*\*([A-D]):\*\* (.+)$/.exec(line);
      if (!option) throw new Error(`Frage ${id}: Ungültige Antwortmöglichkeit.`);
      return { id: `${id}-${option[1].toLowerCase()}`, text: option[2] };
    });
    const correctOptionIds = solution.split(", ").map((letter) => `${id}-${letter.toLowerCase()}`);
    if (options.length !== 4 || new Set(options.map((option) => option.id)).size !== 4 ||
        new Set(options.map((option) => option.text)).size !== 4 ||
        correctOptionIds.length !== Number(selections) ||
        new Set(correctOptionIds).size !== correctOptionIds.length ||
        correctOptionIds.some((optionId) => !options.some((option) => option.id === optionId)) ||
        question.length > 2000 || options.some((option) => option.text.length > 1000) ||
        !explanation.trim() || explanation.length > 5000) {
      throw new Error(`Frage ${id}: Antwortmöglichkeiten, Lösung oder Textlängen sind ungültig.`);
    }
    questions.push({
      id, question, type: selections === "1" ? "single" : "multiple",
      options, correctOptionIds, explanation,
      metadata: {
        chapter: chapter.number, chapterTitle: chapter.title, learningObjective: identity[2],
        kLevel,
      },
    });
  }
  if (questions.length !== 90 || new Set(questions.map((question) => question.id)).size !== 90) {
    throw new Error("Die Quelldatei muss genau 90 Fragen mit eindeutigen IDs enthalten.");
  }
  return questions;
}

export async function importIstqbQuestions(database: Pick<Pool, "connect">, markdown: string) {
  const questions = parseIstqbQuestions(markdown);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query<{ id: string; questions: PracticeQuestion[] }>(
      "SELECT id, course_data->'questions' AS questions FROM elearning_courses WHERE slug = $1 FOR UPDATE",
      ["istqb-foundation"],
    );
    const course = selected.rows[0];
    if (!course) throw new Error("Der Kurs ISTQB Foundation wurde nicht gefunden. Import abgebrochen.");
    const changed = !isDeepStrictEqual(course.questions, questions);
    if (changed) {
      await client.query(
        `UPDATE elearning_courses
         SET course_data = jsonb_set(course_data, '{questions}', $2::jsonb), updated_at = now()
         WHERE id = $1`,
        [course.id, JSON.stringify(questions)],
      );
    }
    await client.query("COMMIT");
    return { questionCount: questions.length, changed };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
