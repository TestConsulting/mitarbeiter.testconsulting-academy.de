export type ExamReviewFilterValue = "all" | "open" | "incorrect" | "correct";

function isExamReviewFilterValue(value: string): value is ExamReviewFilterValue {
  return value === "all" || value === "open" || value === "incorrect" || value === "correct";
}

export function ExamReviewFilter({
  value,
  onChange,
}: {
  value: ExamReviewFilterValue;
  onChange: (value: ExamReviewFilterValue) => void;
}) {
  return (
    <label className="exam-review__filter exam-review__filter--history">
      <span>Antworten anzeigen</span>
      <select
        value={value}
        onChange={(event) => {
          if (isExamReviewFilterValue(event.target.value)) onChange(event.target.value);
        }}
      >
        <option value="all">Alle Antworten</option>
        <option value="open">Offene Antworten</option>
        <option value="incorrect">Falsche Antworten</option>
        <option value="correct">Richtige Antworten</option>
      </select>
    </label>
  );
}

export function matchesExamReviewFilter(
  filter: ExamReviewFilterValue,
  status: Exclude<ExamReviewFilterValue, "all">,
) {
  return filter === "all" || filter === status;
}
