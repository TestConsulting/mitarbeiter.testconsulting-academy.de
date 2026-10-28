import { CTFL_EXAM_CHAPTER_COUNTS, CTFL_EXAM_QUESTION_COUNT, type PracticeProgress, type PracticeQuestion } from "@portal/shared";

export type PracticeSelection = {
  chapters: number[];
  kLevels: string[];
  limit: 20 | 40 | "all";
  errorsOnly: boolean;
  examChapterWeighting: boolean;
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
  let selected = prioritized.slice(0, selection.limit === "all" ? prioritized.length : selection.limit);
  if (selection.limit !== "all" && selection.chapters.length > 0) {
    const limit = selection.limit;
    const chapters = [...new Set(selection.chapters)].sort((left, right) => left - right);
    const allChapters = CTFL_EXAM_CHAPTER_COUNTS.every((_count, index) => chapters.includes(index + 1));
    const examWeighting = allChapters && selection.examChapterWeighting;
    const totalWeight = examWeighting ? CTFL_EXAM_QUESTION_COUNT : chapters.length;
    const quotas = chapters.map((chapter) => ({
      chapter,
      weight: examWeighting ? CTFL_EXAM_CHAPTER_COUNTS[chapter - 1] ?? 0 : 1,
    })).map(({ chapter, weight }) => ({
      chapter,
      count: Math.floor(weight * limit / totalWeight),
      remainder: weight * limit % totalWeight,
    }));
    const remaining = limit - quotas.reduce((sum, quota) => sum + quota.count, 0);
    (examWeighting ? [...quotas] : shuffled(quotas))
      .sort((left, right) => right.remainder - left.remainder || (examWeighting ? left.chapter - right.chapter : 0))
      .slice(0, remaining).forEach((quota) => { quota.count += 1; });
    selected = quotas.flatMap((quota) =>
      prioritized.filter((question) => question.metadata?.chapter === quota.chapter).slice(0, quota.count));
    const selectedIds = new Set(selected.map((question) => question.id));
    selected.push(...prioritized.filter((question) => !selectedIds.has(question.id)).slice(0, limit - selected.length));
    selected = shuffled(selected);
  }
  return selected
    .map((question) => ({ ...question, options: shuffled(question.options) }));
}
