import { randomInt } from "node:crypto";
import {
  CTFL_EXAM_CHAPTER_COUNTS, CTFL_EXAM_K_LEVEL_COUNTS, CTFL_EXAM_QUESTION_COUNT,
  type Course, type ExamSubmissionResult,
} from "@portal/shared";

// Selection groups from the versioned CTFL question pool's examBlueprint.
const groups: [number, string[]][] = [
  [1, ["1.1.1", "1.2.2"]], [1, ["1.5.2"]],
  [1, ["1.1.2", "1.2.1", "1.2.3"]], [1, ["1.3.1"]],
  [3, ["1.4.1", "1.4.2", "1.4.3", "1.4.4", "1.4.5"]], [1, ["1.5.1", "1.5.3"]],
  [1, ["2.1.2"]], [1, ["2.1.3"]], [2, ["2.2.1", "2.2.2", "2.2.3"]],
  [1, ["2.3.1"]], [1, ["2.1.1", "2.1.6", "2.1.4", "2.1.5"]],
  [2, ["3.1.1", "3.2.1", "3.2.3", "3.2.5"]],
  [1, ["3.1.2", "3.1.3"]], [1, ["3.2.2", "3.2.4"]],
  [1, ["4.1.1"]], [2, ["4.3.1", "4.3.2", "4.3.3"]],
  [2, ["4.4.1", "4.4.2", "4.4.3"]], [1, ["4.5.1", "4.5.2"]],
  [5, ["4.2.1", "4.2.2", "4.2.3", "4.2.4", "4.5.3"]],
  [1, ["5.1.2", "5.1.6", "5.2.1", "5.3.1"]], [1, ["5.1.1", "5.1.3", "5.1.7"]],
  [2, ["5.2.2", "5.2.3", "5.2.4"]], [1, ["5.3.2", "5.3.3"]], [1, ["5.4.1"]],
  [3, ["5.1.4", "5.1.5", "5.5.1"]], [1, ["6.1.1"]], [1, ["6.2.1"]],
];

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export class ExamSessionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function selectCtflExam(course: Course): Course {
  const selected = groups.flatMap(([count, objectives]) => {
    const available = objectives.map((objective) => course.questions.filter((question) =>
      question.usage !== "practice" && question.metadata?.learningObjective === `FL-${objective}`));
    if (available.some((questions) => questions.length === 0)) {
      throw new ExamSessionError(409, "Der Fragenpool deckt den Prüfungsbauplan nicht vollständig ab. Bitte lasse ihn prüfen.");
    }
    return shuffled(available).slice(0, count).map((questions) => shuffled(questions)[0]);
  });
  const valid = new Set(selected.map((question) => question.id)).size === CTFL_EXAM_QUESTION_COUNT &&
    CTFL_EXAM_CHAPTER_COUNTS.every((count, index) =>
      selected.filter((question) => question.metadata?.chapter === index + 1).length === count) &&
    Object.entries(CTFL_EXAM_K_LEVEL_COUNTS).every(([level, count]) =>
      selected.filter((question) => question.metadata?.kLevel === level).length === count);
  if (!valid) throw new ExamSessionError(409, "Der Fragenpool entspricht nicht dem CTFL-Prüfungsbauplan.");
  return { ...course, questions: shuffled(selected).map((question) =>
    ({ ...question, options: shuffled(question.options) })) };
}

export function gradeExam(course: Course, answers: Record<string, string[]>): ExamSubmissionResult {
  const results = course.questions.map(({ correctOptionIds, explanation, ...question }) => {
    const selectedOptionIds = answers[question.id] ?? [];
    return {
      question, correctOptionIds, explanation, selectedOptionIds,
      isCorrect: selectedOptionIds.length === correctOptionIds.length &&
        selectedOptionIds.every((id) => correctOptionIds.includes(id)),
    };
  });
  const correctCount = results.filter((result) => result.isCorrect).length;
  return {
    results, correctCount, totalQuestions: results.length,
    percentage: Math.round(correctCount / results.length * 100),
    passed: correctCount >= 26,
  };
}
