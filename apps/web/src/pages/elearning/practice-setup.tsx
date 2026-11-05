import { useState } from "react";
import { Button, Checkbox, Input, Radio, RadioGroup } from "@fluentui/react-components";
import {
  CTFL_EXAM_CHAPTER_COUNTS, CTFL_EXAM_QUESTION_COUNT, type Course, type PracticeProgress, type PracticeQuestion,
} from "@portal/shared";
import { createPracticeSession, filterPracticeQuestions, type PracticeSelection } from "./practice-selection.js";

type Props = {
  course: Course;
  progress: PracticeProgress[];
  onStart: (questions: PracticeQuestion[]) => void;
};

export function PracticeSetup({ course, progress, onStart }: Props) {
  const chapters = [...new Map(course.questions.flatMap((question) => question.metadata
    ? [[question.metadata.chapter, question.metadata.chapterTitle] as const] : [])).entries()]
    .sort(([left], [right]) => left - right);
  const [filters, setSelection] = useState<Omit<PracticeSelection, "limit">>({
    chapters: chapters.map(([id]) => id), kLevels: [], errorsOnly: false,
  });
  const maxCustomCount = course.questions.length;
  const maxCountDigits = String(maxCustomCount).length;
  const [sessionSize, setSessionSize] = useState("40");
  const [customCount, setCustomCount] = useState("20");
  const [countInputRejected, setCountInputRejected] = useState(false);
  const customCountValid = !countInputRejected && Number.isSafeInteger(Number(customCount)) &&
    Number(customCount) >= 20 && Number(customCount) <= maxCustomCount;
  const sizeValid = sessionSize !== "custom" || customCountValid;
  const selection: PracticeSelection = {
    ...filters,
    limit: sessionSize === "all" ? "all" : sessionSize === "40" ? 40 : Number(customCount),
  };
  const metadataComplete = course.questions.every((question) => question.metadata);
  const available = filterPracticeQuestions(course.questions, progress, selection).length;
  const allCtflChaptersSelected = CTFL_EXAM_CHAPTER_COUNTS.every((_count, index) =>
    selection.chapters.includes(index + 1));
  const examChapterPercentages = CTFL_EXAM_CHAPTER_COUNTS.map((count, index) =>
    `Kapitel ${index + 1}: ${(count / CTFL_EXAM_QUESTION_COUNT * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`)
    .join(", ");

  return (
    <section className="course-detail-card practice-setup" aria-labelledby="practice-setup-title">
      <div className="course-detail-card__heading">
        <h2 id="practice-setup-title">Übungsfragen</h2>
        <p>
          Ohne Zeitlimit. Fragen und Antwortoptionen werden gemischt; bereits beantwortete Fragen werden möglichst
          selten angeboten. Lösungen erscheinen erst nach „Antwort prüfen“. Geprüfte Antworten sind in dieser
          Sitzung unveränderlich.
        </p>
      </div>
      {!metadataComplete && <p role="alert">Die Kapitel- und Wissensstufenzuordnung ist unvollständig.
        Bitte lasse die ISTQB-Fragen erneut importieren.</p>}
      <fieldset className="course-editor-question">
        <legend>Kapitel</legend>
        <Checkbox label="Alle Kapitel" checked={chapters.length > 0 && selection.chapters.length === chapters.length ? true
          : selection.chapters.length === 0 ? false : "mixed"}
          onChange={(_event, data) => setSelection({ ...filters,
            chapters: data.checked === true ? chapters.map(([id]) => id) : [] })} />
        {chapters.map(([id, title]) => <Checkbox key={id} label={`${id}. ${title}`}
          checked={selection.chapters.includes(id)}
          onChange={(_event, data) => setSelection({ ...filters, chapters: data.checked
            ? [...selection.chapters, id] : selection.chapters.filter((chapter) => chapter !== id) })} />)}
        <p>{selection.limit === "all"
          ? "Bei allen verfügbaren Fragen werden alle passenden Fragen ohne Quoten verwendet."
          : allCtflChaptersSelected
            ? `Bei Auswahl aller sechs Kapitel gilt automatisch die CTFL-Prüfungsverteilung: ${examChapterPercentages}.`
            : "Bei einer Auswahl einzelner Kapitel werden die Fragen gleichmäßig auf die ausgewählten Kapitel verteilt."}</p>
      </fieldset>
      <fieldset className="course-editor-question">
        <legend>Wissensstufen (optional)</legend>
        <p>Ohne Auswahl: alle Stufen. Wissensstufen sind keine Schwierigkeitsgarantie.</p>
        {([["K1", "Erinnern"], ["K2", "Verstehen"], ["K3", "Anwenden"]] as const).map(([level, label]) =>
          <Checkbox key={level} label={`${level} – ${label}`} checked={selection.kLevels.includes(level)}
            onChange={(_event, data) => setSelection({ ...filters, kLevels: data.checked
              ? [...selection.kLevels, level] : selection.kLevels.filter((item) => item !== level) })} />)}
      </fieldset>
      <fieldset className="course-editor-question">
        <legend>Sitzungsumfang</legend>
        <RadioGroup aria-label="Sitzungsumfang" value={sessionSize}
          onChange={(_event, data) => setSessionSize(data.value)}>
          <Radio value="40" label="40 Fragen (gleiche Anzahl wie in der CTFL-Prüfung)" />
          <div className="page-heading__actions">
            <Radio value="custom" label="Eigene Fragenanzahl (mindestens 20)" />
            {sessionSize === "custom" && <Input className="practice-setup__count" size="small"
              aria-label="Fragenanzahl" aria-invalid={!customCountValid}
              aria-describedby={customCountValid ? undefined : "practice-count-error"}
              type="text" inputMode="numeric" pattern="[0-9]*" maxLength={maxCountDigits} value={customCount} required
              onChange={(_event, data) => {
                const allowed = /^\d*$/.test(data.value) && data.value.length <= maxCountDigits &&
                  Number(data.value) <= maxCustomCount;
                setCountInputRejected(!allowed);
                if (allowed) setCustomCount(data.value);
              }} />}
          </div>
          <Radio value="all" label="Alle verfügbaren Fragen" />
        </RadioGroup>
        {!sizeValid && <p id="practice-count-error" role="alert">
          {maxCustomCount < 20
            ? "Für eine eigene Fragenanzahl müssen mindestens 20 Fragen im Katalog vorhanden sein. Bitte wähle eine andere Option."
            : `Bitte gib eine ganze Fragenanzahl zwischen 20 und ${maxCustomCount} ein (maximal ${maxCountDigits} Ziffern).`}
        </p>}
        <p>Bei weniger verfügbaren Fragen wird die tatsächliche Anzahl nach dem Start angezeigt.
          Keine Wiederholungen innerhalb einer Sitzung.</p>
        <Checkbox label="Fehler wiederholen" checked={selection.errorsOnly}
          onChange={(_event, data) => setSelection({ ...filters, errorsOnly: data.checked === true })} />
      </fieldset>
      <p role="status">{available} {available === 1 ? "Frage passt" : "Fragen passen"} zur Auswahl.</p>
      {available === 0 && <p role="alert">{selection.errorsOnly
        ? "Keine zuletzt falsch beantworteten Fragen für diese Auswahl vorhanden."
        : "Keine Fragen für diese Auswahl vorhanden. Bitte wähle mindestens ein passendes Kapitel."}</p>}
      <Button appearance="primary" className="elearning-start-btn" disabled={!metadataComplete || available === 0 || !sizeValid}
        onClick={() => {
          if (sizeValid) onStart(createPracticeSession(course.questions, progress, selection));
        }}>
        Übung starten
      </Button>
    </section>
  );
}
