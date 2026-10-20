import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { coursesData, type Course } from "@portal/shared";
import { parseIstqbQuestions } from "../db/istqb-question-import.js";
import { gradeExam, selectCtflExam } from "./exam-blueprint.js";

const course: Course = {
  ...coursesData[1],
  questions: parseIstqbQuestions(await readFile(new URL(
    "../../../../docs/elearning/istqb-portal/FRAGEN-MIT-LOESUNGEN.md", import.meta.url,
  ), "utf8")),
};

describe("CTFL examination blueprint", () => {
  it("selects 40 unique questions in the exact chapter, K-level and learning-objective distribution without changing the pool", () => {
    const original = structuredClone(course);
    for (let run = 0; run < 100; run++) {
      const exam = selectCtflExam(course);
      expect(exam.questions).toHaveLength(40);
      expect(new Set(exam.questions.map((question) => question.id)).size).toBe(40);
      expect([1, 2, 3, 4, 5, 6].map((chapter) => exam.questions.filter((q) => q.metadata?.chapter === chapter).length))
        .toEqual([8, 6, 4, 11, 9, 2]);
      expect(["K1", "K2", "K3"].map((level) => exam.questions.filter((q) => q.metadata?.kLevel === level).length))
        .toEqual([8, 24, 8]);
      expect(new Set(exam.questions.filter((q) => q.metadata?.kLevel === "K3").map((q) => q.metadata?.learningObjective)).size).toBe(8);
    }
    expect(course).toEqual(original);
  });
  it("rejects incomplete or inconsistent pools rather than silently reducing the exam", () => {
    expect(() => selectCtflExam({ ...course, questions: [] })).toThrow(/Prüfungsbauplan/);
    expect(() => selectCtflExam({
      ...course, questions: course.questions.map((question) => ({ ...question, metadata: question.metadata && { ...question.metadata, kLevel: "K1" } })),
    })).toThrow(/Prüfungsbauplan/);
  });
  it("passes at exactly 26/40 and awards no partial or negative credit", () => {
    const exam = selectCtflExam(course);
    const answers = Object.fromEntries(exam.questions.slice(0, 25).map((question) => [question.id, [...question.correctOptionIds].reverse()]));
    expect(gradeExam(exam, answers)).toMatchObject({ correctCount: 25, percentage: 63, passed: false });
    answers[exam.questions[25].id] = exam.questions[25].correctOptionIds;
    expect(gradeExam(exam, answers)).toMatchObject({ correctCount: 26, percentage: 65, passed: true });
    expect(gradeExam(exam, {})).toMatchObject({ correctCount: 0, percentage: 0, passed: false });
    const multiple = course.questions.find((question) => question.type === "multiple")!;
    expect(gradeExam({ ...course, questions: [multiple] }, { [multiple.id]: multiple.correctOptionIds.slice(0, 1) }).correctCount).toBe(0);
    expect(gradeExam({ ...course, questions: [multiple] }, { [multiple.id]: multiple.options.map((option) => option.id) }).correctCount).toBe(0);
  });
});
