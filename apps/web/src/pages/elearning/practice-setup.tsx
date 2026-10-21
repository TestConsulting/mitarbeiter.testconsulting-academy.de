import { useState } from "react";
import { Button, Checkbox, Radio, RadioGroup } from "@fluentui/react-components";
import type { Course, PracticeProgress, PracticeQuestion } from "@portal/shared";
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
  const [selection, setSelection] = useState<PracticeSelection>({
    chapters: chapters.map(([id]) => id), kLevels: [], limit: 20, errorsOnly: false,
  });
  const metadataComplete = course.questions.every((question) => question.metadata);
  const available = filterPracticeQuestions(course.questions, progress, selection).length;

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
          onChange={(_event, data) => setSelection({ ...selection,
            chapters: data.checked === true ? chapters.map(([id]) => id) : [] })} />
        {chapters.map(([id, title]) => <Checkbox key={id} label={`${id}. ${title}`}
          checked={selection.chapters.includes(id)}
          onChange={(_event, data) => setSelection({ ...selection, chapters: data.checked
            ? [...selection.chapters, id] : selection.chapters.filter((chapter) => chapter !== id) })} />)}
      </fieldset>
      <fieldset className="course-editor-question">
        <legend>Wissensstufen (optional)</legend>
        <p>Ohne Auswahl: alle Stufen. Wissensstufen sind keine Schwierigkeitsgarantie.</p>
        {([["K1", "Erinnern"], ["K2", "Verstehen"], ["K3", "Anwenden"]] as const).map(([level, label]) =>
          <Checkbox key={level} label={`${level} – ${label}`} checked={selection.kLevels.includes(level)}
            onChange={(_event, data) => setSelection({ ...selection, kLevels: data.checked
              ? [...selection.kLevels, level] : selection.kLevels.filter((item) => item !== level) })} />)}
      </fieldset>
      <fieldset className="course-editor-question">
        <legend>Sitzungsumfang</legend>
        <RadioGroup aria-label="Sitzungsumfang" value={String(selection.limit)}
          onChange={(_event, data) => {
            const limit = data.value === "all" ? "all" : data.value === "20" ? 20
              : data.value === "40" ? 40 : null;
            if (limit !== null) setSelection({ ...selection, limit });
          }}>
          <Radio value="20" label="20 Fragen" />
          <Radio value="40" label="40 Fragen (gleiche Anzahl wie in der CTFL-Prüfung)" />
          <Radio value="all" label="Alle verfügbaren Fragen" />
        </RadioGroup>
        <p>Bei weniger verfügbaren Fragen wird die tatsächliche Anzahl nach dem Start angezeigt.
          Keine Wiederholungen innerhalb einer Sitzung.</p>
        <Checkbox label="Fehler wiederholen" checked={selection.errorsOnly}
          onChange={(_event, data) => setSelection({ ...selection, errorsOnly: data.checked === true })} />
      </fieldset>
      <p role="status">{available} {available === 1 ? "Frage passt" : "Fragen passen"} zur Auswahl.</p>
      {available === 0 && <p role="alert">{selection.errorsOnly
        ? "Keine zuletzt falsch beantworteten Fragen für diese Auswahl vorhanden."
        : "Keine Fragen für diese Auswahl vorhanden. Bitte wähle mindestens ein passendes Kapitel."}</p>}
      <Button appearance="primary" className="elearning-start-btn" disabled={!metadataComplete || available === 0}
        onClick={() => onStart(createPracticeSession(course.questions, progress, selection))}>
        Übung starten
      </Button>
    </section>
  );
}
