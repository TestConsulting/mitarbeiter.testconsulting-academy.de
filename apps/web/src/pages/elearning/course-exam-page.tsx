import { useEffect, useId, useRef, useState } from "react";
import { Badge, Button, ProgressBar } from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  CheckmarkCircle24Regular,
  Clock20Regular,
  DismissCircle24Regular,
  SubtractCircleRegular,
} from "@fluentui/react-icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  COURSE_EXAM_DURATION_MINUTES,
  EXAM_PASS_THRESHOLD,
  type ExamCourse,
  type ExamSubmissionResult,
} from "@portal/shared";
import { ApiError, api } from "../../api/client.js";
import { FoundationExamPage } from "./foundation-exam-page.js";
import { ExamReviewFilter, matchesExamReviewFilter, type ExamReviewFilterValue } from "./exam-review-filter.js";
import { QuestionContent } from "./question-content.js";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export function CourseExamPage() {
  const { courseId } = useParams<{ courseId: string }>();
  return courseId === "istqb-foundation" ? <FoundationExamPage /> : <LegacyCourseExamPage />;
}

function LegacyCourseExamPage() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<ExamCourse | null>(null);
  const [result, setResult] = useState<ExamSubmissionResult | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [confirmedQuestionIds, setConfirmedQuestionIds] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [confirmSubmission, setConfirmSubmission] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"ready" | "submitting">("ready");
  const [submitError, setSubmitError] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ExamReviewFilterValue>("all");
  const inputId = useId();
  const submissionStarted = useRef(false);
  const timeoutSubmissionAttempted = useRef(false);

  useEffect(() => {
    let active = true;
    if (!courseId) {
      setLoadStatus("not-found");
      return () => { active = false; };
    }
    setLoadStatus("loading");
    api.courses.getExam(courseId).then((loadedCourse) => {
      if (!active) return;
      setCourse(loadedCourse);
      setSecondsLeft(loadedCourse.durationMinutes === null ? null
        : (loadedCourse.durationMinutes ?? COURSE_EXAM_DURATION_MINUTES) * 60);
      setLoadStatus("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
    });
    return () => { active = false; };
  }, [courseId, loadAttempt]);

  async function submitExam() {
    if (!courseId || !course || submissionStarted.current) return;
    submissionStarted.current = true;
    setSubmitStatus("submitting");
    setSubmitError("");
    try {
      const submittedAnswers = course.questions.map((question) => ({
        questionId: question.id,
        selectedOptionIds: answers[question.id] ?? [],
      }));
      setResult(await api.courses.submitExam(courseId, submittedAnswers));
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Die Prüfung konnte nicht abgegeben werden. Bitte versuche es erneut.");
      setSubmitStatus("ready");
      submissionStarted.current = false;
    }
  }

  useEffect(() => {
    if (loadStatus !== "ready" || !course || result || isPaused || submitStatus === "submitting" ||
        secondsLeft === null || secondsLeft === 0) return;
    const timer = window.setTimeout(() => {
      setSecondsLeft((remaining) => remaining === null ? null : Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [course, isPaused, loadStatus, result, secondsLeft, submitStatus]);

  useEffect(() => {
    if (secondsLeft === 0 && course && !result && !isPaused && !timeoutSubmissionAttempted.current) {
      timeoutSubmissionAttempted.current = true;
      void submitExam();
    }
  }, [secondsLeft, course, result, isPaused]);

  if (loadStatus === "loading") {
    return <div className="page-stack elearning-page"><p role="status">Prüfungsfragen werden geladen …</p></div>;
  }

  if (loadStatus === "error") {
    return (
      <div className="page-stack elearning-page">
        <section className="empty-state" role="alert">
          <h2>Prüfung konnte nicht geladen werden.</h2>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
        </section>
      </div>
    );
  }

  if (loadStatus === "not-found" || !course) {
    return (
      <div className="page-stack elearning-page">
        <section className="empty-state">
          <h2>Kurs nicht gefunden</h2>
          <p>Für diesen Kurs konnte keine Prüfung geladen werden.</p>
          <Button as="a" href="/areas/elearning" appearance="primary" icon={<ArrowLeft20Regular />}>
            Zur Kursübersicht
          </Button>
        </section>
      </div>
    );
  }

  if (course.questions.length === 0) {
    return (
      <div className="page-stack elearning-page">
        <section className="empty-state">
          <h2>Keine Prüfungsfragen vorhanden</h2>
          <p>Für diesen Kurs wurden noch keine Fragen hinterlegt.</p>
          <Button as="a" href={`/areas/elearning/${course.slug}`} appearance="primary" icon={<ArrowLeft20Regular />}>
            Zurück zum Kurs
          </Button>
        </section>
      </div>
    );
  }

  if (result) {
    return (
      <div className="page-stack elearning-page">
        <section className="exam-results" aria-labelledby="exam-results-title">
          {result.passed !== null && <div className={`exam-results__icon${result.passed ? " exam-results__icon--passed" : ""}`}>
            {result.passed ? <CheckmarkCircle24Regular aria-hidden="true" /> : <DismissCircle24Regular aria-hidden="true" />}
          </div>}
          <h1 id="exam-results-title">Prüfung abgeschlossen!</h1>
          <p className="exam-results__course">{course.title} — Probeprüfung</p>

          <div className="exam-score-box">
            <div className={`exam-score-ring${result.passed === null ? " exam-score-ring--ungraded"
              : result.passed ? " exam-score-ring--passed" : ""}`}>
              <strong>{result.percentage}%</strong>
              <span>Ergebnis</span>
            </div>
            <div className="exam-score-details">
              <Badge appearance="tint" color={result.passed === null ? "informative" : result.passed ? "success" : "danger"}>
                {result.passed === null ? "Ohne Bestehensbewertung" : result.passed ? "Bestanden" : "Nicht bestanden"}
              </Badge>
              {course.passThreshold !== null && <p>Bestehensgrenze: {course.passThreshold ?? EXAM_PASS_THRESHOLD}%</p>}
            </div>
            <div className="exam-score-counts">
              <strong className="exam-score-counts__correct">{result.correctCount}</strong>
              <span>Richtig</span>
              <strong className="exam-score-counts__wrong">{result.totalQuestions - result.correctCount}</strong>
              <span>Falsch</span>
            </div>
          </div>

          <details className="exam-review">
            <summary className="exam-review__summary">
              <h2 id="exam-review-title">Alle Fragen im Rückblick</h2>
            </summary>
            <ExamReviewFilter value={reviewFilter} onChange={setReviewFilter} />
            <ol className="exam-history-review__list">
              {result.results.map((item, index) => {
                const status = item.isCorrect ? "correct" : item.selectedOptionIds.length > 0 ? "incorrect" : "open";
                if (!matchesExamReviewFilter(reviewFilter, status)) return null;
                const summaryText = status === "correct"
                  ? "1 Punkt (richtig)"
                  : status === "incorrect" ? "0 Punkte (falsch)" : "0 Punkte (übersprungen/nicht geprüft)";
                return (
                  <li key={item.question.id}>
                    <details className="exam-history-review__question-review">
                      <summary>
                        <span className="exam-history-review__question">
                          {item.isCorrect
                            ? <CheckmarkCircle24Regular
                              className="practice-review-option--correct exam-history-review__status-icon"
                              aria-label="Richtig beantwortet"
                            />
                            : item.selectedOptionIds.length > 0
                              ? <DismissCircle24Regular
                                className="practice-review-option--wrong exam-history-review__status-icon"
                                aria-label="Falsch beantwortet"
                              />
                              : <SubtractCircleRegular
                                className="exam-history-review__open-icon exam-history-review__status-icon"
                                aria-label="Nicht beantwortet"
                              />}
                          <span>Frage {index + 1}: {item.question.question}</span>
                        </span>
                        <span className={`exam-history-review__summary-status${status === "correct"
                          ? " practice-review-option--correct"
                          : status === "incorrect" ? " practice-review-option--wrong" : ""}`}>
                          {summaryText}
                        </span>
                      </summary>
                      <div className="exam-history-review__answer-card exam-history-review__answer-card--history">
                        {item.question.image && <QuestionContent question={{ question: "", image: item.question.image }} />}
                        <ul className="exam-history-review__options exam-history-review__options--standalone">
                          {item.question.options.map((option) => (
                            <li key={option.id} className="practice-review-option">
                              {item.selectedOptionIds.includes(option.id) ? "◉ " : "○ "}{option.text}
                              {item.correctOptionIds.includes(option.id)
                                ? <CheckmarkCircle24Regular className="practice-review-option--correct" aria-label="Richtige Antwort" />
                                : item.selectedOptionIds.includes(option.id)
                                  ? <DismissCircle24Regular className="practice-review-option--wrong" aria-label="Falsche Antwort" />
                                  : null}
                            </li>
                          ))}
                        </ul>
                        {item.explanation && (
                          <div className="exam-history-review__explanation exam-history-review__explanation--standalone">
                            <strong>Erklärung zur Lösung:</strong>
                            <p>{item.explanation}</p>
                          </div>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
              {result.results.every((item) => {
                const status = item.isCorrect ? "correct" : item.selectedOptionIds.length > 0 ? "incorrect" : "open";
                return !matchesExamReviewFilter(reviewFilter, status);
              }) && <li className="exam-review__empty">Keine Fragen in dieser Kategorie.</li>}
            </ol>
          </details>

          <div className="exam-results__actions">
            <Button appearance="secondary" onClick={() => navigate("/areas/elearning")}>Zur Kursübersicht</Button>
            <Button appearance="secondary" onClick={() => navigate("/areas/elearning/results")}>Auswertung ansehen</Button>
            <Button
              appearance="primary"
              onClick={() => {
                setResult(null);
                setAnswers({});
                setConfirmedQuestionIds([]);
                setCurrentIndex(0);
                setSecondsLeft(course.durationMinutes === null ? null
                  : (course.durationMinutes ?? COURSE_EXAM_DURATION_MINUTES) * 60);
                setSubmitError("");
                setSubmitStatus("ready");
                submissionStarted.current = false;
                timeoutSubmissionAttempted.current = false;
              }}
            >
              Nochmal versuchen
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const examQuestions = course.questions;
  const question = examQuestions[currentIndex];
  const isConfirmed = confirmedQuestionIds.includes(question.id);
  const selectedOptionIds = answers[question.id] ?? [];
  const unansweredQuestionCount = examQuestions.filter((entry) => (answers[entry.id] ?? []).length === 0).length;

  function toggleOption(optionId: string) {
    if (isConfirmed) return;
    setAnswers((previous) => {
      const previousSelection = previous[question.id] ?? [];
      const nextSelection = question.type === "single"
        ? [optionId]
        : previousSelection.includes(optionId)
          ? previousSelection.filter((id) => id !== optionId)
          : [...previousSelection, optionId];
      return { ...previous, [question.id]: nextSelection };
    });
  }

  function confirmAnswer() {
    if (selectedOptionIds.length === 0 || isConfirmed) return;
    const confirmed = [...confirmedQuestionIds, question.id];
    setConfirmedQuestionIds(confirmed);
    const nextIndex = examQuestions.findIndex((candidate) => !confirmed.includes(candidate.id));
    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex);
    } else {
      setConfirmSubmission(true);
    }
  }

  return (
    <div className="page-stack elearning-page exam-page">
      <header className="exam-header">
        <Link to={`/areas/elearning/${course.slug}`} className="elearning-back-link" aria-label="Zurück zum Kurs">
          <ArrowLeft20Regular aria-hidden="true" />
        </Link>
        <div className="exam-header__course">
          <strong>{course.title}</strong>
          <span>Probeprüfung</span>
        </div>
        <div className={`exam-timer${secondsLeft !== null && secondsLeft < 60 ? " exam-timer--urgent" : ""}`} aria-live="polite">
          <Clock20Regular aria-hidden="true" />
          <strong>{secondsLeft === null ? "Ohne Zeitlimit" : formatTime(secondsLeft)}</strong>
        </div>
        <span className="exam-header__step">Frage <strong>{currentIndex + 1}</strong> / {course.questions.length}</span>
        <Button appearance="secondary" onClick={() => setIsPaused(true)} disabled={isPaused}>
          Unterbrechen
        </Button>
        <Button appearance="secondary" onClick={() => setConfirmSubmission(true)}>Beenden</Button>
      </header>

      <nav className="exam-question-nav" aria-label="Fragenübersicht">
        {course.questions.map((entry, index) => {
          const confirmed = confirmedQuestionIds.includes(entry.id);
          return (
            <button
              key={entry.id}
              type="button"
              aria-label={`Frage ${index + 1}${confirmed ? ", beantwortet" : ""}`}
              aria-current={currentIndex === index ? "step" : undefined}
              className={`exam-question-nav__item${currentIndex === index ? " exam-question-nav__item--current" : ""}${confirmed ? " exam-question-nav__item--answered" : ""}`}
              onClick={() => setCurrentIndex(index)}
            >
              {index + 1}
            </button>
          );
        })}
      </nav>

      <div className="practice-card__progress">
        <ProgressBar
          value={((currentIndex + 1) / examQuestions.length) * 100}
          max={100}
          aria-label={`Fortschritt: Frage ${currentIndex + 1} von ${examQuestions.length}`}
        />
        <span>{currentIndex + 1} / {examQuestions.length}</span>
      </div>

      <article className="exam-question-card" aria-labelledby="exam-question-title">
        <div className="exam-question-card__meta">
          <Badge appearance="tint" color="informative">Frage {currentIndex + 1}</Badge>
          <span>{question.type === "multiple" ? "Mehrfachauswahl" : "Einfachauswahl"}</span>
        </div>
        <h1 id="exam-question-title"><QuestionContent question={question} /></h1>
        <p className="exam-question-card__hint">
          {question.type === "multiple" ? "Wähle alle zutreffenden Antworten aus." : "Wähle die richtige Antwort aus."}
        </p>
        <fieldset className="exam-options" disabled={isConfirmed || isPaused || submitStatus === "submitting"}>
          <legend className="visually-hidden">Antwortmöglichkeiten</legend>
          {question.options.map((option, optionIndex) => {
            const optionInputId = `${inputId}-${optionIndex}`;
            const selected = selectedOptionIds.includes(option.id);
            return (
              <label
                key={option.id}
                htmlFor={optionInputId}
                className={`exam-option${selected ? " exam-option--selected" : ""}`}
              >
                <input
                  id={optionInputId}
                  type={question.type === "multiple" ? "checkbox" : "radio"}
                  name={`exam-question-${question.id}`}
                  checked={selected}
                  onChange={() => toggleOption(option.id)}
                />
                <span className="exam-option__marker" aria-hidden="true">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                <span>{option.text}</span>
              </label>
            );
          })}
        </fieldset>
      </article>

      {submitError && <p className="exam-error" role="alert">{submitError}</p>}
      <div className="exam-question-actions">
        <Button
          appearance="primary"
          disabled={selectedOptionIds.length === 0 || isConfirmed || isPaused || submitStatus === "submitting"}
          onClick={confirmAnswer}
        >
          {submitStatus === "submitting"
            ? "Wird abgegeben …"
            : "Antwort bestätigen"}
        </Button>
      </div>

      {isPaused && (
        <section className="exam-paused" aria-label="Prüfung unterbrochen">
          <h2>Prüfung unterbrochen</h2>
          <p>Der Timer ist angehalten. Deine bisherigen Antworten bleiben erhalten.</p>
          <div>
            <Button appearance="primary" onClick={() => setIsPaused(false)}>Fortsetzen</Button>
            <Button appearance="secondary" onClick={() => { setIsPaused(false); setConfirmSubmission(true); }}>
              Prüfung abgeben
            </Button>
          </div>
        </section>
      )}

      {confirmSubmission && (
        <section className="exam-confirmation" role="alertdialog" aria-labelledby="exam-confirm-title">
          <h2 id="exam-confirm-title">Prüfung jetzt abgeben?</h2>
          <p>
            {unansweredQuestionCount > 0
              ? `${unansweredQuestionCount} unbeantwortete Frage(n) werden als falsch gewertet. `
              : ""}
            Die Lösungen und Erklärungen werden erst nach der Abgabe angezeigt.
          </p>
          {submitError && <p className="exam-error" role="alert">{submitError}</p>}
          <div>
            <Button appearance="secondary" disabled={submitStatus === "submitting"} onClick={() => setConfirmSubmission(false)}>
              Weiter prüfen
            </Button>
            <Button appearance="primary" disabled={submitStatus === "submitting"} onClick={() => void submitExam()}>
              {submitStatus === "submitting" ? "Wird abgegeben …" : "Jetzt abgeben"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
