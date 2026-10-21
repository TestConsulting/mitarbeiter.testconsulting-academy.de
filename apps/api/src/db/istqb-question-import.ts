import { isDeepStrictEqual } from "node:util";
import type { PracticeQuestion } from "@portal/shared";
import type { Pool } from "pg";
import { z } from "zod";

type ScreenshotChapter = 1 | 2 | 3 | 4 | 5 | 6;
const screenshotChapters = {
  1: { idPattern: /^ctfl-grundlagen-\d{3}$/, title: "Grundlagen des Testens" },
  2: { idPattern: /^ctfl-lebenszyklus-\d{3}$/, title: "Testen während des Softwareentwicklungslebenszyklus" },
  3: { idPattern: /^ctfl-statisch-\d{3}$/, title: "Statischer Test" },
  4: { idPattern: /^ctfl-testentwurf-\d{3}$/, title: "Testanalyse und -entwurf" },
  5: { idPattern: /^ctfl-testmanagement-\d{3}$/, title: "Testmanagement" },
  6: { idPattern: /^ctfl-testwerkzeuge-\d{3}$/, title: "Testwerkzeuge" },
} as const;
const staticExamLevels: Record<string, string> = {
  "FL-3.1.1": "K1", "FL-3.1.2": "K2", "FL-3.1.3": "K2",
  "FL-3.2.1": "K1", "FL-3.2.2": "K2", "FL-3.2.3": "K1",
  "FL-3.2.4": "K2", "FL-3.2.5": "K1",
};
const lifecycleExamLevels: Record<string, string> = {
  "FL-2.1.1": "K2", "FL-2.1.2": "K1", "FL-2.1.3": "K1",
  "FL-2.1.4": "K2", "FL-2.1.5": "K2", "FL-2.1.6": "K2",
  "FL-2.2.1": "K2", "FL-2.2.2": "K2", "FL-2.2.3": "K2", "FL-2.3.1": "K2",
};
const designExamLevels: Record<string, string> = {
  "FL-4.1.1": "K2",
  "FL-4.2.1": "K3", "FL-4.2.2": "K3", "FL-4.2.3": "K3", "FL-4.2.4": "K3",
  "FL-4.3.1": "K2", "FL-4.3.2": "K2", "FL-4.3.3": "K2",
  "FL-4.4.1": "K2", "FL-4.4.2": "K2", "FL-4.4.3": "K2",
  "FL-4.5.1": "K2", "FL-4.5.2": "K2", "FL-4.5.3": "K3",
};
const managementExamLevels: Record<string, string> = {
  "FL-5.1.1": "K2", "FL-5.1.3": "K2", "FL-5.1.7": "K2",
  "FL-5.1.2": "K1", "FL-5.1.6": "K1", "FL-5.2.1": "K1", "FL-5.3.1": "K1",
  "FL-5.2.2": "K2", "FL-5.2.3": "K2", "FL-5.2.4": "K2",
  "FL-5.3.2": "K2", "FL-5.3.3": "K2", "FL-5.4.1": "K2",
  "FL-5.1.4": "K3", "FL-5.1.5": "K3", "FL-5.5.1": "K3",
};

const screenshotBankSchema = (chapter: ScreenshotChapter) => z.object({
  version: z.literal(1),
  questions: z.array(z.object({
    id: z.string().regex(screenshotChapters[chapter].idPattern),
    question: z.string().trim().min(1).max(2000),
    type: z.literal("single"),
    options: z.array(z.object({
      id: z.string().min(1).max(100),
      text: z.string().trim().min(1).max(1000),
    }).strict()).min(2).max(4),
    correctOptionIds: z.array(z.string()).length(1),
    explanation: z.string().trim().min(1).max(5000),
    usage: z.enum(["practice", "both"]),
    image: z.object({
      url: z.string().regex(chapter === 2
        ? /^\/questions\/istqb-foundation\/lebenszyklus-\d{3}\.png$/
        : chapter === 3
        ? /^\/questions\/istqb-foundation\/statisch-\d{3}\.png$/
        : chapter === 4
        ? /^\/questions\/istqb-foundation\/testentwurf-\d{3}\.png$/
        : /^\/questions\/istqb-foundation\/prozess-\d+\.png$/),
      alt: z.string().trim().min(1).max(500),
    }).strict().optional(),
    metadata: z.object({
      chapter: z.literal(chapter),
      chapterTitle: z.literal(screenshotChapters[chapter].title),
      learningObjective: z.string().regex(/^FL-[1-6]\.\d+\.\d+$/),
      kLevel: z.enum(["K1", "K2", "K3"]),
    }).strict(),
  }).strict()).min(1).max(150),
});

export function parseScreenshotQuestions(input: unknown, chapter: ScreenshotChapter = 1): PracticeQuestion[] {
  const { questions } = screenshotBankSchema(chapter).parse(input);
  const ids = new Set<string>();
  const unique = new Map<string, PracticeQuestion>();
  for (const question of questions) {
    if (ids.has(question.id)) throw new Error(`Doppelte Fragen-ID: ${question.id}`);
    ids.add(question.id);
    if (new Set(question.options.map((option) => option.id)).size !== question.options.length ||
        new Set(question.options.map((option) => option.text)).size !== question.options.length ||
        !question.options.some((option) => option.id === question.correctOptionIds[0]) ||
        (question.usage === "both" && !question.metadata.learningObjective.startsWith(`FL-${chapter}.`)) ||
        (chapter === 2 && question.usage === "both" &&
          lifecycleExamLevels[question.metadata.learningObjective] !== question.metadata.kLevel) ||
        (chapter === 3 && question.usage === "both" &&
          staticExamLevels[question.metadata.learningObjective] !== question.metadata.kLevel) ||
        (chapter === 4 && question.usage === "both" &&
          designExamLevels[question.metadata.learningObjective] !== question.metadata.kLevel) ||
        (chapter === 5 && question.usage === "both" &&
          managementExamLevels[question.metadata.learningObjective] !== question.metadata.kLevel) ||
        (chapter === 6 && question.usage === "both" &&
          !((question.metadata.learningObjective === "FL-6.1.1" && question.metadata.kLevel === "K2") ||
            (question.metadata.learningObjective === "FL-6.2.1" && question.metadata.kLevel === "K1")))) {
      throw new Error(`Ungültige Antworten oder Prüfungszuordnung: ${question.id}`);
    }
    const normalize = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();
    const signature = JSON.stringify([
      normalize(question.question),
      question.options.map((option) => normalize(option.text)).sort(),
      question.image?.url ?? null,
    ]);
    const previous = unique.get(signature);
    if (previous) {
      const solution = question.options.find((option) => option.id === question.correctOptionIds[0])!.text;
      const previousSolution = previous.options.find((option) => option.id === previous.correctOptionIds[0])!.text;
      if (normalize(solution) !== normalize(previousSolution)) {
        throw new Error(`Widersprüchliche Lösungen für doppelte Fragen: ${previous.id}, ${question.id}`);
      }
    } else {
      unique.set(signature, question);
    }
  }
  return [...unique.values()];
}

export function replaceScreenshotChapter(
  existing: PracticeQuestion[], baseline: PracticeQuestion[], replacement: PracticeQuestion[], chapter: ScreenshotChapter = 1,
): PracticeQuestion[] {
  const covered = new Set(replacement.filter((question) => question.usage === "both")
    .map((question) => question.metadata?.learningObjective));
  const examFallbacks = baseline.filter((question) => question.metadata?.chapter === chapter &&
    !covered.has(question.metadata.learningObjective)).map((question): PracticeQuestion => ({
      ...question, usage: "both",
    }));
  const retained = existing.filter((question) => question.metadata?.chapter !== chapter);
  return chapter === 1 ? [...replacement, ...examFallbacks, ...retained] : [...retained, ...replacement, ...examFallbacks];
}

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

export async function importIstqbQuestions(
  database: Pick<Pool, "connect">, markdown: string, screenshotBank?: unknown, toolsBank?: unknown,
  managementBank?: unknown, designBank?: unknown, lifecycleBank?: unknown, staticBank?: unknown,
) {
  const baseline = parseIstqbQuestions(markdown);
  const replacement = screenshotBank === undefined ? undefined : parseScreenshotQuestions(screenshotBank);
  const toolsReplacement = toolsBank === undefined ? undefined : parseScreenshotQuestions(toolsBank, 6);
  const managementReplacement = managementBank === undefined ? undefined : parseScreenshotQuestions(managementBank, 5);
  const designReplacement = designBank === undefined ? undefined : parseScreenshotQuestions(designBank, 4);
  const lifecycleReplacement = lifecycleBank === undefined ? undefined : parseScreenshotQuestions(lifecycleBank, 2);
  const staticReplacement = staticBank === undefined ? undefined : parseScreenshotQuestions(staticBank, 3);
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query<{ id: string; questions: PracticeQuestion[] }>(
      "SELECT id, course_data->'questions' AS questions FROM elearning_courses WHERE slug = $1 FOR UPDATE",
      ["istqb-foundation"],
    );
    const course = selected.rows[0];
    if (!course) throw new Error("Der Kurs ISTQB Foundation wurde nicht gefunden. Import abgebrochen.");
    let questions = replacement ? replaceScreenshotChapter(course.questions, baseline, replacement)
      : toolsReplacement || managementReplacement || designReplacement || lifecycleReplacement || staticReplacement ? course.questions : baseline;
    if (toolsReplacement) questions = replaceScreenshotChapter(questions, baseline, toolsReplacement, 6);
    if (managementReplacement) questions = replaceScreenshotChapter(questions, baseline, managementReplacement, 5);
    if (designReplacement) questions = replaceScreenshotChapter(questions, baseline, designReplacement, 4);
    if (lifecycleReplacement) questions = replaceScreenshotChapter(questions, baseline, lifecycleReplacement, 2);
    if (staticReplacement) questions = replaceScreenshotChapter(questions, baseline, staticReplacement, 3);
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
