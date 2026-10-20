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
const selection: PracticeSelection = { chapters: [1, 2], kLevels: [], limit: 30, errorsOnly: false };

describe("practice selection", () => {
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

  it("honors 30, 60 and all limits, caps smaller pools, and never repeats a question", () => {
    const largerPool = Array.from({ length: 75 }, (_, index) => ({
      ...questions[index % questions.length],
      id: `larger-question-${index}`,
    }));
    for (const limit of [30, 60, "all"] as const) {
      const session = createPracticeSession(largerPool, [], { ...selection, limit });
      expect(session).toHaveLength(limit === "all" ? 75 : limit);
      expect(new Set(session.map((question) => question.id)).size).toBe(session.length);
    }
    expect(createPracticeSession(questions, [], { ...selection, chapters: [1], limit: 30 })).toHaveLength(15);
  });

  it("prioritizes unseen questions and shuffles questions/options without mutating the pool or solution IDs", () => {
    const original = structuredClone(questions);
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const progress = questions.slice(0, 20).map((question) => ({ questionId: question.id, lastCorrect: true }));
      const session = createPracticeSession(questions, progress, selection);
      expect(session.slice(0, 10).every((question) => Number(question.id.split("-")[1]) >= 20)).toBe(true);
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
