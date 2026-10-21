import type { PracticeQuestion } from "@portal/shared";

export function QuestionContent({ question }: { question: Pick<PracticeQuestion, "question" | "image"> }) {
  return <span className="question-content">
    {question.question.split("\n").map((line, index) =>
      <span className="question-content__line" key={index}>{line}</span>)}
    {question.image && <img className="question-content__image" src={question.image.url} alt={question.image.alt} />}
  </span>;
}
