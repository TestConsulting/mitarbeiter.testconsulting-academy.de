import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { importIstqbQuestions, parseIstqbQuestions, parseScreenshotQuestions, replaceScreenshotChapter } from "./istqb-question-import.js";
import { selectCtflExam } from "../courses/exam-blueprint.js";
import { coursesData } from "@portal/shared";

const markdown = await readFile(
  new URL("../../../../docs/elearning/istqb-portal/FRAGEN-MIT-LOESUNGEN.md", import.meta.url), "utf8",
);
const questions = parseIstqbQuestions(markdown);
const screenshotBank: unknown = JSON.parse(await readFile(
  new URL("../../../../docs/elearning/istqb-portal/grundlagen-screenshot-fragen.json", import.meta.url), "utf8",
));
const screenshotQuestions = parseScreenshotQuestions(screenshotBank);
const toolsBank: unknown = JSON.parse(await readFile(
  new URL("../../../../docs/elearning/istqb-portal/testwerkzeuge-screenshot-fragen.json", import.meta.url), "utf8",
));
const toolsQuestions = parseScreenshotQuestions(toolsBank, 6);
const managementBank: unknown = JSON.parse(await readFile(
  new URL("../../../../docs/elearning/istqb-portal/testmanagement-screenshot-fragen.json", import.meta.url), "utf8",
));
const managementQuestions = parseScreenshotQuestions(managementBank, 5);
const designBank: unknown = JSON.parse(await readFile(
  new URL("../../../../docs/elearning/istqb-portal/testentwurf-screenshot-fragen.json", import.meta.url), "utf8",
));
const designQuestions = parseScreenshotQuestions(designBank, 4);
const lifecycleBank: unknown = JSON.parse(await readFile(
  new URL("../../../../docs/elearning/istqb-portal/lebenszyklus-screenshot-fragen.json", import.meta.url), "utf8",
));
const lifecycleQuestions = parseScreenshotQuestions(lifecycleBank, 2);
const staticBank: unknown = JSON.parse(await readFile(
  new URL("../../../../docs/elearning/istqb-portal/statisch-screenshot-fragen.json", import.meta.url), "utf8",
));
const staticQuestions = parseScreenshotQuestions(staticBank, 3);
const client = { query: vi.fn(), release: vi.fn() };
const database = { connect: vi.fn(async () => client) };

beforeEach(() => {
  vi.clearAllMocks();
  client.query.mockImplementation(async (sql: string) => ({
    rows: sql.startsWith("SELECT") ? [{ id: "existing-course", questions: [] }] : [],
  }));
});

describe("ISTQB question import", () => {
  it("accounts for all 56 static-test candidates and excludes 25 obsolete or unsuitable questions", () => {
    const review = z.object({
      sourceScreenshotCount: z.literal(56), sourceQuestionCount: z.literal(56),
      reviewedSyllabus: z.literal("CTFL 4.0.2 DE (01.03.2025)"),
      duplicates: z.array(z.unknown()),
      excludedQuestions: z.array(z.object({
        id: z.string(), reason: z.string().min(20), syllabusSections: z.array(z.string()).min(1),
      })),
      sourceRecords: z.array(z.object({
        file: z.string(), id: z.string(), printedNumber: z.number().nullable(),
        confirmedPrintedNumber: z.number().optional(), disposition: z.enum(["active", "excluded"]),
      })),
    }).parse(staticBank);
    expect(staticQuestions).toHaveLength(31);
    expect(review.excludedQuestions).toHaveLength(25);
    expect(review.duplicates).toHaveLength(0);
    expect(review.sourceRecords).toHaveLength(56);
    expect(new Set(review.sourceRecords.map((record) => record.file)).size).toBe(56);
    expect(new Set(review.sourceRecords.map((record) => record.id)).size).toBe(56);
    expect(review.sourceRecords.filter((record) => record.disposition === "active").map((record) => record.id).sort())
      .toEqual(staticQuestions.map((question) => question.id).sort());
    expect(review.sourceRecords.filter((record) => record.disposition === "excluded").map((record) => record.id).sort())
      .toEqual(review.excludedQuestions.map((question) => question.id).sort());
    expect(review.sourceRecords.find((record) => record.id === "ctfl-statisch-032"))
      .toMatchObject({ printedNumber: null, confirmedPrintedNumber: 32 });
    const excluded = new Set(review.excludedQuestions.map((question) => question.id));
    expect(staticQuestions.every((question) => !excluded.has(question.id))).toBe(true);
    expect(staticQuestions.every((question) => !/zyklomatisch|dd-Anomalie|du-Anomalie|ur-Anomalie|IEEE 1028/i.test(question.question))).toBe(true);
  });

  it("uses all five yellow-box static-test keys instead of the incorrect selected options", () => {
    const confirmations = z.object({
      confirmedAnswers: z.record(z.string(), z.object({ answer: z.string(), examEligible: z.literal(false) })),
    }).parse(staticBank);
    expect(Object.keys(confirmations.confirmedAnswers).map(Number).sort((a, b) => a - b)).toEqual([5, 32, 43, 54, 56]);
    const keys: Record<string, string> = { "5": "d", "32": "d", "43": "a", "54": "a", "56": "c" };
    for (const [number, confirmation] of Object.entries(confirmations.confirmedAnswers)) {
      const question = staticQuestions.find((q) => q.id === `ctfl-statisch-${number.padStart(3, "0")}`)!;
      expect(question.correctOptionIds).toEqual([`${question.id}-${keys[number]}`]);
      expect(question.options.find((option) => option.id === question.correctOptionIds[0])?.text).toBe(confirmation.answer);
      expect(question.usage).toBe("practice");
      expect(question.explanation).toContain("gelben Originalauflösungsbox");
    }
    expect(confirmations.confirmedAnswers["5"].answer)
      .toBe("Zwei Testfälle für vollständige Anweisungsüberdeckung, zwei Testfälle für vollständige Entscheidungsüberdeckung.");
    expect(confirmations.confirmedAnswers["32"].answer).toBe("I, II, III");
    expect(confirmations.confirmedAnswers["43"].answer).toBe("Technisches Review");
    expect(confirmations.confirmedAnswers["54"].answer).toBe("B und i, iii");
    expect(confirmations.confirmedAnswers["56"].answer).toContain("gleichgestellten Kollegen");
  });

  it("ships the cropped static-test graph and validates all required coverage paths", async () => {
    const illustrated = staticQuestions.filter((question) => question.image);
    expect(illustrated).toHaveLength(1);
    const graph = illustrated[0];
    expect(graph.id).toBe("ctfl-statisch-005");
    const data = await readFile(new URL(`../../../web/public${graph.image!.url}`, import.meta.url));
    expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([188, 431]);
    const paths = [
      ["start", "E1", "A1", "merge1", "E2", "A2left", "merge2", "end"],
      ["start", "E1", "merge1", "E2", "A2right", "merge2", "end"],
    ];
    const statements = ["A1", "A2left", "A2right"];
    const branches = ["E1-A1", "E1-merge1", "E2-A2left", "E2-A2right"];
    expect(paths.every((path) => !statements.every((statement) => path.includes(statement)))).toBe(true);
    expect(statements.every((statement) => paths.some((path) => path.includes(statement)))).toBe(true);
    const covered = new Set(paths.flatMap((path) => path.slice(1).map((node, index) => `${path[index]}-${node}`)));
    expect(branches.every((branch) => covered.has(branch))).toBe(true);
    for (const url of ["/questions/istqb-foundation/../secret.png", "https://example.com/graph.png",
      "/questions/istqb-foundation/testentwurf-005.png", "/questions/istqb-foundation/prozess-1.png"]) {
      expect(() => parseScreenshotQuestions({
        version: 1, questions: [{ ...graph, image: { ...graph.image, url } }],
      }, 3)).toThrow();
    }
  });

  it("validates static-test chapter, objective, K level and answer before database access", async () => {
    expect(() => parseScreenshotQuestions(staticBank)).toThrow();
    const original = staticQuestions.find((question) => question.usage === "both")!;
    for (const metadata of [
      { ...original.metadata, chapter: 4 }, { ...original.metadata, learningObjective: "FL-3.9.9" },
      { ...original.metadata, learningObjective: "FL-4.3.2" }, { ...original.metadata, kLevel: "K3" },
    ]) {
      await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, undefined, undefined,
        { version: 1, questions: [{ ...original, metadata }] })).rejects.toThrow();
    }
    await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, undefined, undefined,
      { version: 1, questions: [{ ...original, correctOptionIds: ["missing-option"] }] })).rejects.toThrow();
    expect(database.connect).not.toHaveBeenCalled();
  });

  it("replaces chapter three only, preserves two current exam fallbacks and 100 exact blueprint draws", () => {
    const before = replaceScreenshotChapter(replaceScreenshotChapter(replaceScreenshotChapter(replaceScreenshotChapter(
      replaceScreenshotChapter(questions, questions, screenshotQuestions), questions, toolsQuestions, 6,
    ), questions, managementQuestions, 5), questions, designQuestions, 4), questions, lifecycleQuestions, 2);
    const replacement = replaceScreenshotChapter(before, questions, staticQuestions, 3);
    expect(replacement.filter((q) => q.metadata?.chapter !== 3)).toEqual(before.filter((q) => q.metadata?.chapter !== 3));
    expect(replacement.filter((q) => q.id.startsWith("ctfl-statisch-"))).toEqual(staticQuestions);
    expect(replacement).toHaveLength(379);
    expect(replacement.filter((q) => q.usage !== "exam")).toHaveLength(379);
    const sharedFallbacks = replacement.filter((q) => q.id.startsWith("ctfl-de-"));
    expect(sharedFallbacks).toHaveLength(33);
    expect(sharedFallbacks.every((q) => q.usage === "both")).toBe(true);
    expect(staticQuestions.filter((q) => q.usage === "both")).toHaveLength(12);
    expect(sharedFallbacks.filter((q) => q.metadata?.chapter === 3).map((q) => q.id))
      .toEqual(["ctfl-de-032", "ctfl-de-034"]);
    expect(replaceScreenshotChapter(replacement, questions, staticQuestions, 3)).toEqual(replacement);
    for (let index = 0; index < 100; index++) {
      const exam = selectCtflExam({ ...coursesData[1], questions: replacement });
      expect(exam.questions).toHaveLength(40);
      expect(new Set(exam.questions.map((q) => q.id)).size).toBe(40);
      expect(exam.questions.every((q) => q.usage !== "practice")).toBe(true);
      expect([1, 2, 3, 4, 5, 6].map((chapter) => exam.questions.filter((q) => q.metadata?.chapter === chapter).length))
        .toEqual([8, 6, 4, 11, 9, 2]);
      expect(["K1", "K2", "K3"].map((level) => exam.questions.filter((q) => q.metadata?.kLevel === level).length))
        .toEqual([8, 24, 8]);
    }
  });

  it("imports static tests alone and all six chapters atomically and idempotently", async () => {
    const before = replaceScreenshotChapter(replaceScreenshotChapter(replaceScreenshotChapter(replaceScreenshotChapter(
      replaceScreenshotChapter(questions, questions, screenshotQuestions), questions, toolsQuestions, 6,
    ), questions, managementQuestions, 5), questions, designQuestions, 4), questions, lifecycleQuestions, 2);
    const replacement = replaceScreenshotChapter(before, questions, staticQuestions, 3);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: before }] });
    await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, undefined, undefined, staticBank))
      .resolves.toEqual({ questionCount: 379, changed: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"),
      ["existing-course", JSON.stringify(replacement)]);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions }] });
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank, designBank, lifecycleBank, staticBank))
      .resolves.toEqual({ questionCount: 379, changed: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"),
      ["existing-course", JSON.stringify(replacement)]);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: replacement }] });
    client.query.mockClear();
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank, designBank, lifecycleBank, staticBank))
      .resolves.toEqual({ questionCount: 379, changed: false });
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false);
  });

  it("rolls back static-test import failures and releases the connection", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("UPDATE")) throw new Error("static write failed");
      return { rows: sql.startsWith("SELECT") ? [{ id: "existing-course", questions }] : [] };
    });
    await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, undefined, undefined, staticBank))
      .rejects.toThrow("static write failed");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("accounts for all 94 lifecycle captures, 93 candidates, one duplicate and no invented question 37", () => {
    const review = z.object({
      sourceScreenshotCount: z.literal(94), sourceQuestionCount: z.literal(93),
      reviewedSyllabus: z.literal("CTFL 4.0.2 DE (01.03.2025)"),
      duplicates: z.array(z.object({ sourceNumber: z.number(), file: z.string(), duplicateOf: z.string() })),
      excludedQuestions: z.array(z.object({
        id: z.string(), reason: z.string().min(20), syllabusSections: z.array(z.string()).min(1),
      })),
      sourceRecords: z.array(z.object({
        file: z.string(), id: z.string(), disposition: z.enum(["active", "excluded", "duplicate"]),
      })),
    }).parse(lifecycleBank);
    expect(lifecycleQuestions).toHaveLength(60);
    expect(review.excludedQuestions).toHaveLength(33);
    expect(review.duplicates).toHaveLength(1);
    expect(review.duplicates[0].sourceNumber).toBe(36);
    expect(review.sourceRecords).toHaveLength(94);
    expect(new Set(review.sourceRecords.map((record) => record.file)).size).toBe(94);
    expect(new Set(review.sourceRecords.map((record) => record.id)).size).toBe(93);
    expect(review.sourceRecords.filter((record) => record.disposition === "active").map((record) => record.id).sort())
      .toEqual(lifecycleQuestions.map((question) => question.id).sort());
    expect(review.sourceRecords.filter((record) => record.disposition === "excluded").map((record) => record.id).sort())
      .toEqual(review.excludedQuestions.map((question) => question.id).sort());
    expect(review.sourceRecords.some((record) => record.id === "ctfl-lebenszyklus-037")).toBe(false);
    const excluded = new Set(review.excludedQuestions.map((question) => question.id));
    expect(lifecycleQuestions.every((question) => !excluded.has(question.id))).toBe(true);
  });

  it("uses the four yellow-box lifecycle keys and distinguishes the derived graph answer", () => {
    const confirmations = z.object({
      confirmedAnswers: z.record(z.string(), z.object({ answer: z.string() })),
      derivedAnswers: z.record(z.string(), z.object({ answer: z.string(), source: z.string() })),
    }).parse(lifecycleBank);
    expect(Object.keys(confirmations.confirmedAnswers).sort()).toEqual(["10", "53", "71", "78"]);
    for (const [number, text] of [
      ["010", "2"], ["053", "1, 2, 3, 5"],
      ["071", "A, B, C und D sind korrekt"], ["078", "B, C und D sind richtig"],
      ["015", "A-a-E"],
    ]) {
      const question = lifecycleQuestions.find((q) => q.id === `ctfl-lebenszyklus-${number}`)!;
      expect(question.correctOptionIds).toEqual([`${question.id}-b`]);
      expect(question.options.find((option) => option.id === question.correctOptionIds[0])?.text).toBe(text);
      expect(question.usage).toBe("practice");
    }
    expect(confirmations.derivedAnswers["15"].source).toContain("Keine gelbe");
    const graph = lifecycleQuestions.find((q) => q.id === "ctfl-lebenszyklus-015")!;
    const edges = ["A-a", "a-b", "a-c", "a-d", "a-E", "b-a", "b-c", "c-d", "d-E"];
    const traversed = new Set(["A-a-b-a-c-d-E", "A-a-b-c-d-E", "A-a-b-a-d-E"].flatMap((path) => {
      const nodes = path.split("-");
      return nodes.slice(1).map((node, index) => `${nodes[index]}-${node}`);
    }));
    expect(edges.filter((edge) => !traversed.has(edge))).toEqual(["a-E"]);
    expect(graph.explanation).toContain("Nur a→E fehlt");
  });

  it("ships the original lifecycle graph and restricts chapter two image paths", async () => {
    const illustrated = lifecycleQuestions.filter((question) => question.image);
    expect(illustrated).toHaveLength(1);
    const graph = illustrated[0];
    const data = await readFile(new URL(`../../../web/public${graph.image!.url}`, import.meta.url));
    expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([557, 444]);
    for (const url of ["/questions/istqb-foundation/../secret.png", "https://example.com/graph.png",
      "/questions/istqb-foundation/testentwurf-015.png", "/questions/istqb-foundation/prozess-1.png"]) {
      expect(() => parseScreenshotQuestions({
        version: 1, questions: [{ ...graph, image: { ...graph.image, url } }],
      }, 2)).toThrow();
    }
  });

  it("validates lifecycle objectives, K levels, chapter and answers before connecting", async () => {
    expect(() => parseScreenshotQuestions(lifecycleBank)).toThrow();
    const original = lifecycleQuestions.find((question) => question.usage === "both")!;
    for (const metadata of [
      { ...original.metadata, chapter: 4 }, { ...original.metadata, learningObjective: "FL-2.9.9" },
      { ...original.metadata, learningObjective: "FL-4.3.2" }, { ...original.metadata, kLevel: "K3" },
    ]) {
      await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, undefined,
        { version: 1, questions: [{ ...original, metadata }] })).rejects.toThrow();
    }
    await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, undefined,
      { version: 1, questions: [{ ...original, correctOptionIds: ["missing-option"] }] })).rejects.toThrow();
    expect(database.connect).not.toHaveBeenCalled();
  });

  it("replaces chapter two only, retains three current exam fallbacks and preserves 100 exact exam draws", () => {
    const before = replaceScreenshotChapter(replaceScreenshotChapter(replaceScreenshotChapter(
      replaceScreenshotChapter(questions, questions, screenshotQuestions), questions, toolsQuestions, 6,
    ), questions, managementQuestions, 5), questions, designQuestions, 4);
    const replacement = replaceScreenshotChapter(before, questions, lifecycleQuestions, 2);
    expect(replacement.filter((q) => q.metadata?.chapter !== 2)).toEqual(before.filter((q) => q.metadata?.chapter !== 2));
    expect(replacement.filter((q) => q.id.startsWith("ctfl-lebenszyklus-"))).toEqual(lifecycleQuestions);
    expect(replacement).toHaveLength(354);
    expect(replacement.filter((q) => q.usage !== "exam")).toHaveLength(354);
    expect(lifecycleQuestions.filter((q) => q.usage === "both")).toHaveLength(34);
    expect(replacement.filter((q) => q.metadata?.chapter === 2 && q.id.startsWith("ctfl-de-")).map((q) => q.id))
      .toEqual(["ctfl-de-028", "ctfl-de-029", "ctfl-de-030"]);
    expect(replaceScreenshotChapter(replacement, questions, lifecycleQuestions, 2)).toEqual(replacement);
    for (let index = 0; index < 100; index++) {
      const exam = selectCtflExam({ ...coursesData[1], questions: replacement });
      expect(exam.questions).toHaveLength(40);
      expect(new Set(exam.questions.map((q) => q.id)).size).toBe(40);
      expect(exam.questions.every((q) => q.usage !== "practice")).toBe(true);
      expect([1, 2, 3, 4, 5, 6].map((chapter) => exam.questions.filter((q) => q.metadata?.chapter === chapter).length))
        .toEqual([8, 6, 4, 11, 9, 2]);
      expect(["K1", "K2", "K3"].map((level) => exam.questions.filter((q) => q.metadata?.kLevel === level).length))
        .toEqual([8, 24, 8]);
    }
  });

  it("imports lifecycle alone and all five chapters atomically and idempotently", async () => {
    const before = replaceScreenshotChapter(replaceScreenshotChapter(replaceScreenshotChapter(
      replaceScreenshotChapter(questions, questions, screenshotQuestions), questions, toolsQuestions, 6,
    ), questions, managementQuestions, 5), questions, designQuestions, 4);
    const replacement = replaceScreenshotChapter(before, questions, lifecycleQuestions, 2);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: before }] });
    await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, undefined, lifecycleBank))
      .resolves.toEqual({ questionCount: 354, changed: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"),
      ["existing-course", JSON.stringify(replacement)]);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions }] });
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank, designBank, lifecycleBank))
      .resolves.toEqual({ questionCount: 354, changed: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"),
      ["existing-course", JSON.stringify(replacement)]);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: replacement }] });
    client.query.mockClear();
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank, designBank, lifecycleBank))
      .resolves.toEqual({ questionCount: 354, changed: false });
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false);
  });

  it("rolls back lifecycle write failures and releases the connection", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("UPDATE")) throw new Error("write failed");
      return { rows: sql.startsWith("SELECT") ? [{ id: "existing-course", questions }] : [] };
    });
    await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, undefined, lifecycleBank))
      .rejects.toThrow("write failed");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("accounts for all design screenshots, exclusions, duplicate numbers and the additional decision table", () => {
    const review = z.object({
      sourceQuestionCount: z.literal(121),
      sourceScreenshotCount: z.literal(123),
      additionalQuestionScreenshotCount: z.literal(1),
      reviewedSyllabus: z.literal("CTFL 4.0.2 DE (01.03.2025)"),
      duplicates: z.array(z.object({ file: z.string(), duplicateOf: z.string() })),
      excludedQuestions: z.array(z.object({
        id: z.string(), reason: z.string().min(20), syllabusSections: z.array(z.string()).min(1),
      })),
      sourceRecords: z.array(z.object({
        file: z.string(), id: z.string().optional(), disposition: z.enum(["active", "excluded", "duplicate"]),
      })),
    }).parse(designBank);
    expect(designQuestions).toHaveLength(87);
    expect(review.excludedQuestions).toHaveLength(34);
    expect(review.duplicates).toHaveLength(2);
    expect(review.sourceRecords).toHaveLength(124);
    expect(new Set(review.sourceRecords.map((record) => record.file)).size).toBe(124);
    expect(designQuestions.length + review.excludedQuestions.length).toBe(review.sourceQuestionCount);
    expect(review.sourceRecords.filter((record) => record.disposition === "active").map((record) => record.id).sort())
      .toEqual(designQuestions.map((question) => question.id).sort());
    for (const excluded of review.excludedQuestions) {
      expect(designQuestions.some((question) => question.id === excluded.id)).toBe(false);
    }
    expect(designQuestions.find((q) => q.id === "ctfl-testentwurf-011")?.question).toContain("Struktur");
    expect(designQuestions.find((q) => q.id === "ctfl-testentwurf-123")?.question).toContain("Bonus");
    expect(designQuestions.find((q) => q.id === "ctfl-testentwurf-122")?.question).toContain("alle Aktionen");
    expect(designQuestions.some((q) => q.id === "ctfl-testentwurf-029")).toBe(false);
    expect(designQuestions.some((q) => q.id === "ctfl-testentwurf-069")).toBe(false);
    expect(designQuestions.some((q) => q.id === "ctfl-testentwurf-121")).toBe(false);
  });

  it("retains the fourteen active original solutions from yellow boxes, not incorrect selected answers", () => {
    const expected: Record<string, [string, string]> = {
      "002": ["c", "R1 > R2 > R4 > R5 > R3 > R7 > R8 > R9 > R6."],
      "007": ["d", "Nur B ist wahr; A, C und D sind falsch."],
      "022": ["a", "Entscheidungstabellen"],
      "032": ["c", "A, B, E, B, F"],
      "048": ["a", "Alle"],
      "066": ["a", "Eine Einheit oder ein Ereignis, welche bzw. welches durch einen oder mehrere Testfälle verifiziert werden kann."],
      "076": ["b", "a, b, f, g, h, d, e"],
      "083": ["a", "Die Testfälle decken sowohl gültige und ungültige Übergänge des Zustandsübergangsdiagramms ab."],
      "084": ["c", "Die Testfälle decken alle möglichen einzelnen Übergänge des Zustandsübergangsdiagramms ab."],
      "089": ["d", "B, C, D"],
      "093": ["a", "I, II, IV"],
      "115": ["a", "Vier"],
      "117": ["a", "1 Testfall"],
      "122": ["a", "3"],
    };
    const confirmed = z.object({ confirmedAnswers: z.record(z.string(), z.unknown()) }).parse(designBank);
    expect(Object.keys(confirmed.confirmedAnswers)).toHaveLength(Object.keys(expected).length);
    for (const [number, [key, text]] of Object.entries(expected)) {
      const question = designQuestions.find((q) => q.id === `ctfl-testentwurf-${number}`)!;
      expect(question.correctOptionIds).toEqual([`${question.id}-${key}`]);
      expect(question.options.find((option) => option.id === question.correctOptionIds[0])?.text).toBe(text);
    }
    expect(designQuestions.find((q) => q.id === "ctfl-testentwurf-035")?.correctOptionIds)
      .toEqual(["ctfl-testentwurf-035-d"]);
    expect(designQuestions.find((q) => q.id === "ctfl-testentwurf-011")?.correctOptionIds)
      .toEqual(["ctfl-testentwurf-011-b"]);
    expect(designQuestions.find((q) => q.id === "ctfl-testentwurf-031")?.correctOptionIds)
      .toEqual(["ctfl-testentwurf-031-d"]);
    expect(designQuestions.find((q) => q.id === "ctfl-testentwurf-031")?.question)
      .toContain("Test A: A, B, D, E, G");
    for (const number of ["007", "022", "066", "083", "089", "093", "115", "122"]) {
      expect(designQuestions.find((q) => q.id === `ctfl-testentwurf-${number}`)?.usage).toBe("practice");
    }
  });

  it("includes the existing decision tables for the backshop and hairdresser without revealing the new rule", () => {
    for (const number of ["017", "046"]) {
      const question = designQuestions.find((q) => q.id === `ctfl-testentwurf-${number}`)!;
      expect(question.image?.url).toBe(`/questions/istqb-foundation/testentwurf-${number}.png`);
      expect(question.image?.alt).toContain("Bisherige Entscheidungstabelle: Regeln 1 bis 4");
      expect(question.image?.alt).not.toMatch(/Legende|Regel 5|Back-Genuss|elften/);
      expect(question.options.find((option) => option.id === question.correctOptionIds[0])?.text).toBe("1");
    }
  });

  it("ships all sixteen diagrams and tables as real PNGs without allowing arbitrary asset paths", async () => {
    const illustrated = designQuestions.filter((question) => question.image);
    expect(illustrated).toHaveLength(16);
    for (const question of illustrated) {
      const image = question.image!;
      expect(image.url).toBe(`/questions/istqb-foundation/testentwurf-${question.id.slice(-3)}.png`);
      const data = await readFile(new URL(`../../../web/public${image.url}`, import.meta.url));
      expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(data.readUInt32BE(16)).toBeGreaterThan(100);
      expect(data.readUInt32BE(20)).toBeGreaterThan(100);
      expect(image.alt.length).toBeGreaterThan(20);
    }
    const original = illustrated[0];
    for (const url of ["/questions/istqb-foundation/../secret.png", "https://example.com/figure.png",
      "/questions/istqb-foundation/prozess-1.png"]) {
      expect(() => parseScreenshotQuestions({
        version: 1, questions: [{ ...original, image: { ...original.image, url } }],
      }, 4)).toThrow();
    }
  });

  it("validates chapter four learning objectives and K levels before database access", async () => {
    expect(() => parseScreenshotQuestions(designBank)).toThrow();
    expect(() => parseScreenshotQuestions(designBank, 5)).toThrow();
    const original = designQuestions.find((q) => q.usage === "both" && q.metadata?.kLevel === "K3")!;
    for (const metadata of [
      { ...original.metadata, chapter: 5 },
      { ...original.metadata, learningObjective: "FL-4.9.9" },
      { ...original.metadata, learningObjective: "FL-5.1.5" },
      { ...original.metadata, kLevel: "K2" },
    ]) {
      await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, {
        version: 1, questions: [{ ...original, metadata }],
      })).rejects.toThrow();
    }
    expect(database.connect).not.toHaveBeenCalled();
    const duplicate = { ...original, id: "ctfl-testentwurf-999", options: [...original.options].reverse() };
    expect(parseScreenshotQuestions({ version: 1, questions: [original, duplicate] }, 4)).toEqual([original]);
    const wrongAnswer = original.options.find((option) => option.id !== original.correctOptionIds[0])!;
    expect(() => parseScreenshotQuestions({
      version: 1, questions: [original, { ...duplicate, correctOptionIds: [wrongAnswer.id] }],
    }, 4)).toThrow(/Widersprüchliche/);
  });

  it("replaces only chapter four practice content and preserves six current exam fallbacks and the exact blueprint", () => {
    const before = replaceScreenshotChapter(replaceScreenshotChapter(
      replaceScreenshotChapter(questions, questions, screenshotQuestions), questions, toolsQuestions, 6,
    ), questions, managementQuestions, 5);
    const replacement = replaceScreenshotChapter(before, questions, designQuestions, 4);
    expect(replacement.filter((q) => q.metadata?.chapter !== 4)).toEqual(before.filter((q) => q.metadata?.chapter !== 4));
    expect(replacement.filter((q) => q.id.startsWith("ctfl-testentwurf-"))).toEqual(designQuestions);
    expect(replacement).toHaveLength(303);
    expect(replacement.filter((q) => q.usage !== "exam")).toHaveLength(303);
    expect(designQuestions.filter((q) => q.usage === "both")).toHaveLength(36);
    expect(replacement.filter((q) => q.metadata?.chapter === 4 && q.id.startsWith("ctfl-de-")).map((q) => q.id))
      .toEqual(["ctfl-de-053", "ctfl-de-055", "ctfl-de-057", "ctfl-de-058", "ctfl-de-059", "ctfl-de-060"]);
    expect(replaceScreenshotChapter(replacement, questions, designQuestions, 4)).toEqual(replacement);
    for (let index = 0; index < 100; index++) {
      const exam = selectCtflExam({ ...coursesData[1], questions: replacement });
      expect(exam.questions).toHaveLength(40);
      expect(new Set(exam.questions.map((q) => q.id)).size).toBe(40);
      expect(exam.questions.every((q) => q.usage !== "practice")).toBe(true);
      expect([1, 2, 3, 4, 5, 6].map((chapter) => exam.questions.filter((q) => q.metadata?.chapter === chapter).length))
        .toEqual([8, 6, 4, 11, 9, 2]);
      expect(["K1", "K2", "K3"].map((level) => exam.questions.filter((q) => q.metadata?.kLevel === level).length))
        .toEqual([8, 24, 8]);
    }
  });

  it("imports design alone and all four screenshot chapters atomically and idempotently", async () => {
    const before = replaceScreenshotChapter(replaceScreenshotChapter(
      replaceScreenshotChapter(questions, questions, screenshotQuestions), questions, toolsQuestions, 6,
    ), questions, managementQuestions, 5);
    const replacement = replaceScreenshotChapter(before, questions, designQuestions, 4);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: before }] });
    await expect(importIstqbQuestions(database, markdown, undefined, undefined, undefined, designBank))
      .resolves.toEqual({ questionCount: 303, changed: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"),
      ["existing-course", JSON.stringify(replacement)]);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions }] });
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank, designBank))
      .resolves.toEqual({ questionCount: 303, changed: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"),
      ["existing-course", JSON.stringify(replacement)]);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: replacement }] });
    client.query.mockClear();
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank, designBank))
      .resolves.toEqual({ questionCount: 303, changed: false });
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false);
  });

  it("accounts for every removed screenshot and excludes obsolete syllabus content from all active banks", () => {
    const reviewSchema = z.object({
      reviewedSyllabus: z.literal("CTFL 4.0.2 DE (01.03.2025)"),
      sourceQuestionCount: z.number(),
      confirmedAnswers: z.record(z.string(), z.unknown()),
      excludedQuestions: z.array(z.object({
        id: z.string(),
        sourceNumber: z.number(),
        reason: z.string().min(20),
        syllabusSections: z.array(z.string()).min(1),
      })),
    });
    for (const [bank, active, excludedCount] of [
      [screenshotBank, screenshotQuestions, 57],
      [managementBank, managementQuestions, 25],
      [toolsBank, toolsQuestions, 15],
    ] as const) {
      const review = reviewSchema.parse(bank);
      const excludedIds = review.excludedQuestions.map((q) => q.id);
      expect(excludedIds).toHaveLength(excludedCount);
      expect(new Set(excludedIds).size).toBe(excludedCount);
      expect(active.length + excludedCount).toBe(review.sourceQuestionCount);
      expect(active.every((q) => !excludedIds.includes(q.id))).toBe(true);
      expect(active.every((q) => !/fundamentalen? Testprozess|IEEE[- ]?829|ISO[- ]?9126/i.test(q.question))).toBe(true);
      for (const number of Object.keys(review.confirmedAnswers)) {
        expect(active.some((q) => Number(q.id.slice(-3)) === Number(number))).toBe(true);
      }
    }
    expect(screenshotBank).toMatchObject({
      excludedQuestions: expect.arrayContaining([
        expect.objectContaining({ sourceNumber: 149, originalConfirmation: { answer: "Szenarien", source: expect.any(String), examEligible: false } }),
      ]),
    });
    expect(toolsBank).toMatchObject({
      excludedQuestions: expect.arrayContaining([
        expect.objectContaining({ sourceNumber: 35, originalConfirmation: { answer: "1. 2. 6.", source: "Vom Benutzer bereitgestellte Originalauflösung" } }),
      ]),
    });
  });

  it("removes stale historical questions on a complete import without reintroducing them on repetition", async () => {
    const current = replaceScreenshotChapter(
      replaceScreenshotChapter(
        replaceScreenshotChapter(questions, questions, screenshotQuestions), questions, toolsQuestions, 6,
      ), questions, managementQuestions, 5,
    );
    const stale = [
      { ...screenshotQuestions[0], id: "ctfl-grundlagen-149" },
      { ...managementQuestions[0], id: "ctfl-testmanagement-059" },
      { ...toolsQuestions[0], id: "ctfl-testwerkzeuge-018" },
    ];
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: [...current, ...stale] }] });
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank))
      .resolves.toEqual({ questionCount: 236, changed: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"),
      ["existing-course", JSON.stringify(current)]);
    expect(current.filter((q) => q.usage !== "exam")).toHaveLength(236);
    expect(current.filter((q) => q.metadata?.chapter === 1 && q.id.startsWith("ctfl-de-"))).toHaveLength(8);
    expect(current.filter((q) => q.metadata?.chapter === 5 && q.id.startsWith("ctfl-de-"))).toHaveLength(14);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: current }] });
    client.query.mockClear();
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank))
      .resolves.toEqual({ questionCount: 236, changed: false });
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false);
  });

  it("imports only current management questions and preserves retained yellow-box solutions", () => {
    expect(managementQuestions).toHaveLength(47);
    const keys = "A D D A A C B A B A D C A D B A B B A B A D A B D C C A B A C D A B A C C A D A C B C C D A C D D D A D B C A D C D D C C A D C D D C C D D D B".split(" ");
    expect(keys).toHaveLength(72);
    for (const question of managementQuestions) {
      const sourceNumber = Number(question.id.slice(-3));
      expect(question.correctOptionIds).toEqual([`${question.id}-${keys[sourceNumber - 1].toLowerCase()}`]);
      expect(question.options).toHaveLength(4);
      expect(question.options.every((option) => option.text.trim().length > 0)).toBe(true);
      expect(question.metadata).toMatchObject({ chapter: 5, chapterTitle: "Testmanagement" });
      expect(question.explanation).toContain("Quelle: Basiswissen Softwaretest");
      expect(question.metadata?.kLevel).not.toBe("K3");
    }
    const confirmed: Record<string, [string, string]> = {
      "014": ["d", "A, B, D und E"],
      "046": ["a", "Der Testmanager plant, organisiert und steuert die Testaktivitäten, während der Tester Testfälle spezifiziert, automatisiert und ausführt."],
    };
    for (const [number, [key, text]] of Object.entries(confirmed)) {
      const question = managementQuestions.find((q) => q.id === `ctfl-testmanagement-${number}`)!;
      expect(question.correctOptionIds).toEqual([`${question.id}-${key}`]);
      expect(question.options.find((option) => option.id === question.correctOptionIds[0])?.text).toBe(text);
      expect(question.explanation).toContain("gelben Originalauflösungsbox");
      expect(question.usage).toBe("practice");
    }
    expect(managementQuestions.filter((q) => q.usage === "both")).toHaveLength(22);
    expect(managementBank).toMatchObject({ sourceQuestionCount: 72, missingSourceNumbers: [], duplicates: [] });
  });

  it("validates management chapter metadata, exam levels and duplicate solutions", () => {
    expect(() => parseScreenshotQuestions(managementBank)).toThrow();
    expect(() => parseScreenshotQuestions(managementBank, 6)).toThrow();
    const original = managementQuestions.find((q) => q.usage === "both")!;
    for (const metadata of [
      { ...original.metadata, chapter: 6 },
      { ...original.metadata, learningObjective: "FL-5.9.9" },
      { ...original.metadata, learningObjective: "FL-1.1.1" },
      { ...original.metadata, kLevel: "K3" },
    ]) {
      expect(() => parseScreenshotQuestions({ version: 1, questions: [{ ...original, metadata }] }, 5)).toThrow();
    }
    const duplicate = { ...original, id: "ctfl-testmanagement-999", options: [...original.options].reverse() };
    expect(parseScreenshotQuestions({ version: 1, questions: [original, duplicate] }, 5)).toEqual([original]);
    expect(() => parseScreenshotQuestions({
      version: 1, questions: [original, { ...duplicate, correctOptionIds: [original.options[0].id] }],
    }, 5)).toThrow(/Widersprüchliche/);
  });

  it("replaces only chapter five practice questions while retaining required exam objectives and K3 tasks", () => {
    const withOtherChapters = replaceScreenshotChapter(
      replaceScreenshotChapter(questions, questions, screenshotQuestions), questions, toolsQuestions, 6,
    );
    const replacement = replaceScreenshotChapter(withOtherChapters, questions, managementQuestions, 5);
    expect(replacement.filter((q) => q.metadata?.chapter !== 5))
      .toEqual(withOtherChapters.filter((q) => q.metadata?.chapter !== 5));
    expect(replacement.filter((q) => q.id.startsWith("ctfl-testmanagement-"))).toEqual(managementQuestions);
    const fallbacks = replacement.filter((q) => q.metadata?.chapter === 5 && q.id.startsWith("ctfl-de-"));
    expect(fallbacks).toHaveLength(14);
    expect(fallbacks.filter((q) => q.metadata?.kLevel === "K3")).toHaveLength(7);
    expect(fallbacks.every((q) => !managementQuestions.some(
      (newQuestion) => newQuestion.usage === "both" &&
        newQuestion.metadata?.learningObjective === q.metadata?.learningObjective,
    ))).toBe(true);
    expect(replaceScreenshotChapter(replacement, questions, managementQuestions, 5)).toEqual(replacement);
    expect(replacement).toHaveLength(236);
    for (let index = 0; index < 100; index++) {
      const exam = selectCtflExam({ ...coursesData[1], questions: replacement });
      expect(exam.questions).toHaveLength(40);
      expect(new Set(exam.questions.map((q) => q.id)).size).toBe(40);
      expect(exam.questions.every((q) => q.usage !== "practice")).toBe(true);
      expect([1, 2, 3, 4, 5, 6].map((chapter) => exam.questions.filter((q) => q.metadata?.chapter === chapter).length))
        .toEqual([8, 6, 4, 11, 9, 2]);
      expect(["K1", "K2", "K3"].map((level) => exam.questions.filter((q) => q.metadata?.kLevel === level).length))
        .toEqual([8, 24, 8]);
    }
  });

  it("imports management alone or all three chapters atomically and repeats without writes", async () => {
    const withOtherChapters = replaceScreenshotChapter(
      replaceScreenshotChapter(questions, questions, screenshotQuestions), questions, toolsQuestions, 6,
    );
    const replacement = replaceScreenshotChapter(withOtherChapters, questions, managementQuestions, 5);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: withOtherChapters }] });
    await expect(importIstqbQuestions(database, markdown, undefined, undefined, managementBank))
      .resolves.toEqual({ questionCount: 236, changed: true });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"),
      ["existing-course", JSON.stringify(replacement)]);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: questions }] });
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank))
      .resolves.toEqual({ questionCount: 236, changed: true });
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: replacement }] });
    client.query.mockClear();
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank, managementBank))
      .resolves.toEqual({ questionCount: 236, changed: false });
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false);
    database.connect.mockClear();
    await expect(importIstqbQuestions(database, markdown, undefined, undefined, { version: 1, questions: [] }))
      .rejects.toThrow();
    expect(database.connect).not.toHaveBeenCalled();
  });

  it("imports current tools questions with stable keys and correct exam mappings", () => {
    expect(toolsQuestions).toHaveLength(28);
    const keys = "C C A D B D C D A D C B A C A A D A A A D A A A D C B B B A D D A B D C B A B A A A C".split(" ");
    for (const question of toolsQuestions) {
      const sourceNumber = Number(question.id.slice(-3));
      expect(question.correctOptionIds).toEqual([`${question.id}-${keys[sourceNumber - 1].toLowerCase()}`]);
      expect(question.metadata?.chapter).toBe(6);
      expect(question.metadata?.chapterTitle).toBe("Testwerkzeuge");
      if (question.usage === "both") {
        expect(question.metadata).toMatchObject(question.metadata?.learningObjective === "FL-6.2.1"
          ? { learningObjective: "FL-6.2.1", kLevel: "K1" }
          : { learningObjective: "FL-6.1.1", kLevel: "K2" });
      }
    }
    expect(toolsQuestions.filter((question) => question.usage === "both")).toHaveLength(22);
    expect(toolsQuestions.find((q) => q.id === "ctfl-testwerkzeuge-038")?.question).toContain("H: Überdeckungsanalyse");
    expect(toolsQuestions.some((q) => q.id === "ctfl-testwerkzeuge-015")).toBe(true);
    expect(toolsQuestions.some((q) => q.id === "ctfl-testwerkzeuge-016")).toBe(true);
  });

  it("validates the selected screenshot chapter and rejects incompatible tools exam mappings", () => {
    expect(() => parseScreenshotQuestions(toolsBank)).toThrow();
    expect(() => parseScreenshotQuestions(screenshotBank, 6)).toThrow();
    const original = toolsQuestions.find((question) => question.usage === "both")!;
    for (const metadata of [
      { ...original.metadata, learningObjective: "FL-1.1.1" },
      { ...original.metadata, kLevel: "K3" },
      { ...original.metadata, learningObjective: "FL-6.9.9" },
    ]) {
      expect(() => parseScreenshotQuestions({ version: 1, questions: [{ ...original, metadata }] }, 6)).toThrow();
    }
    const duplicate = {
      ...original, id: "ctfl-testwerkzeuge-999", question: `  ${original.question}  `,
      options: [...original.options].reverse(),
    };
    expect(parseScreenshotQuestions({ version: 1, questions: [original, duplicate] }, 6)).toEqual([original]);
    expect(() => parseScreenshotQuestions({
      version: 1, questions: [original, { ...duplicate, correctOptionIds: [original.options[0].id] }],
    }, 6)).toThrow(/Widersprüchliche/);
  });

  it("replaces chapter six without old tools questions, preserving chapter one and the 40-question blueprint", () => {
    const withFoundation = replaceScreenshotChapter(questions, questions, screenshotQuestions);
    const replacement = replaceScreenshotChapter(withFoundation, questions, toolsQuestions, 6);
    expect(replacement.filter((question) => question.metadata?.chapter !== 6))
      .toEqual(withFoundation.filter((question) => question.metadata?.chapter !== 6));
    expect(replacement.filter((question) => question.metadata?.chapter === 6)).toEqual(toolsQuestions);
    expect(replaceScreenshotChapter(replacement, questions, toolsQuestions, 6)).toEqual(replacement);
    expect(replaceScreenshotChapter(
      replaceScreenshotChapter(replacement, questions, screenshotQuestions), questions, toolsQuestions, 6,
    )).toEqual(replacement);
    for (let index = 0; index < 100; index++) {
      const exam = selectCtflExam({ ...coursesData[1], questions: replacement });
      expect(exam.questions).toHaveLength(40);
      expect(new Set(exam.questions.map((q) => q.id)).size).toBe(40);
      expect(exam.questions.filter((q) => q.metadata?.chapter === 6)).toHaveLength(2);
      expect(exam.questions.filter((q) => q.metadata?.chapter === 6).every(
        (q) => q.id.startsWith("ctfl-testwerkzeuge-") && q.usage === "both",
      )).toBe(true);
      expect([1, 2, 3, 4, 5, 6].map((chapter) => exam.questions.filter((q) => q.metadata?.chapter === chapter).length))
        .toEqual([8, 6, 4, 11, 9, 2]);
      expect(["K1", "K2", "K3"].map((level) => exam.questions.filter((q) => q.metadata?.kLevel === level).length))
        .toEqual([8, 24, 8]);
    }
  });

  it("retains only necessary tools exam fallbacks when a replacement lacks an objective", () => {
    const limited = toolsQuestions.filter((q) => q.metadata?.learningObjective === "FL-6.1.1");
    const replacement = replaceScreenshotChapter(questions, questions, limited, 6);
    const fallbacks = replacement.filter((q) => q.metadata?.chapter === 6 && q.id.startsWith("ctfl-de-"));
    expect(fallbacks).toHaveLength(2);
    expect(fallbacks.every((q) => q.usage === "both")).toBe(true);
    expect(fallbacks.every((q) => q.metadata?.learningObjective === "FL-6.2.1")).toBe(true);
  });

  it("imports both screenshot chapters atomically and is idempotent", async () => {
    const withFoundation = replaceScreenshotChapter(questions, questions, screenshotQuestions);
    const replacement = replaceScreenshotChapter(withFoundation, questions, toolsQuestions, 6);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: withFoundation }] });
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank)).resolves.toEqual({
      questionCount: 197, changed: true,
    });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"),
      ["existing-course", JSON.stringify(replacement)]);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: replacement }] });
    client.query.mockClear();
    await expect(importIstqbQuestions(database, markdown, screenshotBank, toolsBank)).resolves.toEqual({
      questionCount: 197, changed: false,
    });
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false);
  });

  it("supports a targeted tools-only import and rejects invalid tools data before starting a transaction", async () => {
    const withFoundation = replaceScreenshotChapter(questions, questions, screenshotQuestions);
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions: withFoundation }] });
    await expect(importIstqbQuestions(database, markdown, undefined, toolsBank)).resolves.toMatchObject({ changed: true });
    const update = client.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE"))!;
    const saved = JSON.parse(update[1][1]);
    expect(saved.filter((q: { metadata: { chapter: number } }) => q.metadata.chapter === 1))
      .toEqual(withFoundation.filter((q) => q.metadata?.chapter === 1));
    database.connect.mockClear();
    await expect(importIstqbQuestions(database, markdown, screenshotBank, { version: 1, questions: [] })).rejects.toThrow();
    expect(database.connect).not.toHaveBeenCalled();
  });

  it("imports current foundation questions without obsolete process diagrams and preserves retained original keys", async () => {
    expect(screenshotQuestions).toHaveLength(93);
    expect(screenshotQuestions.filter((question) => question.image)).toHaveLength(0);
    expect(screenshotQuestions.filter((question) => question.usage === "both")).toHaveLength(19);
    const solutions: Record<string, string> = {
      "037": "die Anpassung an geänderte Einsatzbedingungen und -erwartungen",
      "054": "hoch kritische Bereiche testen",
    };
    for (const [number, text] of Object.entries(solutions)) {
      const question = screenshotQuestions.find((item) => item.id === `ctfl-grundlagen-${number}`)!;
      expect(question.options.find((option) => question.correctOptionIds.includes(option.id))?.text).toBe(text);
      expect(question.usage).toBe("practice");
    }
    for (const number of ["118", "119", "120"]) {
      expect(screenshotQuestions.some((question) => question.id === `ctfl-grundlagen-${number}`)).toBe(false);
    }
    for (const question of screenshotQuestions) {
      expect(question.metadata?.chapter).toBe(1);
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(question.options.every((option) => option.text.trim().length > 0)).toBe(true);
      if (question.image) {
        const content = await readFile(new URL(`../../../../apps/web/public${question.image.url}`, import.meta.url));
        expect(content.subarray(1, 4).toString()).toBe("PNG");
      }
    }
  });

  it("deduplicates identical content regardless of option order, but preserves different diagrams", () => {
    const original = screenshotQuestions[0];
    const duplicate = {
      ...original, id: "ctfl-grundlagen-999",
      options: [...original.options].reverse().map((option) => ({ ...option, id: `${option.id}-copy` })),
      correctOptionIds: [`${original.correctOptionIds[0]}-copy`],
    };
    expect(parseScreenshotQuestions({ version: 1, questions: [original, duplicate] })).toHaveLength(1);
    expect(() => parseScreenshotQuestions({
      version: 1, questions: [original, { ...duplicate, correctOptionIds: [duplicate.options[0].id] }],
    })).toThrow(/Widersprüchliche/);
    const diagrams = [1, 2, 3].map((number) => ({
      ...original, id: `ctfl-grundlagen-90${number}`,
      image: { url: `/questions/istqb-foundation/prozess-${number}.png`, alt: `Prozessgrafik ${number}` },
    }));
    expect(parseScreenshotQuestions({ version: 1, questions: diagrams })).toHaveLength(3);
    expect(() => parseScreenshotQuestions({ version: 1, questions: [original, original] })).toThrow(/Doppelte/);
  });

  it("replaces only chapter one, retains missing exam objectives and preserves the exact blueprint", () => {
    const replacement = replaceScreenshotChapter(questions, questions, screenshotQuestions);
    expect(replacement.filter((question) => question.id.startsWith("ctfl-grundlagen-"))).toEqual(screenshotQuestions);
    expect(replacement.filter((question) => question.metadata?.chapter !== 1))
      .toEqual(questions.filter((question) => question.metadata?.chapter !== 1));
    const covered = new Set(screenshotQuestions.filter((question) => question.usage === "both")
      .map((question) => question.metadata?.learningObjective));
    const fallbacks = replacement.filter((question) => question.id.startsWith("ctfl-de-") && question.metadata?.chapter === 1);
    expect(fallbacks).toHaveLength(8);
    expect(fallbacks.every((question) => question.usage === "both")).toBe(true);
    expect(fallbacks.every((question) =>
      !covered.has(question.metadata?.learningObjective))).toBe(true);
    for (let index = 0; index < 100; index++) {
      const exam = selectCtflExam({ ...coursesData[1], questions: replacement });
      expect(exam.questions).toHaveLength(40);
      expect(exam.questions.some((question) => question.id.startsWith("ctfl-grundlagen-"))).toBe(true);
      expect(exam.questions.every((question) => question.usage !== "practice")).toBe(true);
      expect([1, 2, 3, 4, 5, 6].map((chapter) => exam.questions.filter((q) => q.metadata?.chapter === chapter).length))
        .toEqual([8, 6, 4, 11, 9, 2]);
      expect(["K1", "K2", "K3"].map((level) => exam.questions.filter((q) => q.metadata?.kLevel === level).length))
        .toEqual([8, 24, 8]);
    }
    expect(replaceScreenshotChapter(replacement, questions, screenshotQuestions)).toEqual(replacement);
  });

  it("persists the chapter replacement atomically without overwriting other chapters", async () => {
    client.query.mockResolvedValue({ rows: [{ id: "existing-course", questions }] });
    const replacement = replaceScreenshotChapter(questions, questions, screenshotQuestions);
    await expect(importIstqbQuestions(database, markdown, screenshotBank)).resolves.toEqual({
      questionCount: replacement.length, changed: true,
    });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set"), ["existing-course", JSON.stringify(replacement)]);
  });

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
