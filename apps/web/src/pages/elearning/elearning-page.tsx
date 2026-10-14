import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  MessageBar,
  MessageBarBody,
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
import { Link } from "react-router-dom";
import { useEffect } from "react";
import type { Course, CourseInput, CourseCategory } from "@portal/shared";
import { canManagePortal } from "@portal/shared";
import { ApiError, api } from "../../api/client.js";
import { useAuth } from "../../app/auth-context.js";
import {
  courseCategories,
} from "./elearning-data.js";
import { CourseEditorDialog } from "./course-editor-dialog.js";

export function ElearningPage() {
  const { user } = useAuth();
  const isAdmin = canManagePortal(user);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"Alle" | CourseCategory>("Alle");
  const [courses, setCourses] = useState<Course[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
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

  const visibleCourses = isAdmin ? courses : courses.slice(0, 2);

  const filteredCourses = useMemo(() => {
    return visibleCourses.filter((course) => {
      const matchesCategory =
        selectedCategory === "Alle" || course.category === selectedCategory;
      const matchesSearch =
        searchTerm.trim() === "" ||
        course.title.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase().trim());
      return matchesCategory && matchesSearch;
    });
  }, [visibleCourses, selectedCategory, searchTerm]);

  async function saveCourse(input: CourseInput): Promise<Course> {
    setError("");
    try {
      const saved = editingCourse
        ? await api.courses.update(editingCourse.id, input)
        : await api.courses.create(input);
      setCourses((current) => editingCourse
        ? current.map((course) => course.id === saved.id ? saved : course)
        : [...current, saved]);
      setNotice(`Kurs „${saved.title}“ wurde gespeichert.`);

      if (editingCourse) {
        const removedFiles = editingCourse.materials
          .filter((material) => material.url.startsWith("/api/courses/materials/"))
          .filter((material) => !saved.materials.some((entry) => entry.id === material.id));
        const cleanup = await Promise.allSettled(removedFiles.map((material) => api.courses.deleteMaterial(material.id)));
        if (cleanup.some((result) => result.status === "rejected")) {
          setError("Der Kurs wurde gespeichert, aber mindestens eine entfernte PDF-Datei konnte nicht gelöscht werden.");
        }
      }
      return saved;
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Der Kurs konnte nicht gespeichert werden.");
      throw failure;
    }
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
          <Button appearance="primary" icon={<Add20Regular />} onClick={() => setCreatingCourse(true)}>
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
            placeholder="Kurstitel suchen…"
            value={searchTerm}
            onChange={(_e, data) => setSearchTerm(data.value)}
            aria-label="Kurse nach Titel durchsuchen"
          />
        </div>

        <div className="elearning-categories" role="group" aria-label="Kategoriefilter">
          {courseCategories.map((cat) => {
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
        </div>
      </div>}

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
            const questionCount = course.questions.length;

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
                    <Button appearance="subtle" size="small" icon={<Edit20Regular />} aria-label={`${course.title} bearbeiten`} onClick={() => setEditingCourse(course)} />
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

      {(creatingCourse || editingCourse) && (
        <CourseEditorDialog
          course={editingCourse ?? undefined}
          onSave={saveCourse}
          onClose={() => { setCreatingCourse(false); setEditingCourse(null); }}
        />
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
