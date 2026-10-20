import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importIstqbQuestions, parseIstqbQuestions } from "./istqb-question-import.js";

const markdown = await readFile(
  new URL("../../../../docs/elearning/istqb-portal/FRAGEN-MIT-LOESUNGEN.md", import.meta.url), "utf8",
);
const questions = parseIstqbQuestions(markdown);
const client = { query: vi.fn(), release: vi.fn() };
const database = { connect: vi.fn(async () => client) };

beforeEach(() => {
  vi.clearAllMocks();
  client.query.mockImplementation(async (sql: string) => ({
    rows: sql.startsWith("SELECT") ? [{ id: "existing-course", questions: [] }] : [],
  }));
});

describe("ISTQB question import", () => {
  it("matches all chapter, learning objective and K-level mappings against the JSON question pool", async () => {
    const sourcePool: {
      chapters: { id: number; title: string }[];
      questions: { id: string; chapter: number; learningObjective: string; kLevel: string; stem: string }[];
    } = JSON.parse(await readFile(
      new URL("../../../../docs/elearning/istqb-portal/istqb-ctfl-fragenpool.json", import.meta.url), "utf8",
    ));
    expect(sourcePool.questions).toHaveLength(questions.length);
    for (const question of questions) {
      const source = sourcePool.questions.find((item) => item.id === question.id);
      expect(source).toBeDefined();
      expect(question.question).toBe(source!.stem);
      expect(question.metadata).toEqual({
        chapter: source!.chapter,
        chapterTitle: sourcePool.chapters.find((chapter) => chapter.id === source!.chapter)!.title,
        learningObjective: source!.learningObjective,
        kLevel: source!.kLevel,
      });
    }
    expect(new Set(questions.map((question) => question.metadata!.chapter)).size).toBe(6);
    expect(new Set(questions.map((question) => question.metadata!.kLevel))).toEqual(new Set(["K1", "K2", "K3"]));
  });
  it("imports all 90 markdown questions verbatim with stable answer IDs and correct single/multiple solutions", () => {
    expect(questions).toHaveLength(90);
    expect(questions[0]).toMatchObject({
      id: "ctfl-de-001", question: "Welches ist ein typisches Testziel?", type: "single",
      correctOptionIds: ["ctfl-de-001-b"],
      explanation: "Tests liefern Informationen für Entscheidungen und können Risiken senken. Sie beweisen weder Fehlerfreiheit noch beseitigen sie die gemeinsame Qualitätsverantwortung.",
    });
    expect(questions.find((question) => question.id === "ctfl-de-088")).toMatchObject({
      type: "multiple", correctOptionIds: ["ctfl-de-088-c", "ctfl-de-088-d"],
    });
    expect(questions[89].id).toBe("ctfl-de-090");
    for (const question of questions) {
      expect(question.options).toHaveLength(4);
      for (const option of question.options) expect(markdown).toContain(option.text);
      expect(markdown).toContain(question.question);
      expect(markdown).toContain(question.explanation);
    }
    expect(parseIstqbQuestions(markdown.replace(/\n/g, "\r\n"))).toEqual(questions);
  });

  it.each([
    ["duplicate ID", markdown.replace("ctfl-de-090", "ctfl-de-001")],
    ["missing question", markdown.replace(/^### ctfl-de-090[\s\S]*?(?=^## Quellen)/m, "")],
    ["missing option", markdown.replace("- **A:** Nachweisen, dass keinerlei Fehlerzustände mehr vorhanden sind.\n", "")],
    ["invalid solution", markdown.replace("**Lösung:** B", "**Lösung:** E")],
    ["wrong selection count", markdown.replace("**Wähle 1 Antwort(en).**", "**Wähle 2 Antwort(en).**")],
    ["duplicate solution", markdown.replace("**Lösung:** C, D", "**Lösung:** C, C")],
    ["wrong chapter", markdown.replace("## 1. Grundlagen des Testens", "## 2. Grundlagen des Testens")],
  ])("rejects %s before accessing the database", async (_name, source) => {
    await expect(importIstqbQuestions(database, source)).rejects.toThrow();
    expect(database.connect).not.toHaveBeenCalled();
  });

  it("locks the existing course and replaces only its questions", async () => {
    await expect(importIstqbQuestions(database, markdown)).resolves.toEqual({ questionCount: 90, changed: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("FOR UPDATE"), ["istqb-foundation"]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set(course_data, '{questions}'"), [
      "existing-course", JSON.stringify(questions),
    ]);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("does not write an already imported question set", async () => {
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions }] });
    await expect(importIstqbQuestions(database, markdown)).resolves.toEqual({ questionCount: 90, changed: false });
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false);
  });

  it("rolls back and reports a missing course instead of recreating it", async () => {
    client.query.mockResolvedValue({ rows: [] });
    await expect(importIstqbQuestions(database, markdown)).rejects.toThrow("nicht gefunden");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back and propagates database errors", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("UPDATE")) throw new Error("Database write failed");
      return { rows: [{ id: "existing-course", questions: [] }] };
    });
    await expect(importIstqbQuestions(database, markdown)).rejects.toThrow("Database write failed");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
