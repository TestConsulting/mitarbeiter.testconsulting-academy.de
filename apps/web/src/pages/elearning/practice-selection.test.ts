import { describe, expect, it, vi } from "vitest";
import type { PracticeQuestion } from "@portal/shared";
import { createPracticeSession, filterPracticeQuestions, type PracticeSelection } from "./practice-selection.js";

const questions: PracticeQuestion[] = Array.from({ length: 30 }, (_, index) => ({
  id: `question-${index}`, question: `Frage ${index}`, type: "single",
  options: [{ id: "a", text: "Antwort A" }, { id: "b", text: "Antwort B" }, { id: "c", text: "Antwort C" }],
  correctOptionIds: ["a"], explanation: "Erklärung",
  metadata: { chapter: index < 15 ? 1 : 2, chapterTitle: "Kapitel",
    learningObjective: "FL-1.1.1", kLevel: (["K1", "K2", "K3"] as const)[index % 3] },
}));
const selection: PracticeSelection = {
  chapters: [1, 2], kLevels: [], limit: 20, errorsOnly: false, examChapterWeighting: false,
};
const allChapters = [1, 2, 3, 4, 5, 6];
const fullPool: PracticeQuestion[] = allChapters.flatMap((chapter) =>
  Array.from({ length: 30 }, (_, index) => ({
    ...questions[index],
    id: `chapter-${chapter}-${index}`,
    metadata: { ...questions[index].metadata!, chapter },
  })));
const chapterCounts = (session: PracticeQuestion[]) => allChapters.map((chapter) =>
  session.filter((question) => question.metadata?.chapter === chapter).length);

describe("practice selection", () => {
  it.each([
    [20, [5, 3, 2, 5, 3, 2]],
    [40, [11, 7, 3, 10, 6, 3]],
  ] as const)("rounds question-pool proportions to exactly %i places", (limit, counts) => {
    const pool = [101, 63, 33, 93, 61, 28].flatMap((size, index) =>
      Array.from({ length: size }, (_, questionIndex) => ({
        ...questions[0], id: `rounded-${index}-${questionIndex}`,
        metadata: { ...questions[0].metadata!, chapter: index + 1 },
      })));
    const original = structuredClone(pool);
    const session = createPracticeSession(pool, [], { ...selection, chapters: allChapters, limit });
    expect(chapterCounts(session)).toEqual(counts);
    expect(new Set(session.map((question) => question.id)).size).toBe(limit);
    expect(pool).toEqual(original);
  });

  it.each([20, 40] as const)("uses filtered question-pool proportions by default for %i questions", (limit) => {
    const sizes = [10, 20, 30, 40, 50, 50];
    const pool = sizes.flatMap((size, index) => Array.from({ length: size }, (_, questionIndex) => ({
      ...questions[0], id: `pool-${index}-${questionIndex}`,
      metadata: { ...questions[0].metadata!, chapter: index + 1 },
    })));
    const progress = pool.map((question) => ({ questionId: question.id, lastCorrect: false }));
    for (let run = 0; run < 20; run++) {
      const session = createPracticeSession([...pool, ...fullPool], progress, {
        ...selection, chapters: allChapters, limit, errorsOnly: true, kLevels: ["K1"],
      });
      expect(chapterCounts(session)).toEqual(sizes.map((size) => size * limit / 200));
      expect(new Set(session.map((question) => question.id)).size).toBe(limit);
      expect(session.every((question) => question.id.startsWith("pool-"))).toBe(true);
    }
  });

  it.each([
    [20, [4, 3, 2, 6, 4, 1]],
    [40, [8, 6, 4, 11, 9, 2]],
  ] as const)("uses CTFL chapter proportions for %i questions with all chapters selected", (limit, counts) => {
    const original = structuredClone(fullPool);
    for (let run = 0; run < 50; run++) {
      const session = createPracticeSession(fullPool, [], {
        ...selection, chapters: [...allChapters].reverse(), limit, examChapterWeighting: true,
      });
      expect(chapterCounts(session)).toEqual(counts);
      expect(new Set(session.map((question) => question.id)).size).toBe(limit);
    }
    expect(fullPool).toEqual(original);
  });

  it("keeps all matching questions without quotas when all available questions are requested", () => {
    const session = createPracticeSession(fullPool, [], { ...selection, chapters: allChapters, limit: "all" });
    expect(session).toHaveLength(180);
    expect(chapterCounts(session)).toEqual([30, 30, 30, 30, 30, 30]);
    expect(new Set(session.map((question) => question.id)).size).toBe(180);
  });

  it("ignores exam weighting for all-available sessions and chapter subsets", () => {
    const all = createPracticeSession(fullPool, [], {
      ...selection, chapters: allChapters, limit: "all", examChapterWeighting: true,
    });
    expect(chapterCounts(all)).toEqual([30, 30, 30, 30, 30, 30]);
    const subset = createPracticeSession(fullPool, [], {
      ...selection, chapters: [1, 4], examChapterWeighting: true,
    });
    expect(chapterCounts(subset)).toEqual([10, 0, 0, 10, 0, 0]);
  });

  it.each([false, true])("respects combined filters and shortages with exam weighting %s", (examChapterWeighting) => {
    const progress = fullPool.filter((question) =>
      [1, 4].includes(question.metadata!.chapter) && question.metadata!.kLevel === "K3")
      .map((question) => ({ questionId: question.id, lastCorrect: false }));
    const session = createPracticeSession(fullPool, progress, {
      ...selection, chapters: allChapters, limit: 40, kLevels: ["K3"], errorsOnly: true, examChapterWeighting,
    });
    expect(chapterCounts(session)).toEqual([10, 0, 0, 10, 0, 0]);
    expect(new Set(session.map((question) => question.id)).size).toBe(20);
    expect(session.every((question) => question.metadata!.kLevel === "K3")).toBe(true);
    expect(session.every((question) => progress.some((item) => item.questionId === question.id))).toBe(true);
  });

  it("uses only the selected chapter for a single chapter", () => {
    const session = createPracticeSession(fullPool, [], { ...selection, chapters: [4], limit: 20 });
    expect(chapterCounts(session)).toEqual([0, 0, 0, 20, 0, 0]);
  });

  it.each([20, 40] as const)("balances chapter subsets for %i questions and distributes remainders", (limit) => {
    for (const chapters of [[1, 4], [1, 3, 5], [1, 2, 4, 6], [1, 2, 3, 4, 5]]) {
      for (let run = 0; run < 20; run++) {
        const session = createPracticeSession(fullPool, [], { ...selection, chapters, limit });
        const counts = chapters.map((chapter) => session.filter((q) => q.metadata?.chapter === chapter).length);
        expect(session).toHaveLength(limit);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        expect(session.every((q) => chapters.includes(q.metadata!.chapter))).toBe(true);
        expect(new Set(session.map((q) => q.id)).size).toBe(limit);
      }
    }
  });

  it("fills shortages in equally weighted subsets and leaves all-available sessions uncapped", () => {
    const pool = fullPool.filter((q) => q.metadata?.chapter !== 1 || q.id === "chapter-1-0");
    const session = createPracticeSession(pool, [], { ...selection, chapters: [1, 2], limit: 20 });
    expect(chapterCounts(session)).toEqual([1, 19, 0, 0, 0, 0]);
    const all = createPracticeSession(pool, [], { ...selection, chapters: [1, 2], limit: "all" });
    expect(chapterCounts(all)).toEqual([1, 30, 0, 0, 0, 0]);
  });

  it("preserves filters and fills missing chapter places without repeating or introducing ineligible questions", () => {
    const progress = fullPool.filter((question) =>
      question.metadata?.chapter !== 6 && (question.metadata?.chapter !== 4 || question.id === "chapter-4-0"))
      .map((question) => ({ questionId: question.id, lastCorrect: false }));
    const filteredSelection: PracticeSelection = {
      chapters: allChapters, kLevels: ["K1"], limit: 40, errorsOnly: true, examChapterWeighting: true,
    };
    const eligible = filterPracticeQuestions(fullPool, progress, filteredSelection);
    const session = createPracticeSession(fullPool, progress, filteredSelection);
    expect(session).toHaveLength(40);
    expect(new Set(session.map((question) => question.id)).size).toBe(40);
    expect(session.every((question) => eligible.some((candidate) => candidate.id === question.id))).toBe(true);
    expect(chapterCounts(session)[3]).toBe(1);
    expect(chapterCounts(session)[5]).toBe(0);
    expect(createPracticeSession(fullPool, [], filteredSelection)).toEqual([]);
    const smallProgress = eligible.slice(0, 3).map((question) => ({ questionId: question.id, lastCorrect: false }));
    expect(createPracticeSession(fullPool, smallProgress, filteredSelection)).toHaveLength(3);
  });

  it("prioritizes unseen questions within each chapter quota and while filling shortages", () => {
    const progress = fullPool.filter((question) => Number(question.id.split("-")[2]) >= 15)
      .map((question) => ({ questionId: question.id, lastCorrect: true }));
    const selectionWithQuotas: PracticeSelection = {
      ...selection, chapters: allChapters, limit: 40, examChapterWeighting: true,
    };
    const session = createPracticeSession(fullPool, progress, selectionWithQuotas);
    expect(chapterCounts(session)).toEqual([8, 6, 4, 11, 9, 2]);
    expect(session.every((question) => Number(question.id.split("-")[2]) < 15)).toBe(true);
    const limitedPool = fullPool.filter((question) => question.metadata?.chapter !== 4);
    const filled = createPracticeSession(limitedPool, progress, selectionWithQuotas);
    expect(filled).toHaveLength(40);
    expect(filled.every((question) => Number(question.id.split("-")[2]) < 15)).toBe(true);
  });

  it("combines chapter and K-level filters, with no K-level selection meaning all levels", () => {
    expect(filterPracticeQuestions(questions, [], selection)).toHaveLength(30);
    expect(filterPracticeQuestions(questions, [], { ...selection, chapters: [2], kLevels: ["K3"] }))
      .toHaveLength(5);
    expect(filterPracticeQuestions(questions, [], { ...selection, chapters: [] })).toEqual([]);
    expect(filterPracticeQuestions(questions, [], { ...selection, kLevels: ["K1", "K2"] })).toHaveLength(20);
  });

  it("only repeats the latest incorrect answers within the selected filters", () => {
    const progress = [
      { questionId: "question-0", lastCorrect: false },
      { questionId: "question-1", lastCorrect: true },
      { questionId: "question-16", lastCorrect: false },
    ];
    expect(filterPracticeQuestions(questions, progress, { ...selection, errorsOnly: true })
      .map((question) => question.id)).toEqual(["question-0", "question-16"]);
    expect(filterPracticeQuestions(questions, progress, { ...selection, chapters: [1], errorsOnly: true }))
      .toHaveLength(1);
    expect(createPracticeSession(questions, [], { ...selection, errorsOnly: true })).toEqual([]);
  });

  it("honors 20, 40 and all limits, caps smaller pools, and never repeats a question", () => {
    const largerPool = Array.from({ length: 75 }, (_, index) => ({
      ...questions[index % questions.length],
      id: `larger-question-${index}`,
    }));
    for (const limit of [20, 40, "all"] as const) {
      const session = createPracticeSession(largerPool, [], { ...selection, limit });
      expect(session).toHaveLength(limit === "all" ? 75 : limit);
      expect(new Set(session.map((question) => question.id)).size).toBe(session.length);
    }
    for (const limit of [20, 40, "all"] as const) {
      expect(createPracticeSession(questions, [], { ...selection, chapters: [1], limit })).toHaveLength(15);
    }
  });

  it("prioritizes unseen questions and shuffles questions/options without mutating the pool or solution IDs", () => {
    const original = structuredClone(questions);
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const progress = questions.slice(0, 20).map((question) => ({ questionId: question.id, lastCorrect: true }));
      const session = createPracticeSession(questions, progress, selection);
      expect(session.filter((question) => Number(question.id.split("-")[1]) >= 20)).toHaveLength(10);
      expect(createPracticeSession(questions, [], selection).map((question) => question.id))
        .not.toEqual(questions.map((question) => question.id));
      expect(session[0].options.map((option) => option.id)).toEqual(["b", "c", "a"]);
      expect(session[0].correctOptionIds).toEqual(["a"]);
      expect(questions).toEqual(original);
    } finally {
      random.mockRestore();
    }
  });
});
