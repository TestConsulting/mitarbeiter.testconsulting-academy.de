import { useEffect, useId, useRef, useState } from "react";
import {
  Badge, Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, ProgressBar,
} from "@fluentui/react-components";
import {
  ArrowCounterclockwise20Regular,
  ArrowLeft20Regular,
  ArrowRight20Regular,
  Checkmark20Regular,
  CheckmarkCircle24Regular,
  Dismiss20Regular,
  DismissCircle24Regular,
  Info20Regular,
  SubtractCircleRegular,
} from "@fluentui/react-icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Course, PracticeProgress, PracticeQuestion } from "@portal/shared";
import { ApiError, api } from "../../api/client.js";
import { ExamReviewFilter, matchesExamReviewFilter, type ExamReviewFilterValue } from "./exam-review-filter.js";
import { PracticeSetup } from "./practice-setup.js";
import { QuestionContent } from "./question-content.js";

type AnswerEvaluation = {
  questionId: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
};

export function CoursePracticePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, string[]>>({});
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [evaluations, setEvaluations] = useState<AnswerEvaluation[]>([]);
  const [reviewFilter, setReviewFilter] = useState<ExamReviewFilterValue>("all");
  const [markedQuestionIds, setMarkedQuestionIds] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<PracticeQuestion[] | null>(null);
  const [progress, setProgress] = useState<PracticeProgress[]>([]);
  const [answerError, setAnswerError] = useState("");
  const [savingAnswer, setSavingAnswer] = useState(false);
  const answerPending = useRef(false);
  const courseVersion = useRef(0);
  const configurable = courseId === "istqb-foundation";

  const baseInputId = useId();

  useEffect(() => {
    let active = true;
    courseVersion.current++;
    answerPending.current = false;
    setSavingAnswer(false);
    if (!courseId) {
      setLoadStatus("not-found");
      return () => { active = false; courseVersion.current++; };
    }
    setLoadStatus("loading");
    setSessionQuestions(null);
    setCurrentIndex(0);
    setSelectedOptionIds([]);
    setAnswersByQuestion({});
    setIsAnswerChecked(false);
    setEvaluations([]);
    setMarkedQuestionIds([]);
    setIsFinished(false);
    setConfirmSubmitOpen(false);
    setStartedAt(Date.now());
    setSubmittedAt(null);
    setAnswerError("");
    Promise.all([
      api.courses.getPractice(courseId),
      configurable ? api.courses.getPracticeProgress(courseId) : Promise.resolve([]),
    ]).then(([loadedCourse, loadedProgress]) => {
      if (!active) return;
      setCourse(loadedCourse);
      setProgress(loadedProgress);
      setLoadStatus("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
    });
    return () => { active = false; };
  }, [courseId, loadAttempt, configurable]);

  if (loadStatus === "loading") {
    return <div className="page-stack elearning-page"><p role="status">Übungsfragen werden geladen …</p></div>;
  }

  if (loadStatus === "error") {
    return (
      <div className="page-stack elearning-page">
        <section className="empty-state" role="alert">
          <h2>Übungsfragen konnten nicht geladen werden.</h2>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
        </section>
      </div>
    );
  }

  if (loadStatus === "not-found" || !course || course.questions.length === 0) {
    return (
      <div className="page-stack elearning-page">
        <div className="elearning-nav-header">
          <Link to="/areas/elearning" className="elearning-back-link">
            <ArrowLeft20Regular aria-hidden="true" />
            <span>Zurück zur Kursübersicht</span>
          </Link>
        </div>
        <section className="empty-state">
          <h2>Keine Übungsfragen vorhanden</h2>
          <p>Für diesen Kurs wurden noch keine Fragen hinterlegt.</p>
          <Button onClick={() => navigate("/areas/elearning")} appearance="primary" icon={<ArrowLeft20Regular />}>
            Zur Kursübersicht
          </Button>
        </section>
      </div>
    );
  }

  if (configurable && sessionQuestions === null) {
    return (
      <div className="page-stack elearning-page">
        <div className="elearning-nav-header">
          <Link to={`/areas/elearning/${course.slug}`} className="elearning-back-link">
            <ArrowLeft20Regular aria-hidden="true" /><span>Zurück zum Kurs</span>
          </Link>
        </div>
        <div className="page-heading"><h1>ISTQB Foundation Level - Übungsmodus</h1></div>
        <PracticeSetup course={course} progress={progress} onStart={(selectedQuestions) => {
          setStartedAt(Date.now());
          setSessionQuestions(selectedQuestions);
        }} />
      </div>
    );
  }

  const questions = sessionQuestions ?? course.questions;
  const courseSlug = course.slug;
  const currentQuestion: PracticeQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const isMultiple = currentQuestion.type === "multiple";

  function handleOptionToggle(optionId: string) {
    if (isAnswerChecked || answerPending.current) return;

    let nextOptionIds: string[];
    if (isMultiple) {
      nextOptionIds = selectedOptionIds.includes(optionId)
        ? selectedOptionIds.filter((id) => id !== optionId)
        : [...selectedOptionIds, optionId];
    } else {
      nextOptionIds = [optionId];
    }
    setSelectedOptionIds(nextOptionIds);
    setAnswersByQuestion((previous) => ({ ...previous, [currentQuestion.id]: nextOptionIds }));
  }

  async function handleCheckAnswer() {
    if (selectedOptionIds.length === 0 || isAnswerChecked || answerPending.current) return;

    // Evaluate correctness:
    // A single or multiple answer is correct iff:
    // 1) all selected options are in correctOptionIds
    // 2) all correctOptionIds are selected
    const correctIds = currentQuestion.correctOptionIds;
    let isCorrect =
      selectedOptionIds.length === correctIds.length &&
      selectedOptionIds.every((id) => correctIds.includes(id));

    if (configurable) {
      const version = courseVersion.current;
      answerPending.current = true;
      setSavingAnswer(true);
      setAnswerError("");
      try {
        const saved = await api.courses.checkPracticeAnswer(courseSlug, currentQuestion.id, selectedOptionIds);
        if (version !== courseVersion.current) return;
        isCorrect = saved.lastCorrect;
        setProgress((previous) => [...previous.filter((item) => item.questionId !== saved.questionId), saved]);
      } catch {
        if (version === courseVersion.current) {
          setAnswerError("Deine Antwort konnte nicht gespeichert werden. Bitte versuche es erneut.");
        }
        return;
      } finally {
        if (version === courseVersion.current) {
          answerPending.current = false;
          setSavingAnswer(false);
        }
      }
    }

    const evaluation: AnswerEvaluation = {
      questionId: currentQuestion.id,
      selectedOptionIds: [...selectedOptionIds],
      isCorrect,
    };

    setEvaluations((prev) => [
      ...prev.filter((item) => item.questionId !== currentQuestion.id),
      evaluation,
    ]);
    setIsAnswerChecked(true);
  }

  function handleSelectQuestion(index: number) {
    if (answerPending.current || index === currentIndex) return;
    const question = questions[index];
    setCurrentIndex(index);
    setSelectedOptionIds(answersByQuestion[question.id] ?? []);
    setIsAnswerChecked(evaluations.some((item) => item.questionId === question.id));
    setAnswerError("");
  }

  function handlePreviousQuestion() {
    if (currentIndex > 0) handleSelectQuestion(currentIndex - 1);
  }

  function handleNextQuestion() {
    if (currentIndex + 1 === totalQuestions) {
      if (isAnswerChecked) handleFinish();
      else setConfirmSubmitOpen(true);
      return;
    }
    handleSelectQuestion(currentIndex + 1);
  }

  function handleFinish() {
    setSubmittedAt(Date.now());
    setConfirmSubmitOpen(false);
    setIsFinished(true);
  }

  function handleRestart() {
    setCurrentIndex(0);
    setSelectedOptionIds([]);
    setAnswersByQuestion({});
    setIsAnswerChecked(false);
    setEvaluations([]);
    setMarkedQuestionIds([]);
    setIsFinished(false);
    setConfirmSubmitOpen(false);
    setStartedAt(Date.now());
    setSubmittedAt(null);
    setAnswerError("");
    if (configurable) setSessionQuestions(null);
  }

  // Calculate results for finished screen
  const correctCount = evaluations.filter((item) => item.isCorrect).length;

  const percentage = Math.round((correctCount / totalQuestions) * 100);

  // Completed / Summary View
  if (isFinished) {
    const incorrectCount = evaluations.length - correctCount;
    const openCount = totalQuestions - evaluations.length;
    const durationSeconds = Math.max(0, Math.floor(((submittedAt ?? startedAt) - startedAt) / 1000));
    const chapters = [...new Set(questions.flatMap((question) =>
      question.metadata ? [question.metadata.chapter] : []))].sort((left, right) => left - right);
    return (
      <div className="page-stack elearning-page">
        <div className="elearning-nav-header">
          <Link to={`/areas/elearning/${course.slug}`} className="elearning-back-link">
            <ArrowLeft20Regular aria-hidden="true" />
            <span>Zurück zum Kurs „{course.title}“</span>
          </Link>
        </div>

        <header className="practice-results-header">
            {course.isDemo && (
              <Badge appearance="tint" color="informative" size="small">
                Demo-Übungsdurchlauf
              </Badge>
            )}
            <h1 id="practice-results-title">Übung abgeschlossen!</h1>
            <p className="practice-results-course">Kurs: {course.title}</p>
            {submittedAt !== null && <p>Abgegeben: {new Date(submittedAt).toLocaleString("de-DE")}</p>}
            <p>Ohne Zeitlimit · Bearbeitungsdauer: {Math.floor(durationSeconds / 60)} Minuten {durationSeconds % 60} Sekunden</p>
        </header>

        <section className="practice-score-box exam-score-box" aria-label="Dein Ergebnis">
            <div className="practice-score-ring exam-score-ring">
              <span className="practice-score-ring__percent">{percentage} %</span>
              <span className="practice-score-ring__label">Ergebnis</span>
            </div>
            <div className="practice-score-details">
              <h2>Dein Ergebnis</h2>
              <p className="practice-score-text">
                <strong>{correctCount}</strong> von <strong>{totalQuestions}</strong> Fragen richtig beantwortet ({percentage} %).
              </p>
              <p>{correctCount} richtig · {incorrectCount} falsch · {openCount} übersprungen / nicht geprüft.</p>
              <p>Richtigkeit bezogen auf die gesamte Sitzung. Ungeprüfte Antworten zählen mit 0 Punkten.</p>
              {course.isDemo && (
                <div className="practice-demo-alert" role="note">
                  <Info20Regular aria-hidden="true" />
                  <span>
                    Dieses Ergebnis basiert auf deinem aktuellen Übungsdurchlauf mit didaktischen Beispielinhalten.
                  </span>
                </div>
              )}
            </div>
        </section>

        {chapters.length > 0 && (
          <section className="practice-card" aria-labelledby="practice-chapters-title">
            <h2 id="practice-chapters-title">Kapitelwerte und Lernempfehlungen</h2>
            <div className="practice-results-table-wrapper">
              <table className="practice-results-table">
                <caption>Ergebnis pro Kapitel</caption>
                <thead><tr>
                  <th scope="col">Kapitel</th><th scope="col">Richtig</th><th scope="col">Falsch</th>
                  <th scope="col">Offen</th><th scope="col">Gesamt</th><th scope="col">Punkte</th>
                  <th scope="col">Empfehlung</th>
                </tr></thead>
                <tbody>{chapters.map((chapter) => {
                  const chapterQuestions = questions.filter((question) => question.metadata?.chapter === chapter);
                  const chapterEvaluations = evaluations.filter((evaluation) =>
                    chapterQuestions.some((question) => question.id === evaluation.questionId));
                  const right = chapterEvaluations.filter((evaluation) => evaluation.isCorrect).length;
                  const wrong = chapterEvaluations.length - right;
                  const open = chapterQuestions.length - chapterEvaluations.length;
                  return <tr key={chapter}>
                    <th scope="row">{chapter}. {chapterQuestions[0].metadata?.chapterTitle}</th>
                    <td>{right}</td><td>{wrong}</td><td>{open}</td><td>{chapterQuestions.length}</td>
                    <td>{right}/{chapterQuestions.length} Pkt.</td>
                    <td>{wrong > 0
                      ? "Lernziele dieses Kapitels wiederholen und Fehler gezielt üben."
                      : open > 0 ? "Offene Fragen dieses Kapitels bearbeiten und Antworten prüfen."
                        : "Alle Fragen richtig beantwortet. Wissen durch regelmäßige Wiederholung festigen."}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </section>
        )}

          <div className="practice-results-actions">
            <Button appearance="primary" icon={<ArrowCounterclockwise20Regular aria-hidden="true" />}
              onClick={handleRestart}>Erneut üben</Button>
            <Button appearance="secondary" onClick={() => navigate(`/areas/elearning/${course.slug}/exam`)}>
              Neue Prüfung vorbereiten
            </Button>
            <Button appearance="secondary" onClick={() => navigate("/areas/elearning/results")}>
              Mein Prüfungsverlauf
            </Button>
            <Button appearance="secondary" onClick={() => navigate(`/areas/elearning/${course.slug}`)}>
              Zurück zum Kurs
            </Button>
          </div>

          <details className="exam-review">
            <summary className="exam-review__summary">
              <h2 id="practice-review-title">Alle Fragen im Rückblick</h2>
            </summary>
            <ExamReviewFilter value={reviewFilter} onChange={setReviewFilter} />
            {questions.map((question, index) => {
              const evaluation = evaluations.find((item) => item.questionId === question.id);
              const selectedOptionIds = evaluation?.selectedOptionIds ?? answersByQuestion[question.id] ?? [];
              const status = evaluation?.isCorrect
                ? "correct"
                : evaluation && selectedOptionIds.length > 0 ? "incorrect" : "open";
              if (!matchesExamReviewFilter(reviewFilter, status)) return null;
              const summaryText = status === "correct"
                ? "1 Punkt (richtig)"
                : status === "incorrect" ? "0 Punkte (falsch)" : "0 Punkte (übersprungen/nicht geprüft)";
              return (
                <details key={question.id} className="exam-history-review">
                  <summary>
                    <span className="exam-history-review__question">
                      {evaluation?.isCorrect
                        ? <CheckmarkCircle24Regular
                          className="practice-review-option--correct exam-history-review__status-icon"
                          aria-label="Richtig beantwortet"
                        />
                        : evaluation && selectedOptionIds.length > 0
                          ? <DismissCircle24Regular
                            className="practice-review-option--wrong exam-history-review__status-icon"
                            aria-label="Falsch beantwortet"
                          />
                          : <SubtractCircleRegular
                            className="exam-history-review__open-icon exam-history-review__status-icon"
                            aria-label="Nicht beantwortet"
                          />}
                      <span>Frage {index + 1}: {question.question}</span>
                    </span>
                    <span className={`exam-history-review__summary-status${status === "correct"
                      ? " practice-review-option--correct"
                      : status === "incorrect" ? " practice-review-option--wrong" : ""}`}>
                      {summaryText}
                    </span>
                  </summary>
                  {question.image && <QuestionContent question={{ question: "", image: question.image }} />}
                  <ol className="exam-history-review__list">
                    <li>
                      <div>
                        <ul className="exam-history-review__options exam-history-review__options--indented">
                          {question.options.map((option) => (
                            <li key={option.id} className="practice-review-option">
                              {selectedOptionIds.includes(option.id) ? "◉ " : "○ "}{option.text}
                              {question.correctOptionIds.includes(option.id)
                                ? <CheckmarkCircle24Regular
                                  className="practice-review-option--correct"
                                  aria-label="Richtige Antwort"
                                />
                                : selectedOptionIds.includes(option.id)
                                  ? <DismissCircle24Regular
                                    className="practice-review-option--wrong"
                                    aria-label="Deine falsche Auswahl"
                                  />
                                  : null}
                            </li>
                          ))}
                        </ul>
                        <div className="exam-history-review__explanation exam-history-review__explanation--indented">
                          <strong>Erklärung zur Lösung:</strong>
                          <p>{question.explanation}</p>
                        </div>
                      </div>
                    </li>
                  </ol>
                </details>
              );
            })}
            {questions.every((question) => {
              const evaluation = evaluations.find((item) => item.questionId === question.id);
              const selectedOptionIds = evaluation?.selectedOptionIds ?? answersByQuestion[question.id] ?? [];
              const status = evaluation?.isCorrect
                ? "correct"
                : evaluation && selectedOptionIds.length > 0 ? "incorrect" : "open";
              return !matchesExamReviewFilter(reviewFilter, status);
            }) && <p className="exam-review__empty">Keine Fragen in dieser Kategorie.</p>}
          </details>
      </div>
    );
  }

  // Active Question View
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;
  const currentEvaluation = evaluations.find((item) => item.questionId === currentQuestion.id);
  const isCorrect = currentEvaluation?.isCorrect;
  const uncheckedQuestions = questions.filter((question) =>
    !evaluations.some((item) => item.questionId === question.id));
  const unansweredCount = uncheckedQuestions.filter((question) =>
    (answersByQuestion[question.id]?.length ?? 0) < question.correctOptionIds.length).length;
  const incompleteCount = uncheckedQuestions.filter((question) => {
    const selectedCount = answersByQuestion[question.id]?.length ?? 0;
    return selectedCount > 0 && selectedCount < question.correctOptionIds.length;
  }).length;

  return (
    <div className="page-stack elearning-page">
      <div className="elearning-nav-header">
        <Link to={`/areas/elearning/${course.slug}`} className="elearning-back-link">
          <ArrowLeft20Regular aria-hidden="true" />
          <span>Übung beenden & zurück zum Kurs</span>
        </Link>
      </div>

      <div className="page-heading">
        <h1>ISTQB Foundation Level - Übungsfragen</h1>
        <span>{course.title} · {totalQuestions} Fragen in dieser Sitzung · Ohne Zeitlimit</span>
      </div>

      <div className="practice-container">
        <article className="practice-card exam-question-card practice-session-card" aria-labelledby="current-question-text">
          <div className="practice-session-card__status">
            <span>Ohne Zeitlimit</span>
            <span>{evaluations.length} / {totalQuestions} beantwortet / geprüft</span>
          </div>

          <nav className="practice-question-grid" aria-label="Fragen in dieser Sitzung">
            {questions.map((question, index) => {
              const evaluation = evaluations.find((item) => item.questionId === question.id);
              const hasDraftAnswer = (answersByQuestion[question.id]?.length ?? 0) > 0;
              const isMarked = markedQuestionIds.includes(question.id);
              const status = evaluation ? "beantwortet und geprüft"
                : hasDraftAnswer ? "unvollständig" : "offen";
              return (
                <Button
                  key={question.id}
                  appearance="subtle"
                  className={`practice-question-grid__item${
                    index === currentIndex ? " practice-question-grid__item--current" : ""
                  }${evaluation ? " practice-question-grid__item--answered" : ""}${
                    hasDraftAnswer && !evaluation ? " practice-question-grid__item--incomplete" : ""
                  }${isMarked ? " practice-question-grid__item--marked" : ""}`}
                  aria-label={`Frage ${index + 1}: ${status}${isMarked ? ", markiert" : ""}`}
                  aria-current={index === currentIndex ? "step" : undefined}
                  onClick={() => handleSelectQuestion(index)}
                  disabled={savingAnswer}
                >
                  {index + 1}{isMarked && <span aria-hidden="true">⚑</span>}
                </Button>
              );
            })}
          </nav>

          <div className="practice-card__progress">
            <ProgressBar
              value={progressPercent}
              max={100}
              aria-label={`Fortschritt: Frage ${currentIndex + 1} von ${totalQuestions}`}
            />
            <span>{currentIndex + 1} / {totalQuestions}</span>
          </div>

          <h2 className="practice-question-index">Frage {currentIndex + 1} von {totalQuestions}</h2>
          <h1 id="current-question-text" className="practice-card__question exam-question-card__question">
            <QuestionContent question={currentQuestion} />
          </h1>
          {currentQuestion.metadata && <p className="practice-question-metadata">
            Kapitel {currentQuestion.metadata.chapter} · {currentQuestion.metadata.learningObjective} · {currentQuestion.metadata.kLevel}
          </p>}
          <p className="practice-card__instruction exam-question-card__hint">
            {isMultiple ? "Wähle mehrere Antworten." : "Wähle eine Antwort."}
          </p>

          {/* Options Form / List */}
          <fieldset
            className="practice-options exam-options"
            aria-label="Antwortmöglichkeiten"
            disabled={isAnswerChecked || savingAnswer}
          >

            {currentQuestion.options.map((option, optIdx) => {
              const inputId = `${baseInputId}-opt-${optIdx}`;
              const isSelected = selectedOptionIds.includes(option.id);
              const isOptionCorrect = currentQuestion.correctOptionIds.includes(option.id);

              let optionStateClass = "";
              let feedbackLabel = "";

              if (isAnswerChecked) {
                if (isOptionCorrect) {
                  optionStateClass = "practice-option--correct";
                  feedbackLabel = "Richtige Antwort";
                } else if (isSelected && !isOptionCorrect) {
                  optionStateClass = "practice-option--wrong";
                  feedbackLabel = "Deine Auswahl (falsch)";
                }
              }

              return (
                <label
                  key={option.id}
                  htmlFor={inputId}
                  className={`practice-option${isSelected ? " practice-option--selected" : ""}${
                    optionStateClass ? ` ${optionStateClass}` : ""
                  }`}
                >
                  <input
                    id={inputId}
                    type={isMultiple ? "checkbox" : "radio"}
                    name={`practice-question-${currentQuestion.id}`}
                    value={option.id}
                    checked={isSelected}
                    onChange={() => handleOptionToggle(option.id)}
                    disabled={isAnswerChecked || savingAnswer}
                    className="practice-option__input"
                  />
                  <span className="practice-option__box" aria-hidden="true">
                    {isSelected && (isMultiple ? <Checkmark20Regular /> : <span className="practice-option__dot" />)}
                  </span>
                  <span className="practice-option__text">{option.text}</span>

                  {isAnswerChecked && feedbackLabel && (
                    <span
                      className={`practice-option__feedback-badge ${
                        isOptionCorrect
                          ? "practice-option__feedback-badge--correct"
                          : "practice-option__feedback-badge--wrong"
                      }`}
                    >
                      {isOptionCorrect ? (
                        <Checkmark20Regular aria-hidden="true" />
                      ) : (
                        <Dismiss20Regular aria-hidden="true" />
                      )}
                      <span>{feedbackLabel}</span>
                    </span>
                  )}
                </label>
              );
            })}
          </fieldset>
          <Checkbox
            checked={markedQuestionIds.includes(currentQuestion.id)}
            label="Frage markieren"
            onChange={(_event, data) => setMarkedQuestionIds((previous) =>
              data.checked
                ? [...previous, currentQuestion.id]
                : previous.filter((id) => id !== currentQuestion.id))}
          />

          {/* Answer Feedback & Explanation */}
          {isAnswerChecked && (
            <div
              className={`practice-feedback ${
                isCorrect ? "practice-feedback--correct" : "practice-feedback--incorrect"
              }`}
              role="status"
              aria-live="polite"
            >
              <div className="practice-feedback__status-line">
                <span className="practice-feedback__icon" aria-hidden="true">
                  {isCorrect ? <CheckmarkCircle24Regular /> : <DismissCircle24Regular />}
                </span>
                <span className="practice-feedback__headline">
                  {isCorrect ? "Richtig gelöst!" : "Leider nicht richtig."}
                </span>
              </div>

              <div className="practice-feedback__explanation">
                <strong>Erklärung zur Lösung:</strong>
                <p>{currentQuestion.explanation}</p>
              </div>
            </div>
          )}

          {answerError && <p role="alert">{answerError}</p>}
          <div className="practice-card__footer">
            <div className="practice-card__answer-actions">
              <Button appearance="secondary" onClick={() => {
                setSelectedOptionIds([]);
                setAnswersByQuestion((previous) => ({ ...previous, [currentQuestion.id]: [] }));
              }}
                disabled={selectedOptionIds.length === 0 || isAnswerChecked || savingAnswer}>
                Auswahl aufheben
              </Button>
              {!isAnswerChecked && (
                <Button appearance="primary" onClick={handleCheckAnswer}
                  disabled={selectedOptionIds.length === 0 || savingAnswer} className="practice-action-btn">
                  {savingAnswer ? "Antwort wird gespeichert …" : "Antwort prüfen"}
                </Button>
              )}
            </div>
            <div className="practice-card__navigation">
              <Button appearance="secondary" onClick={handlePreviousQuestion} disabled={currentIndex === 0 || savingAnswer}>
                Vorherige Frage
              </Button>
              <Button appearance="primary" onClick={handleNextQuestion} disabled={savingAnswer}
                icon={<ArrowRight20Regular aria-hidden="true" />}>
                {currentIndex + 1 < totalQuestions
                  ? selectedOptionIds.length > 0 ? "Nächste Frage" : "Überspringen"
                  : isAnswerChecked ? "Ergebnis ansehen" : "Übung abgeben"}
              </Button>
            </div>
            {currentIndex + 1 < totalQuestions && (
              <div className="practice-card__submit">
                <Button appearance="secondary" onClick={() => setConfirmSubmitOpen(true)} disabled={savingAnswer}>
                  Übung abgeben
                </Button>
              </div>
            )}
          </div>
        </article>
      </div>
      <Dialog open={confirmSubmitOpen} onOpenChange={(_event, data) => setConfirmSubmitOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Übung beenden?</DialogTitle>
            <DialogContent>
              <p>{unansweredCount} unbeantwortete Fragen (davon {incompleteCount} unvollständig ausgewählt).</p>
              <p>{uncheckedQuestions.length} nicht geprüfte Fragen zählen als übersprungen.</p>
              <p>Offene Fragen zählen mit 0 Punkten. Danach können Antworten nicht mehr verändert werden.</p>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setConfirmSubmitOpen(false)}>
                Weiter bearbeiten
              </Button>
              <Button appearance="primary" onClick={() => {
                handleFinish();
              }}>
                Endgültig beenden
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
