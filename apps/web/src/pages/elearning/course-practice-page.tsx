import { useEffect, useId, useState } from "react";
import { Badge, Button, ProgressBar } from "@fluentui/react-components";
import {
  ArrowCounterclockwise20Regular,
  ArrowLeft20Regular,
  ArrowRight20Regular,
  Checkmark20Regular,
  CheckmarkCircle24Regular,
  Dismiss20Regular,
  DismissCircle24Regular,
  Info20Regular,
} from "@fluentui/react-icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Course, PracticeQuestion } from "@portal/shared";
import { ApiError, api } from "../../api/client.js";

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
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [evaluations, setEvaluations] = useState<AnswerEvaluation[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const baseInputId = useId();

  useEffect(() => {
    let active = true;
    if (!courseId) {
      setLoadStatus("not-found");
      return () => { active = false; };
    }
    setLoadStatus("loading");
    api.courses.get(courseId).then((loadedCourse) => {
      if (!active) return;
      setCourse(loadedCourse);
      setLoadStatus("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
    });
    return () => { active = false; };
  }, [courseId, loadAttempt]);

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

  const currentQuestion: PracticeQuestion = course.questions[currentIndex];
  const totalQuestions = course.questions.length;
  const isMultiple = currentQuestion.type === "multiple";

  function handleOptionToggle(optionId: string) {
    if (isAnswerChecked) return;

    if (isMultiple) {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
    } else {
      setSelectedOptionIds([optionId]);
    }
  }

  function handleCheckAnswer() {
    if (selectedOptionIds.length === 0 || isAnswerChecked) return;

    // Evaluate correctness:
    // A single or multiple answer is correct iff:
    // 1) all selected options are in correctOptionIds
    // 2) all correctOptionIds are selected
    const correctIds = currentQuestion.correctOptionIds;
    const isCorrect =
      selectedOptionIds.length === correctIds.length &&
      selectedOptionIds.every((id) => correctIds.includes(id));

    const evaluation: AnswerEvaluation = {
      questionId: currentQuestion.id,
      selectedOptionIds: [...selectedOptionIds],
      isCorrect,
    };

    setEvaluations((prev) => [...prev, evaluation]);
    setIsAnswerChecked(true);
  }

  function handleNextQuestion() {
    if (currentIndex + 1 < totalQuestions) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOptionIds([]);
      setIsAnswerChecked(false);
    } else {
      setIsFinished(true);
    }
  }

  function handleRestart() {
    setCurrentIndex(0);
    setSelectedOptionIds([]);
    setIsAnswerChecked(false);
    setEvaluations([]);
    setIsFinished(false);
  }

  // Calculate results for finished screen
  const correctCount = evaluations.filter((item) => item.isCorrect).length;

  const percentage = Math.round((correctCount / totalQuestions) * 100);

  // Completed / Summary View
  if (isFinished) {
    return (
      <div className="page-stack elearning-page">
        <div className="elearning-nav-header">
          <Link to={`/areas/elearning/${course.slug}`} className="elearning-back-link">
            <ArrowLeft20Regular aria-hidden="true" />
            <span>Zurück zum Kurs „{course.title}“</span>
          </Link>
        </div>

        <section className="practice-card practice-card--results" aria-labelledby="practice-results-title">
          <div className="practice-results-header">
            {course.isDemo && (
              <Badge appearance="tint" color="informative" size="small">
                Demo-Übungsdurchlauf
              </Badge>
            )}
            <h1 id="practice-results-title">Übung abgeschlossen</h1>
            <p className="practice-results-course">Kurs: {course.title}</p>
          </div>

          <div className="practice-score-box">
            <div className="practice-score-ring">
              <span className="practice-score-ring__percent">{percentage} %</span>
              <span className="practice-score-ring__label">Richtig</span>
            </div>
            <div className="practice-score-details">
              <h2>Dein Gesamtergebnis</h2>
              <p className="practice-score-text">
                <strong>{correctCount}</strong> von <strong>{totalQuestions}</strong> Fragen richtig beantwortet ({percentage} %).
              </p>
              {course.isDemo && (
                <div className="practice-demo-alert" role="note">
                  <Info20Regular aria-hidden="true" />
                  <span>
                    Dieses Ergebnis basiert auf deinem aktuellen Übungsdurchlauf mit didaktischen Beispielinhalten.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Question Breakdown */}
          <div className="practice-breakdown">
            <h3>Fragenübersicht aus diesem Durchlauf</h3>
            <ul className="practice-breakdown-list">
              {course.questions.map((q, idx) => {
                const evalItem = evaluations.find((item) => item.questionId === q.id);
                const wasCorrect = evalItem?.isCorrect ?? false;
                return (
                  <li
                    key={q.id}
                    className={`practice-breakdown-item ${
                      wasCorrect ? "practice-breakdown-item--correct" : "practice-breakdown-item--incorrect"
                    }`}
                  >
                    <span className="practice-breakdown-item__icon" aria-hidden="true">
                      {wasCorrect ? <CheckmarkCircle24Regular /> : <DismissCircle24Regular />}
                    </span>
                    <div className="practice-breakdown-item__content">
                      <span className="practice-breakdown-item__num">Frage {idx + 1}</span>
                      <p className="practice-breakdown-item__question">{q.question}</p>
                      <span className="practice-breakdown-item__status">
                        {wasCorrect ? "Richtig beantwortet" : "Falsch beantwortet"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="practice-results-actions">
            <Button
              appearance="primary"
              icon={<ArrowCounterclockwise20Regular aria-hidden="true" />}
              onClick={handleRestart}
            >
              Erneut üben
            </Button>
            <Button
              appearance="secondary"
              icon={<ArrowLeft20Regular aria-hidden="true" />}
              onClick={() => navigate(`/areas/elearning/${course.slug}`)}
            >
              Zurück zum Kurs
            </Button>
          </div>
        </section>
      </div>
    );
  }

  // Active Question View
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;
  const currentEvaluation = evaluations[currentIndex];
  const isCorrect = currentEvaluation?.isCorrect;

  return (
    <div className="page-stack elearning-page">
      <div className="elearning-nav-header">
        <Link to={`/areas/elearning/${course.slug}`} className="elearning-back-link">
          <ArrowLeft20Regular aria-hidden="true" />
          <span>Übung beenden & zurück zum Kurs</span>
        </Link>
      </div>

      <div className="practice-container">
        {/* Progress & Context Header */}
        <div className="practice-header">
          <div className="practice-header__top">
            <div className="practice-header__title-group">
              <span className="practice-header__course-name">{course.title}</span>
              {course.isDemo && (
                <Badge appearance="tint" color="informative" size="small">
                  Demo
                </Badge>
              )}
            </div>
            <span className="practice-header__step" aria-live="polite">
              Frage {currentIndex + 1} von {totalQuestions}
            </span>
          </div>

          <ProgressBar
            value={progressPercent}
            max={100}
            className="practice-progress-bar"
            aria-label={`Fortschritt: Frage ${currentIndex + 1} von ${totalQuestions}`}
          />
        </div>

        {/* Question Card */}
        <article className="practice-card" aria-labelledby="current-question-text">
          <div className="practice-card__type-banner">
            <span className="practice-type-tag">
              {isMultiple
                ? "Mehrfachauswahl (Wähle alle zutreffenden Antworten)"
                : "Einfachauswahl (Wähle eine richtige Antwort)"}
            </span>
          </div>

          <h2 id="current-question-text" className="practice-card__question">
            {currentQuestion.question}
          </h2>

          {/* Options Form / List */}
          <fieldset className="practice-options" disabled={isAnswerChecked}>
            <legend className="visually-hidden">Antwortmöglichkeiten</legend>

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
                    disabled={isAnswerChecked}
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

          {/* Action Buttons */}
          <div className="practice-card__actions">
            {!isAnswerChecked ? (
              <Button
                appearance="primary"
                onClick={handleCheckAnswer}
                disabled={selectedOptionIds.length === 0}
                className="practice-action-btn"
              >
                Antwort prüfen
              </Button>
            ) : (
              <Button
                appearance="primary"
                onClick={handleNextQuestion}
                icon={<ArrowRight20Regular aria-hidden="true" />}
                className="practice-action-btn"
              >
                {currentIndex + 1 < totalQuestions ? "Nächste Frage" : "Ergebnis ansehen"}
              </Button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
