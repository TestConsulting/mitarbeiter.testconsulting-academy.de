import { useMemo, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
} from "@fluentui/react-components";
import {
  ArrowRight20Regular,
  BookOpen24Regular,
  Delete20Regular,
  DocumentPdf20Regular,
  Edit20Regular,
  QuizNew24Regular,
  Search20Regular,
  Add20Regular,
} from "@fluentui/react-icons";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import type { CourseSummary, ExamAttempt } from "@portal/shared";
import { canManagePortal, EXAM_PASS_THRESHOLD } from "@portal/shared";
import { ApiError, api } from "../../api/client.js";
import { useAuth } from "../../app/auth-context.js";

const examDateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
});

export function ElearningPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = canManagePortal(user);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Alle");
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [latestExamByCourse, setLatestExamByCourse] = useState<Record<string, ExamAttempt>>({});
  const [examResultsStatus, setExamResultsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [examResultsLoadAttempt, setExamResultsLoadAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [deletingCourse, setDeletingCourse] = useState<CourseSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [categoryManagementOpen, setCategoryManagementOpen] = useState(false);
  const [categoryAction, setCategoryAction] = useState<{ mode: "rename" | "delete"; category: string } | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryReplacement, setCategoryReplacement] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    api.courses.list().then((data) => {
      if (!active) return;
      setCourses(data);
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    let active = true;
    setExamResultsStatus("loading");
    api.courses.examResults().then((attempts) => {
      if (!active) return;
      const latest = attempts.reduce<Record<string, ExamAttempt>>((current, attempt) => {
        const previous = current[attempt.courseId];
        if (!previous || Date.parse(attempt.submittedAt) > Date.parse(previous.submittedAt)) {
          current[attempt.courseId] = attempt;
        }
        return current;
      }, {});
      setLatestExamByCourse(latest);
      setExamResultsStatus("ready");
    }).catch(() => {
      if (active) setExamResultsStatus("error");
    });
    return () => { active = false; };
  }, [examResultsLoadAttempt]);

  const visibleCourses = isAdmin ? courses : courses.slice(0, 2);
  const availableCategories = useMemo(
    () => [...new Set(courses.map((course) => course.category))].sort((a, b) => a.localeCompare(b)),
    [courses],
  );

  const filteredCourses = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    const matches = visibleCourses.filter((course) => {
      const matchesCategory =
        selectedCategory === "Alle" || course.category === selectedCategory;
      const matchesSearch =
        query === "" ||
        course.title.toLowerCase().includes(query) ||
        course.description.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
    if (!query) return matches;
    function titlePriority(course: CourseSummary) {
      const title = course.title.toLowerCase();
      return title.startsWith(query) ? 2 : title.includes(query) ? 1 : 0;
    }
    return matches.sort((a, b) => titlePriority(b) - titlePriority(a));
  }, [visibleCourses, selectedCategory, searchTerm]);

  async function saveCategoryChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryAction || categoryBusy) return;
    setCategoryBusy(true);
    setCategoryError("");
    try {
      if (categoryAction.mode === "rename") {
        const name = categoryDraft.trim();
        await api.courses.renameCategory(categoryAction.category, name);
        setCourses((current) => current.map((course) =>
          course.category === categoryAction.category ? { ...course, category: name } : course));
        setSelectedCategory((current) => current === categoryAction.category ? name : current);
        setNotice(`Kategorie „${categoryAction.category}“ wurde in „${name}“ umbenannt.`);
      } else {
        await api.courses.deleteCategory(categoryAction.category, categoryReplacement);
        setCourses((current) => current.map((course) =>
          course.category === categoryAction.category ? { ...course, category: categoryReplacement } : course));
        setSelectedCategory((current) => current === categoryAction.category ? categoryReplacement : current);
        setNotice(`Kategorie „${categoryAction.category}“ wurde entfernt; betroffene Kurse gehören jetzt zu „${categoryReplacement}“.`);
      }
      setCategoryAction(null);
    } catch (failure) {
      setCategoryError(failure instanceof ApiError ? failure.message : "Die Kategorie konnte nicht geändert werden.");
    } finally {
      setCategoryBusy(false);
    }
  }

  function closeCategoryManager() {
    if (categoryBusy) return;
    setCategoryManagementOpen(false);
    setCategoryAction(null);
    setCategoryError("");
  }

  async function deleteCourse() {
    if (!deletingCourse) return;
    setBusy(true);
    setError("");
    try {
      await api.courses.delete(deletingCourse.id);
      setCourses((current) => current.filter((course) => course.id !== deletingCourse.id));
      setNotice(`Kurs „${deletingCourse.title}“ wurde gelöscht.`);
      setDeletingCourse(null);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Der Kurs konnte nicht gelöscht werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack elearning-page">
      <div className="page-heading">
        <h1>
          <BookOpen24Regular aria-hidden="true" /> eLearning
        </h1>
        <span>Lernen & Weiterbildung</span>
        {isAdmin && (
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => navigate("/areas/elearning/new")}>
            Kurs anlegen
          </Button>
        )}
      </div>

      <p className="elearning-intro">
        Hier findest du Lernmaterialien und Übungsfragen für deine Weiterbildung und die Vorbereitung auf Projekte und Zertifizierungen.
      </p>
      {isAdmin && <p className="elearning-admin-note">Du verwaltest Kurse, PDFs und Übungsfragen. Mitarbeitende sehen die ersten zwei Kurse.</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      {examResultsStatus === "error" && <MessageBar intent="error">
        <MessageBarBody>
          Prüfungsergebnisse konnten nicht geladen werden.
          <Button appearance="transparent" onClick={() => setExamResultsLoadAttempt((attempt) => attempt + 1)}>
            Erneut versuchen
          </Button>
        </MessageBarBody>
      </MessageBar>}
      {status === "loading" && <p role="status">Kurse werden geladen …</p>}
      {status === "error" && (
        <section className="empty-state" role="alert">
          <h2>Kurse konnten nicht geladen werden.</h2>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
        </section>
      )}

      {/* Filter and Search Bar */}
      {status === "ready" && <div className="elearning-toolbar">
        <div className="elearning-search-wrap">
          <Input
            className="elearning-search"
            contentBefore={<Search20Regular aria-hidden="true" />}
            placeholder="Kurstitel oder Beschreibung suchen…"
            value={searchTerm}
            onChange={(_e, data) => setSearchTerm(data.value)}
            aria-label="Kurse nach Titel oder Beschreibung durchsuchen"
          />
        </div>

        <div className="elearning-categories" role="group" aria-label="Kategoriefilter">
          <button
            type="button"
            className={`elearning-filter-btn${selectedCategory === "Alle" ? " elearning-filter-btn--active" : ""}`}
            onClick={() => setSelectedCategory("Alle")}
            aria-pressed={selectedCategory === "Alle"}
          >
            Alle
          </button>
          {availableCategories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                className={`elearning-filter-btn${isActive ? " elearning-filter-btn--active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
                aria-pressed={isActive}
              >
                {cat}
              </button>
            );
          })}
          {isAdmin && (
            <Button appearance="subtle" size="small" onClick={() => {
              setCategoryAction(null);
              setCategoryError("");
              setCategoryManagementOpen(true);
            }}>
              Kategorien verwalten
            </Button>
          )}
        </div>
      </div>}
      {categoryManagementOpen && (
        <Dialog open onOpenChange={(_event, data) => { if (!data.open) closeCategoryManager(); }}>
          <DialogSurface>
            <form onSubmit={saveCategoryChange}>
              <DialogBody>
                <DialogTitle>
                  {categoryAction?.mode === "rename" ? "Kategorie umbenennen"
                    : categoryAction?.mode === "delete" ? "Kategorie löschen" : "Kategorien verwalten"}
                </DialogTitle>
                <DialogContent className="course-category-manager">
                  {categoryError && <MessageBar intent="error"><MessageBarBody>{categoryError}</MessageBarBody></MessageBar>}
                  {!categoryAction && (
                    <>
                      {availableCategories.length === 0 && <p>Es gibt noch keine Kategorien mit zugeordneten Kursen.</p>}
                      <ul className="course-category-manager__list">
                        {availableCategories.map((category) => (
                          <li key={category}>
                            <span>{category}</span>
                            <div>
                              <Button type="button" appearance="subtle" size="small" icon={<Edit20Regular />}
                                aria-label={`${category} umbenennen`} onClick={() => {
                                  setCategoryDraft(category);
                                  setCategoryError("");
                                  setCategoryAction({ mode: "rename", category });
                                }} />
                              <Button type="button" appearance="subtle" size="small" icon={<Delete20Regular />}
                                aria-label={`${category} löschen`} onClick={() => {
                                  setCategoryReplacement(availableCategories.find((entry) => entry !== category) ?? "");
                                  setCategoryError("");
                                  setCategoryAction({ mode: "delete", category });
                                }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {categoryAction?.mode === "rename" && (
                    <Field label={`Neuer Name für „${categoryAction.category}“`} required>
                      <Input value={categoryDraft} onChange={(_event, data) => setCategoryDraft(data.value)} maxLength={80} required />
                    </Field>
                  )}
                  {categoryAction?.mode === "delete" && (
                    <>
                      <p>
                        Kurse aus „{categoryAction.category}“ werden der Ersatzkategorie zugeordnet.
                        Die Kurse und ihre Inhalte bleiben erhalten.
                      </p>
                      {availableCategories.some((entry) => entry !== categoryAction.category) ? (
                        <Field label="Ersatzkategorie" required>
                          <Select value={categoryReplacement} onChange={(_event, data) => setCategoryReplacement(data.value)} required>
                            {availableCategories.filter((entry) => entry !== categoryAction.category)
                              .map((entry) => <option value={entry} key={entry}>{entry}</option>)}
                          </Select>
                        </Field>
                      ) : <p>Lege zuerst eine weitere Kategorie an, bevor du diese löschen kannst.</p>}
                    </>
                  )}
                </DialogContent>
                <DialogActions>
                  {categoryAction ? (
                    <>
                      <Button type="button" appearance="secondary" disabled={categoryBusy} onClick={() => {
                        setCategoryAction(null);
                        setCategoryError("");
                      }}>Zurück</Button>
                      <Button type="submit" appearance="primary" disabled={categoryBusy ||
                        (categoryAction.mode === "delete" && !availableCategories.some((entry) => entry !== categoryAction.category))}>
                        {categoryBusy ? "Wird gespeichert …" : categoryAction.mode === "rename" ? "Umbenennen" : "Kategorie löschen"}
                      </Button>
                    </>
                  ) : <Button type="button" appearance="secondary" onClick={closeCategoryManager}>Schließen</Button>}
                </DialogActions>
              </DialogBody>
            </form>
          </DialogSurface>
        </Dialog>
      )}

      {/* Course Cards Grid */}
      {status === "ready" && filteredCourses.length === 0 ? (
        <section className="empty-state" aria-label="Keine Kurse gefunden">
          <h2>Keine Kurse gefunden</h2>
          <p>{visibleCourses.length === 0 && isAdmin ? "Lege den ersten eLearning-Kurs an." : "Für deine Such- oder Filterkriterien wurden keine passenden Kurse gefunden."}</p>
          <Button
            appearance="secondary"
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("Alle");
            }}
          >
            Filter zurücksetzen
          </Button>
        </section>
      ) : status === "ready" && (
        <div className="elearning-course-grid">
          {filteredCourses.map((course) => {
            const materialCount = course.materials.length;
            const questionCount = course.questionCount;

            return (
              <article key={course.id} className="elearning-card" aria-label={course.title}>
                <div className="elearning-card__header">
                  <span className={`elearning-badge elearning-badge--${course.category.toLowerCase()}`}>
                    {course.category}
                  </span>
                  {course.isDemo && (
                    <Badge appearance="tint" color="informative" size="small">
                      Demo
                    </Badge>
                  )}
                  {isAdmin && <div className="elearning-card__admin-actions">
                    <Button appearance="subtle" size="small" icon={<Edit20Regular />} aria-label={`${course.title} bearbeiten`} onClick={() => navigate(`/areas/elearning/${course.slug}/edit`)} />
                    <Button appearance="subtle" size="small" icon={<Delete20Regular />} aria-label={`${course.title} löschen`} onClick={() => setDeletingCourse(course)} />
                  </div>}
                </div>

                <h2 className="elearning-card__title">{course.title}</h2>
                <p className="elearning-card__description">{course.description}</p>

                <div className="elearning-card__contents" aria-label="Verfügbare Kursinhalte">
                  <span className="elearning-card__content-item">
                    <DocumentPdf20Regular aria-hidden="true" />
                    {materialCount > 0
                      ? `${materialCount} PDF-Lernmaterial`
                      : "Lernmaterialien folgen"}
                  </span>
                  <span className="elearning-card__content-item">
                    <QuizNew24Regular aria-hidden="true" />
                    {questionCount > 0 ? `${questionCount} Übungsfragen` : "Fragen in Vorbereitung"}
                  </span>
                </div>

                {examResultsStatus === "ready" && latestExamByCourse[course.id] && (() => {
                  const attempt = latestExamByCourse[course.id];
                  return (
                    <div className="elearning-card__last-exam" aria-label="Letztes Prüfungsergebnis">
                      <div>
                        <span className="elearning-card__last-exam-label">
                          Letzte Prüfung · {examDateFormatter.format(new Date(attempt.submittedAt))}
                        </span>
                        <strong>Richtigkeit: {attempt.percentage} %</strong>
                        {course.passThreshold !== null &&
                          <span>Bestehensgrenze: {course.passThreshold ?? EXAM_PASS_THRESHOLD} %</span>}
                      </div>
                      <Badge appearance="tint" color={attempt.passed === null ? "informative" : attempt.passed ? "success" : "danger"}>
                        {attempt.passed === null ? "Ohne Bestehensbewertung" : attempt.passed ? "Bestanden" : "Nicht bestanden"}
                      </Badge>
                    </div>
                  );
                })()}

                <div className="elearning-card__footer">
                  <Link
                    to={`/areas/elearning/${course.slug}`}
                    className="elearning-card__action-btn"
                  >
                    <span>Kurs ansehen</span>
                    <ArrowRight20Regular aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={deletingCourse !== null} onOpenChange={(_event, data) => { if (!data.open && !busy) setDeletingCourse(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Kurs löschen</DialogTitle>
            <DialogContent>
              Soll „{deletingCourse?.title}“ wirklich gelöscht werden? Lernmaterialien und Übungsfragen dieses Kurses sind danach nicht mehr verfügbar.
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" disabled={busy} onClick={() => setDeletingCourse(null)}>Abbrechen</Button>
              <Button appearance="primary" disabled={busy} onClick={deleteCourse}>{busy ? "Wird gelöscht …" : "Kurs löschen"}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
