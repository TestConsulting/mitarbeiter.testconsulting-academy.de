import { useEffect, useRef, useState } from "react";
import {
  Badge, Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, ProgressBar,
} from "@fluentui/react-components";
import {
  ArrowLeft20Regular, CheckmarkCircle24Regular, Clock20Regular, DismissCircle24Regular, SubtractCircleRegular,
} from "@fluentui/react-icons";
import { Link } from "react-router-dom";
import { CTFL_EXAM_CHAPTER_COUNTS, type ExamSession } from "@portal/shared";
import { ApiError, api } from "../../api/client.js";
import { ExamReviewFilter, matchesExamReviewFilter, type ExamReviewFilterValue } from "./exam-review-filter.js";
import { QuestionContent } from "./question-content.js";

const courseUrl = "/areas/elearning/istqb-foundation";
const chapterNames = [
  "Grundlagen des Testens", "Testen im Softwareentwicklungslebenszyklus", "Statischer Test",
  "Testanalyse und -entwurf", "Management der Testaktivitäten", "Testwerkzeuge",
];

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Die Verbindung ist unterbrochen. Bitte versuche es erneut.";
}

export function FoundationExamPage() {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [extended, setExtended] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [marked, setMarked] = useState<string[]>([]);
  const [reviewFilter, setReviewFilter] = useState<ExamReviewFilterValue>("all");
  const [confirm, setConfirm] = useState<"submit" | "abort" | null>(null);
  const [remaining, setRemaining] = useState(0);
  const answersRef = useRef<Record<string, string[]>>({});
  const dirty = useRef<Record<string, string[]>>({});
  const queue = useRef<Promise<void>>(Promise.resolve());
  const offset = useRef(0);
  const expiredRequest = useRef(false);
  const operation = useRef(false);

  function receive(value: ExamSession, hydrate = false) {
    offset.current = Date.parse(value.serverTime) - Date.now();
    setRemaining(Math.max(0, Math.ceil((Date.parse(value.expiresAt) - Date.parse(value.serverTime)) / 1000)));
    setSession(value);
    if (hydrate) {
      const saved = {
        ...Object.fromEntries(value.answers.map((answer) => [answer.questionId, answer.selectedOptionIds])),
        ...dirty.current,
      };
      answersRef.current = saved;
      setAnswers(saved);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.courses.currentExamSession().then((value) => {
      if (active && value && (value.status === "active" || value.status === "expired")) receive(value, true);
    }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    if (session?.status !== "active") return;
    function tick() {
      setRemaining(Math.max(0, Math.ceil((Date.parse(session!.expiresAt) - Date.now() - offset.current) / 1000)));
    }
    tick();
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, [session]);

  useEffect(() => {
    if (session?.status !== "active" || remaining > 0 || expiredRequest.current) return;
    expiredRequest.current = true;
    void finish("submit");
  }, [session?.status, remaining]);

  useEffect(() => {
    if (session?.status !== "active") return;
    function warn(event: BeforeUnloadEvent) {
      if (Object.keys(dirty.current).length > 0) event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [session?.status]);

  useEffect(() => {
    if (session?.status !== "active") return;
    let active = true;
    function synchronize() {
      if (Object.keys(dirty.current).length > 0) {
        void save().catch(() => { /* save reports the failure and keeps the changes for retry. */ });
        return;
      }
      const task = queue.current.then(async () => {
        if (!active || Object.keys(dirty.current).length > 0) return;
        const latest = await api.courses.currentExamSession();
        if (active && latest) receive(latest, true);
      });
      queue.current = task.catch((reason: unknown) => { if (active) setError(errorMessage(reason)); });
    }
    const timer = window.setInterval(synchronize, 15_000);
    window.addEventListener("focus", synchronize);
    window.addEventListener("online", synchronize);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", synchronize);
      window.removeEventListener("online", synchronize);
    };
  }, [session?.id, session?.status]);

  async function start() {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      receive(await api.courses.startExamSession(extended), true);
      setIndex(0);
      expiredRequest.current = false;
    } catch (reason) { setError(errorMessage(reason)); }
    finally { operation.current = false; setBusy(false); }
  }

  function save() {
    if (!session) return Promise.resolve();
    const id = session.id;
    setPending((value) => value + 1);
    const task = queue.current.then(async () => {
      const changes = { ...dirty.current };
      if (Object.keys(changes).length === 0) return;
      const saved = await api.courses.changeExamSession(id, "save", Object.entries(changes).map(
        ([questionId, selectedOptionIds]) => ({ questionId, selectedOptionIds }),
      ));
      for (const [questionId, selection] of Object.entries(changes)) {
        if (dirty.current[questionId] === selection) delete dirty.current[questionId];
      }
      receive(saved);
      setError("");
    });
    queue.current = task.catch((reason: unknown) => { setError(`Antworten nicht gespeichert: ${errorMessage(reason)}`); })
      .finally(() => setPending((value) => value - 1));
    return task;
  }

  function choose(questionId: string, selection: string[]) {
    answersRef.current = { ...answersRef.current, [questionId]: selection };
    dirty.current[questionId] = selection;
    setAnswers(answersRef.current);
    void save().catch(() => { /* The queue reports the error and retains unsaved changes. */ });
  }

  async function finish(action: "submit" | "abort") {
    if (!session || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      await queue.current;
      if (Object.keys(dirty.current).length > 0 && remaining > 0) await save();
      receive(await api.courses.changeExamSession(session.id, action));
      setConfirm(null);
      dirty.current = {};
    } catch (reason) { setError(errorMessage(reason)); }
    finally { operation.current = false; setBusy(false); }
  }

  const answered = session?.course.questions.filter((item) => (answers[item.id]?.length ?? 0) > 0).length ?? 0;
  const confirmationDialog = <Dialog key="exam-confirmation" open={confirm !== null}
    onOpenChange={(_event, data) => { if (!busy && !data.open) setConfirm(null); }}>
    <DialogSurface><DialogBody>
      <DialogTitle>{confirm === "abort" ? "Prüfung abbrechen?" : "Prüfung abgeben?"}</DialogTitle>
      <DialogContent>{confirm === "abort"
        ? "Der Versuch wird ohne Wertung als abgebrochen dokumentiert und kann nicht fortgesetzt werden."
        : `${40 - answered} Fragen sind noch ohne Auswahl. Unvollständige oder falsche Antworten zählen null Punkte. Nach der Abgabe sind keine Änderungen mehr möglich.`}
        <p>Die Prüfungszeit läuft während dieser Bestätigung weiter.</p>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setConfirm(null)}>Weiter bearbeiten</Button>
        <Button appearance="primary" disabled={busy} onClick={() => { if (confirm) void finish(confirm); }}>
          {confirm === "abort" ? "Endgültig abbrechen" : "Endgültig abgeben"}
        </Button>
      </DialogActions>
    </DialogBody></DialogSurface>
  </Dialog>;

  if (loading) return <p role="status">Prüfungsvorbereitung wird geladen …</p>;
  const errorBox = error && <div role="alert" className="empty-state">
    <p>{error}</p>
    <Button disabled={busy} onClick={() => {
      if (!session) setLoadAttempt((value) => value + 1);
      else if (remaining === 0) void finish("submit");
      else void save().catch(() => {});
    }}>Erneut versuchen</Button>
  </div>;

  if (!session) return <div className="page-stack elearning-page">
    <div className="elearning-nav-header">
      <Link to={courseUrl} className="elearning-back-link">
        <ArrowLeft20Regular aria-hidden="true" /><span>Zurück zum Kurs</span>
      </Link>
    </div>
    <div className="page-heading"><h1>ISTQB Foundation Level - Prüfungsmodus</h1></div>
    {errorBox}
    <section className="course-detail-card" aria-labelledby="exam-preparation-title">
      <div className="course-detail-card__heading">
        <h2 id="exam-preparation-title"><Clock20Regular aria-hidden="true" /> Prüfungssimulation</h2>
        <p>Teste dein Wissen unter prüfungsnahen Bedingungen.</p>
      </div>
      <div className="course-practice-metrics">
        <div className="metric-box"><strong className="metric-box__value">40</strong><span>Fragen</span></div>
        <div className="metric-box"><strong className="metric-box__value">60 / 75 Min</strong><span>Bearbeitungszeit</span></div>
        <div className="metric-box"><strong className="metric-box__value">26 / 40</strong><span>Bestanden ab 65 %</span></div>
      </div>
      <h3>Ablauf und Bewertung</h3>
      <ul>
        <li>40 unterschiedliche Fragen nach dem CTFL-Prüfungsbauplan.</li>
        <li>Jede vollständig richtige Antwort zählt einen Punkt. Maximal 40 Punkte; bestanden ab 26 Punkten.</li>
        <li>Bei Mehrfachauswahl muss die gesamte Antwortmenge stimmen. Keine Teil- oder Minuspunkte.</li>
        <li>Falsche, unbeantwortete oder unvollständige Antworten zählen null Punkte.</li>
        <li>Lösungen und Erklärungen erscheinen erst nach Abgabe oder Zeitablauf.</li>
      </ul>
      <h3>Prüfungsbedingungen</h3>
      <ul>
        <li>Keine Hilfsmittel, Unterlagen oder externe Unterstützung. Vorkenntnisse oder Kursabschluss sind keine Voraussetzung.</li>
        <li>Keine Pause: Die Zeit läuft auch bei Tabwechsel, Abmeldung oder geschlossenem Browser weiter.</li>
        <li>Antworten werden automatisch gespeichert. Achte auf den Speicherstatus; ohne Verbindung ist keine Speicherung möglich.</li>
        <li>Pro Benutzerkonto ist nur ein aktiver Prüfungsversuch möglich. Du kannst ihn nach erneuter Anmeldung fortsetzen.</li>
        <li>Abgebrochene Versuche werden separat dokumentiert und gelten niemals als bestanden.</li>
      </ul>
      <details className="exam-history-review exam-blueprint-distribution">
        <summary>Themen- und Wissensverteilung der 40 Prüfungsfragen</summary>
        <ul>{chapterNames.map((name, chapter) => <li key={name}>{name}: {CTFL_EXAM_CHAPTER_COUNTS[chapter]} Fragen</li>)}</ul>
        <p>K1 – Erinnern: 8 · K2 – Verstehen: 24 · K3 – Anwenden: 8</p>
      </details>
      <Checkbox checked={extended} disabled={busy} onChange={(_event, data) => setExtended(data.checked === true)}
        label="Prüfungssprache ist nicht meine Muttersprache" />
      <p>Diese Übungsoption verlängert die Zeit auf 75 Minuten und ist kein Antrag auf einen offiziellen Nachteilsausgleich.
        Die Dauer lässt sich nach dem Start nicht mehr ändern.</p>
      <p><strong>Gewählte Dauer: {extended ? 75 : 60} Minuten.</strong> Erst „Prüfung starten“ startet die Uhr.</p>
      <p>Eigene Übungsfragen – keine offiziellen ISTQB-Prüfungsfragen. Dies ist keine Zertifizierungsprüfung.</p>
      <div className="course-practice-actions foundation-exam__start-actions">
        <Button appearance="primary" disabled={busy || Boolean(error)} onClick={() => void start()}>Prüfung starten</Button>
      </div>
    </section>
    {confirmationDialog}
  </div>;

  const durationSeconds = session.finishedAt === null ? null : Math.max(0,
    Math.floor((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 1000));
  const examChapters = [...new Set(session.course.questions
    .map((question) => question.metadata?.chapter)
    .filter((chapter): chapter is number => chapter !== undefined))]
    .sort((first, second) => first - second);
  const examResults = session.result?.results ?? [];

  if (session.status !== "active") return <div className="page-stack elearning-page">
    <div className="elearning-nav-header">
      <Link to={courseUrl} className="elearning-back-link">
        <ArrowLeft20Regular aria-hidden="true" />
        <span>Zurück zum Kurs „ISTQB Foundation“</span>
      </Link>
    </div>
    <section className="exam-results">
      <header className="practice-results-header">
        <h1>{session.status === "aborted" ? "Prüfung abgebrochen" : "Prüfung abgeschlossen!"}</h1>
        <p className="practice-results-course">Kurs: {session.course.title}</p>
        {session.finishedAt !== null && <p>
          {session.status === "aborted" ? "Abgebrochen" : session.status === "expired" ? "Automatisch abgegeben" : "Abgegeben"}: {new Date(session.finishedAt).toLocaleString("de-DE")}
        </p>}
        <p>Zeitlimit: {session.durationMinutes} Minuten{durationSeconds !== null &&
          <> · Bearbeitungsdauer: {Math.floor(durationSeconds / 60)} Minuten {durationSeconds % 60} Sekunden</>}
        </p>
      </header>
      {session.status === "expired" && <p>Die Bearbeitungszeit ist abgelaufen. Deine gespeicherten Antworten wurden ausgewertet.</p>}
      {session.status === "aborted" && <p>Dieser Versuch wurde separat dokumentiert und gilt nicht als bestanden.</p>}
      {session.result && <>
        <div className="exam-score-box">
          <div className={`exam-score-ring${session.result.passed ? " exam-score-ring--passed" : ""}`}>
            <strong>{session.result.percentage}%</strong><span>Ergebnis</span>
          </div>
          <div className="exam-score-details">
            <Badge color={session.result.passed ? "success" : "danger"}>{session.result.passed ? "Bestanden" : "Nicht bestanden"}</Badge>
            <p>{session.result.correctCount} / 40 Punkte · Bestehensgrenze: 26 Punkte (65 %)</p>
          </div>
        </div>
        {examChapters.length > 0 && <section className="practice-card" aria-labelledby="exam-chapters-title">
          <h2 id="exam-chapters-title">Kapitelwerte und Lernempfehlungen</h2>
          <div className="practice-results-table-wrapper">
            <table className="practice-results-table">
              <caption>Ergebnis pro Kapitel</caption>
              <thead><tr>
                <th scope="col">Kapitel</th><th scope="col">Richtig</th><th scope="col">Falsch</th>
                <th scope="col">Offen</th><th scope="col">Gesamt</th><th scope="col">Punkte</th>
                <th scope="col">Empfehlung</th>
              </tr></thead>
              <tbody>{examChapters.map((chapter) => {
                const chapterQuestions = session.course.questions.filter((question) =>
                  question.metadata?.chapter === chapter);
                const chapterResults = examResults.filter((result) =>
                  result.question.metadata?.chapter === chapter);
                const right = chapterResults.filter((result) => result.isCorrect).length;
                const wrong = chapterResults.filter((result) =>
                  !result.isCorrect && result.selectedOptionIds.length > 0).length;
                const open = chapterQuestions.length - right - wrong;
                return <tr key={chapter}>
                  <th scope="row">{chapter}. {chapterQuestions[0].metadata?.chapterTitle ?? chapterNames[chapter - 1]}</th>
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
        </section>}
        <details className="exam-review">
          <summary className="exam-review__summary"><h2>Alle Fragen im Rückblick</h2></summary>
          <ExamReviewFilter value={reviewFilter} onChange={setReviewFilter} />
          {session.result.results.map((item, number) => {
            const status = item.isCorrect ? "correct" : item.selectedOptionIds.length > 0 ? "incorrect" : "open";
            if (!matchesExamReviewFilter(reviewFilter, status)) return null;
            const summaryText = status === "correct"
              ? "1 Punkt (richtig)"
              : status === "incorrect" ? "0 Punkte (falsch)" : "0 Punkte (übersprungen/nicht geprüft)";
            return (
            <details key={item.question.id} className="exam-history-review">
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
                <span>Frage {number + 1}: {item.question.question}</span>
              </span>
              <span className={`exam-history-review__summary-status${status === "correct"
                ? " practice-review-option--correct"
                : status === "incorrect" ? " practice-review-option--wrong" : ""}`}>
                {summaryText}
              </span>
            </summary>
            <div className="exam-history-review__answer-card">
              {item.question.image && <QuestionContent question={{ question: "", image: item.question.image }} />}
              <ul className="exam-history-review__options exam-history-review__options--standalone">{item.question.options.map((option) => <li key={option.id} className="practice-review-option">
                {item.selectedOptionIds.includes(option.id) ? "◉ " : "○ "}{option.text}
                {item.correctOptionIds.includes(option.id)
                  ? <CheckmarkCircle24Regular className="practice-review-option--correct" aria-label="Richtige Antwort" />
                  : item.selectedOptionIds.includes(option.id)
                    ? <DismissCircle24Regular className="practice-review-option--wrong" aria-label="Falsche Antwort" /> : null}
              </li>)}</ul>
              <div className="exam-history-review__explanation exam-history-review__explanation--standalone">
                <strong>Erklärung zur Lösung:</strong>
                <p>{item.explanation}</p>
              </div>
            </div>
            </details>
            );
          })}
          {session.result.results.every((item) => {
            const status = item.isCorrect ? "correct" : item.selectedOptionIds.length > 0 ? "incorrect" : "open";
            return !matchesExamReviewFilter(reviewFilter, status);
          }) && <p className="exam-review__empty">Keine Fragen in dieser Kategorie.</p>}
        </details>
      </>}
      <div className="course-practice-actions">
        <Button appearance="primary" onClick={() => { setSession(null); setError(""); setMarked([]); }}>Neue Prüfung vorbereiten</Button>
        <Link to="/areas/elearning/results" className="fui-Button fui-Button--secondary">Prüfungsverlauf</Link>
        <Link to={courseUrl} className="fui-Button fui-Button--secondary">Zurück zum Kurs</Link>
      </div>
    </section>
    {confirmationDialog}
  </div>;

  const question = session.course.questions[index];
  const selected = answers[question.id] ?? [];
  const disabled = busy || remaining === 0;
  return <div className="page-stack elearning-page">
    <div className="page-heading"><h1>ISTQB Foundation Level - Prüfungsmodus</h1></div>
    {errorBox}
    <section className="practice-card">
      <div className="course-practice-actions">
      <span>Verbleibende Zeit:</span>
      <strong role="timer" aria-label="Verbleibende Zeit">{Math.floor(remaining / 60).toString().padStart(2, "0")}:{(remaining % 60).toString().padStart(2, "0")}</strong>
        {(pending > 0 || Object.keys(dirty.current).length > 0) && (
          <span role="status">{pending > 0 ? "Antworten werden gespeichert …" : "Nicht gespeicherte Antworten"}</span>
        )}
        <span>{answered} / 40 beantwortet</span>
      </div>
      <nav className="practice-question-grid" aria-label="Prüfungsfragen">
        {session.course.questions.map((item, number) => <Button key={item.id} size="small"
          className={`practice-question-grid__item${number === index ? " practice-question-grid__item--current" : ""
          }${answers[item.id]?.length ? " practice-question-grid__item--answered" : ""}`}
          appearance={number === index ? "primary" : "secondary"} onClick={() => setIndex(number)}
          aria-current={number === index ? "step" : undefined}
          aria-label={`Frage ${number + 1}${answers[item.id]?.length ? ", beantwortet" : ", offen"}${marked.includes(item.id) ? ", markiert" : ""}`}>
          {number + 1}{marked.includes(item.id) ? " ⚑" : ""}
        </Button>)}
      </nav>
      <div className="practice-card__progress">
        <ProgressBar
          value={((index + 1) / session.course.questions.length) * 100}
          max={100}
          aria-label={`Fortschritt: Frage ${index + 1} von ${session.course.questions.length}`}
        />
        <span>{index + 1} / {session.course.questions.length}</span>
      </div>
      <h2>Frage {index + 1} von 40</h2>
      <fieldset className="practice-options" disabled={disabled}>
        <legend><QuestionContent question={question} /></legend>
        <p>{question.type === "multiple" ? `Wähle ${question.requiredSelections} Antworten.` : "Wähle eine Antwort."}</p>
        {question.options.map((option) => <label className={`practice-option${selected.includes(option.id) ? " practice-option--selected" : ""}`} key={option.id}>
          <input type={question.type === "multiple" ? "checkbox" : "radio"} name={question.id}
            className="practice-option__input"
            checked={selected.includes(option.id)} onChange={() => choose(question.id, question.type === "single"
              ? [option.id] : selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id])} />
          <span className="practice-option__box" aria-hidden="true">{selected.includes(option.id) && <span className="practice-option__dot" />}</span>
          <span className="practice-option__text">{option.text}</span>
        </label>)}
      </fieldset>
      <Checkbox checked={marked.includes(question.id)} label="Frage markieren"
        onChange={(_event, data) => setMarked((ids) => data.checked ? [...ids, question.id] : ids.filter((id) => id !== question.id))} />
      <div className="practice-card__footer foundation-exam__footer">
        <div className="practice-card__answer-actions">
          <Button disabled={disabled || selected.length === 0}
            onClick={() => choose(question.id, [])}>Auswahl aufheben</Button>
        </div>
        <div className="practice-card__navigation">
          <Button disabled={index === 0 || disabled} onClick={() => setIndex((value) => value - 1)}>
            Vorherige Frage
          </Button>
          <Button disabled={index === 39 || disabled} onClick={() => setIndex((value) => value + 1)}>
            {selected.length ? "Nächste Frage" : "Überspringen"}
          </Button>
        </div>
        <div className="practice-card__submit foundation-exam__submit">
          <Button appearance="primary" disabled={disabled} onClick={() => setConfirm("submit")}>
            Prüfung abgeben
          </Button>
          <Button disabled={disabled} onClick={() => setConfirm("abort")}>Prüfung abbrechen</Button>
        </div>
      </div>
    </section>
    {confirmationDialog}
  </div>;
}
