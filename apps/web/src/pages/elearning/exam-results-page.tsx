import { useEffect, useMemo, useState } from "react";
import { Badge, Button, ProgressBar } from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  SubtractCircleRegular,
  Trophy24Regular,
} from "@fluentui/react-icons";
import { Link } from "react-router-dom";
import type { AbortedExamSession, ExamAttempt } from "@portal/shared";
import { api } from "../../api/client.js";
import { ExamReviewFilter, matchesExamReviewFilter, type ExamReviewFilterValue } from "./exam-review-filter.js";

type CoursePerformance = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  bestPercentage: number;
  averagePercentage: number;
  attempts: number;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function coursePerformances(attempts: ExamAttempt[]): CoursePerformance[] {
  const groups = new Map<string, ExamAttempt[]>();
  for (const attempt of attempts) {
    const group = groups.get(attempt.courseId) ?? [];
    group.push(attempt);
    groups.set(attempt.courseId, group);
  }

  return [...groups.entries()].map(([courseId, courseAttempts]) => ({
    courseId,
    courseSlug: courseAttempts[0].courseSlug,
    courseTitle: courseAttempts[0].courseTitle,
    bestPercentage: Math.max(...courseAttempts.map((attempt) => attempt.percentage)),
    averagePercentage: Math.round(
      courseAttempts.reduce((total, attempt) => total + attempt.percentage, 0) / courseAttempts.length,
    ),
    attempts: courseAttempts.length,
  }));
}

export function ExamResultsPage() {
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [abortedAttempts, setAbortedAttempts] = useState<AbortedExamSession[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [reviewFilters, setReviewFilters] = useState<Record<string, ExamReviewFilterValue>>({});

  useEffect(() => {
    let active = true;
    setStatus("loading");
    Promise.all([api.courses.examResults(), api.courses.abortedExamSessions()]).then(([results, aborted]) => {
      if (!active) return;
      setAttempts(results);
      setAbortedAttempts(aborted);
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, [loadAttempt]);

  const performances = useMemo(() => coursePerformances(attempts), [attempts]);
  const bestResult = attempts.reduce<ExamAttempt | null>(
    (best, attempt) => best === null || attempt.percentage > best.percentage ? attempt : best,
    null,
  );
  const averagePercentage = attempts.length > 0
    ? Math.round(attempts.reduce((total, attempt) => total + attempt.percentage, 0) / attempts.length)
    : 0;
  const visibleAttempts = showAll ? attempts : attempts.slice(0, 5);

  return (
    <div className="page-stack elearning-page exam-results-page">
      <div className="page-heading">
        <h1><CheckmarkCircle24Regular aria-hidden="true" /> Prüfungsauswertung</h1>
        <span>Deine bisherigen Prüfungen und Ergebnisse</span>
        <Link to="/areas/elearning" className="fui-Button fui-Button--secondary">
          <ArrowLeft20Regular aria-hidden="true" /> Zur Kursübersicht
        </Link>
      </div>

      {status === "loading" && <p role="status">Prüfungsergebnisse werden geladen …</p>}
      {status === "error" && (
        <section className="empty-state" role="alert">
          <h2>Prüfungsergebnisse konnten nicht geladen werden.</h2>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
        </section>
      )}

      {status === "ready" && abortedAttempts.length > 0 && (
        <section className="exam-history-card">
          <h2>Abgebrochene Prüfungen</h2>
          <p>Ohne Wertung · Nicht bestanden · Nicht im Durchschnitt enthalten</p>
          <ul>{abortedAttempts.map((attempt) => <li key={attempt.id}>
            {attempt.courseTitle} · {dateFormatter.format(new Date(attempt.finishedAt))} · Abgebrochen
          </li>)}</ul>
        </section>
      )}

      {status === "ready" && attempts.length === 0 && (
        <section className="empty-state exam-results-empty">
          <Trophy24Regular aria-hidden="true" />
          <h2>Noch keine Prüfungen abgelegt</h2>
          <p>Starte eine Probeprüfung aus einem Kurs. Deine Ergebnisse erscheinen anschließend hier.</p>
          <Link to="/areas/elearning" className="fui-Button fui-Button--primary">Kurse ansehen</Link>
        </section>
      )}

      {status === "ready" && attempts.length > 0 && (
        <>
          <section className="exam-results-summary" aria-label="Zusammenfassung deiner Prüfungsergebnisse">
            <div className="exam-summary-card">
              <span className="exam-summary-card__label">Abgelegte Prüfungen</span>
              <strong>{attempts.length}</strong>
            </div>
            <div className="exam-summary-card">
              <span className="exam-summary-card__label">Durchschnitt</span>
              <strong>{averagePercentage}%</strong>
            </div>
            <div className="exam-summary-card">
              <span className="exam-summary-card__label">Bestanden</span>
              <strong>{attempts.filter((attempt) => attempt.passed).length} / {attempts.length}</strong>
            </div>
          </section>

          <div className="exam-results-dashboard">
            <section className="exam-history-card" aria-labelledby="exam-history-heading">
              <div className="exam-dashboard-heading">
                <h2 id="exam-history-heading">Bisherige Ergebnisse</h2>
                {attempts.length > 5 && (
                  <Button appearance="subtle" onClick={() => setShowAll((visible) => !visible)}>
                    {showAll ? "Weniger anzeigen" : "Alle anzeigen"}
                  </Button>
                )}
              </div>
              <ol className="exam-history-list">
                {visibleAttempts.map((attempt) => (
                  <li key={attempt.id} className="exam-history-item">
                    <div className="exam-history-item__marker" aria-hidden="true" />
                    <div className="exam-history-item__details">
                      <div className="exam-history-item__title">
                        <Link to={`/areas/elearning/${attempt.courseSlug}`}>{attempt.courseTitle}</Link>
                        <Badge appearance="tint" color={attempt.passed ? "success" : "danger"}>
                          {attempt.passed ? "Bestanden" : "Nicht bestanden"}
                        </Badge>
                      </div>
                      <span className="exam-history-item__meta">
                        {dateFormatter.format(new Date(attempt.submittedAt))} · {attempt.totalQuestions} Fragen · {attempt.correctCount} richtig
                      </span>
                    </div>
                    <div className="exam-history-item__score">
                      <ProgressBar value={attempt.percentage} max={100} aria-label={`Ergebnis ${attempt.percentage}%`} />
                      <strong>{attempt.percentage}%</strong>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <aside className="exam-results-aside">
              {bestResult && (
                <section className="exam-best-card" aria-labelledby="exam-best-heading">
                  <h2 id="exam-best-heading">Beste Ergebnisse</h2>
                  <div className="exam-best-card__score">
                    <div className="exam-best-ring">
                      <strong>{bestResult.percentage}%</strong>
                      <span>Bestwert</span>
                    </div>
                  </div>
                  <ul className="exam-best-list">
                    {performances
                      .slice()
                      .sort((first, second) => second.bestPercentage - first.bestPercentage)
                      .map((performance) => (
                        <li key={performance.courseId}>
                          <Link to={`/areas/elearning/${performance.courseSlug}`}>{performance.courseTitle}</Link>
                          <strong>{performance.bestPercentage}%</strong>
                        </li>
                      ))}
                  </ul>
                </section>
              )}

              <section className="exam-strengths-card" aria-labelledby="exam-strengths-heading">
                <h2 id="exam-strengths-heading">Stärken &amp; Lernfelder</h2>
                <p>Durchschnitt deiner Ergebnisse je Kurs</p>
                <ul className="exam-performance-list">
                  {performances
                    .slice()
                    .sort((first, second) => second.averagePercentage - first.averagePercentage)
                    .map((performance) => (
                      <li key={performance.courseId}>
                        <div className="exam-performance-list__label">
                          <Link to={`/areas/elearning/${performance.courseSlug}`}>{performance.courseTitle}</Link>
                          <span>{performance.averagePercentage}% · {performance.attempts} {performance.attempts === 1 ? "Versuch" : "Versuche"}</span>
                        </div>
                        <ProgressBar
                          value={performance.averagePercentage}
                          max={100}
                          aria-label={`${performance.courseTitle}: durchschnittlich ${performance.averagePercentage}%`}
                        />
                      </li>
                    ))}
                </ul>
                {performances.length === 1 && (
                  <p className="exam-strengths-card__note">
                    Sobald du weitere Kurse prüfst, kannst du deine Ergebnisse hier vergleichen.
                  </p>
                )}
              </section>
            </aside>
          </div>

          {visibleAttempts.map((attempt) => (
            <details key={`review-${attempt.id}`} className="exam-history-review exam-history-review--attempt">
              <summary>
                <span>Prüfung ansehen: {attempt.courseTitle}</span>
                <span>{dateFormatter.format(new Date(attempt.submittedAt))} · {attempt.percentage}%</span>
              </summary>
              <ExamReviewFilter
                value={reviewFilters[attempt.id] ?? "all"}
                onChange={(value) => setReviewFilters((current) => ({ ...current, [attempt.id]: value }))}
              />
              <ol className="exam-history-review__list">
                {attempt.results.map((item, index) => {
                  const status = item.isCorrect ? "correct" : item.selectedOptionIds.length > 0 ? "incorrect" : "open";
                  if (!matchesExamReviewFilter(reviewFilters[attempt.id] ?? "all", status)) return null;
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
                          <ul className="exam-history-review__options exam-history-review__options--standalone">
                            {item.question.options.map((option) => (
                              <li key={option.id} className="practice-review-option">
                                {item.selectedOptionIds.includes(option.id) ? "◉ " : "○ "}{option.text}
                                {item.correctOptionIds.includes(option.id)
                                  ? <CheckmarkCircle24Regular
                                    className="practice-review-option--correct"
                                    aria-label="Richtige Antwort"
                                  />
                                  : item.selectedOptionIds.includes(option.id)
                                    ? <DismissCircle24Regular
                                      className="practice-review-option--wrong"
                                      aria-label="Falsche Antwort"
                                    />
                                    : null}
                              </li>
                            ))}
                          </ul>
                          <div className="exam-history-review__explanation exam-history-review__explanation--standalone">
                            <strong>Erklärung zur Lösung:</strong>
                            <p>{item.explanation}</p>
                          </div>
                        </div>
                      </details>
                    </li>
                  );
                })}
                {attempt.results.every((item) => {
                  const status = item.isCorrect ? "correct" : item.selectedOptionIds.length > 0 ? "incorrect" : "open";
                  return !matchesExamReviewFilter(reviewFilters[attempt.id] ?? "all", status);
                }) && <li className="exam-review__empty">Keine Fragen in dieser Kategorie.</li>}
              </ol>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
