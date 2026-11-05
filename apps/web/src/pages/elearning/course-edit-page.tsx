import { useEffect, useRef, useState } from "react";
import { Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { canManagePortal, getCourseUploadedFileIds, type Course, type CourseInput } from "@portal/shared";
import { ApiError, api } from "../../api/client.js";
import { useAuth } from "../../app/auth-context.js";
import { CourseEditorDialog } from "./course-editor-dialog.js";

export function CourseEditPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const isAdmin = canManagePortal(user);
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const cleanupFailed = useRef(false);
  const [savedWithCleanupError, setSavedWithCleanupError] = useState<Course | null>(null);

  useEffect(() => {
    let active = true;
    if (!isAdmin || !courseId) return;
    setStatus("loading");
    Promise.all([api.courses.getAdmin(courseId), api.courses.list()]).then(([loadedCourse, courses]) => {
      if (!active) return;
      setCourse(loadedCourse);
      setCategories([...new Set(courses.map((entry) => entry.category))]);
      setStatus("ready");
    }).catch((failure: unknown) => {
      if (!active) return;
      setError(failure instanceof ApiError ? failure.message : "Der Kurs konnte nicht geladen werden.");
      setStatus("error");
    });
    return () => { active = false; };
  }, [courseId, isAdmin, loadAttempt]);

  if (!isAdmin) return <Navigate to="/areas/elearning" replace />;

  async function saveCourse(input: CourseInput): Promise<Course> {
    if (!course) throw new Error("Der Kurs ist noch nicht geladen.");
    const saved = await api.courses.update(course.id, input);
    const savedFileIds = new Set(getCourseUploadedFileIds(saved));
    const removedFileIds = getCourseUploadedFileIds(course).filter((id) => !savedFileIds.has(id));
    const cleanup = await Promise.allSettled(removedFileIds.map((id) => api.courses.deleteMaterial(id)));
    cleanupFailed.current = cleanup.some((result) => result.status === "rejected");
    return saved;
  }

  function closeEditor(saved?: Course) {
    if (saved && cleanupFailed.current) {
      setSavedWithCleanupError(saved);
      return;
    }
    navigate(saved ? `/areas/elearning/${saved.slug}` : "/areas/elearning");
  }

  if (status === "ready" && course && !savedWithCleanupError) {
    return <CourseEditorDialog key={course.id} presentation="page" course={course} categories={categories}
      onSave={saveCourse} onClose={closeEditor} />;
  }

  return (
    <div className="page-stack elearning-page course-editor-page">
      <Link to="/areas/elearning" className="elearning-back-link">Zurück zur Kursübersicht</Link>
      <h1>Kurs bearbeiten</h1>
      {savedWithCleanupError ? (
        <MessageBar intent="warning">
          <MessageBarBody>
            Der Kurs wurde gespeichert, aber mindestens eine entfernte Materialdatei konnte nicht gelöscht werden.
            <Link to={`/areas/elearning/${savedWithCleanupError.slug}`}>Zum Kurs</Link>
          </MessageBarBody>
        </MessageBar>
      ) : status === "error" ? (
        <MessageBar intent="error">
          <MessageBarBody>
            {error}
            <Button appearance="transparent" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
          </MessageBarBody>
        </MessageBar>
      ) : <p role="status">Kursdaten werden geladen …</p>}
    </div>
  );
}
