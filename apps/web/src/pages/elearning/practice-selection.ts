import type { PracticeProgress, PracticeQuestion } from "@portal/shared";

export type PracticeSelection = {
  chapters: number[];
  kLevels: string[];
  limit: 30 | 60 | "all";
  errorsOnly: boolean;
};

export function filterPracticeQuestions(
  questions: PracticeQuestion[], progress: PracticeProgress[], selection: PracticeSelection,
) {
  const errors = new Set(progress.filter((item) => !item.lastCorrect).map((item) => item.questionId));
  return questions.filter((question) => question.metadata &&
    selection.chapters.includes(question.metadata.chapter) &&
    (selection.kLevels.length === 0 || selection.kLevels.includes(question.metadata.kLevel)) &&
    (!selection.errorsOnly || errors.has(question.id)));
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function createPracticeSession(
  questions: PracticeQuestion[], progress: PracticeProgress[], selection: PracticeSelection,
): PracticeQuestion[] {
  const seen = new Set(progress.map((item) => item.questionId));
  const eligible = shuffled(filterPracticeQuestions(questions, progress, selection));
  const prioritized = [
    ...eligible.filter((question) => !seen.has(question.id)),
    ...eligible.filter((question) => seen.has(question.id)),
  ];
  return prioritized.slice(0, selection.limit === "all" ? prioritized.length : selection.limit)
    .map((question) => ({ ...question, options: shuffled(question.options) }));
}
