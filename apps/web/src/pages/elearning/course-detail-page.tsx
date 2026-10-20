import { useEffect, useState } from "react";
import { Badge, Button } from "@fluentui/react-components";
import {
  ArrowDownload20Regular,
  ArrowLeft20Regular,
  BookOpen24Regular,
  Clock20Regular,
  Info20Regular,
  Play20Regular,
  QuizNew24Regular,
} from "@fluentui/react-icons";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CourseSummary } from "@portal/shared";
import { ApiError, api } from "../../api/client.js";

const imageExtensions = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]);

function isImageMaterial(fileName: string) {
  const extension = fileName.match(/\.[^.]+$/)?.[0].toLowerCase();
  return extension !== undefined && imageExtensions.has(extension);
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (!courseId) {
      setStatus("not-found");
      return () => { active = false; };
    }
    setStatus("loading");
    api.courses.get(courseId).then((loadedCourse) => {
      if (!active) return;
      setCourse(loadedCourse);
      setStatus("ready");
    }).catch((error: unknown) => {
      if (!active) return;
      setStatus(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
    });
    return () => { active = false; };
  }, [courseId, loadAttempt]);

  if (status === "loading") {
    return <div className="page-stack elearning-page"><p role="status">Kurs wird geladen …</p></div>;
  }

  if (status === "error") {
    return (
      <div className="page-stack elearning-page">
        <section className="empty-state" role="alert">
          <h2>Kurs konnte nicht geladen werden.</h2>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
        </section>
      </div>
    );
  }

  if (status === "not-found" || !course) {
    return (
      <div className="page-stack elearning-page">
        <div className="page-heading">
          <h1>
            <BookOpen24Regular aria-hidden="true" /> Kurs nicht gefunden
          </h1>
        </div>
        <section className="empty-state">
          <h2>Der angeforderte Kurs existiert nicht.</h2>
          <p>Bitte überprüfe die URL oder wähle einen Kurs aus der Übersicht.</p>
          <Button onClick={() => navigate("/areas/elearning")} appearance="primary" icon={<ArrowLeft20Regular />}>
            Zur Kursübersicht
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack elearning-page">
      <div className="elearning-nav-header">
        <Link to="/areas/elearning" className="elearning-back-link">
          <ArrowLeft20Regular aria-hidden="true" />
          <span>Zurück zur Kursübersicht</span>
        </Link>
      </div>

      <header className="course-detail-header">
        <div className="course-detail-header__badges">
          <span className={`elearning-badge elearning-badge--${course.category.toLowerCase()}`}>
            {course.category}
          </span>
          {course.isDemo && (
            <Badge appearance="tint" color="informative">
              Beispielinhalte / Demo
            </Badge>
          )}
        </div>
        <h1 className="course-detail-header__title">{course.title}</h1>
        <p className="course-detail-header__description">{course.description}</p>
      </header>

      {course.demoNotice && (
        <div className="elearning-notice-box" role="note" aria-label="Hinweis zum Kurs">
          <Info20Regular aria-hidden="true" className="elearning-notice-box__icon" />
          <div className="elearning-notice-box__text">{course.demoNotice}</div>
        </div>
      )}

      <div className="course-detail-sections">
        {/* Lernmaterialien */}
        <section className="course-detail-card" aria-labelledby="materials-heading">
          <div className="course-detail-card__heading">
            <h2 id="materials-heading">
              <BookOpen24Regular aria-hidden="true" />
              Lernmaterialien
            </h2>
            <p>Zugehörige Begleitdokumente, Leitfäden und Bilder.</p>
          </div>

          {course.materials.length > 0 ? (
            <div className="course-materials-list">
              {course.materials.map((material) => (
                <div key={material.id} className="course-material-item">
                  {isImageMaterial(material.fileName) && (
                    <img
                      className="course-material-item__preview"
                      src={`${material.url}${material.url.includes("?") ? "&" : "?"}preview=1`}
                      alt={material.title}
                    />
                  )}
                  <div className="course-material-item__info">
                    <span className="course-material-item__title">{material.title}</span>
                    <span className="course-material-item__meta">
                      {isImageMaterial(material.fileName) ? "Bilddatei" : "PDF-Dokument"} • {material.fileName}
                      {material.fileSize ? ` • ${material.fileSize}` : ""}
                    </span>
                  </div>
                  <Button
                    as="a"
                    href={material.url}
                    download={material.fileName}
                    appearance="primary"
                    icon={<ArrowDownload20Regular aria-hidden="true" />}
                    className="course-material-item__download"
                  >
                    Herunterladen
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="course-materials-empty">
              <p className="course-materials-empty__text">Lernmaterialien folgen</p>
              <span className="course-materials-empty__hint">
                Für diesen Kurs sind derzeit noch keine Lernmaterialien hinterlegt.
              </span>
            </div>
          )}
        </section>

        {/* Übungsfragen */}
        <section className="course-detail-card course-detail-card--practice" aria-labelledby="practice-heading">
          <div className="course-detail-card__heading">
            <h2 id="practice-heading">
              <QuizNew24Regular aria-hidden="true" />
              Übungsfragen
            </h2>
            <p>
              Übe mit sofortiger Rückmeldung oder starte eine Probeprüfung. Im Prüfungsmodus werden die Lösungen und Erklärungen erst nach der Abgabe angezeigt.
            </p>
          </div>

          <div className="course-practice-info">
            <div className="course-practice-metrics">
              <div className="metric-box">
                <span className="metric-box__value">{course.questionCount}</span>
                <span className="metric-box__label">Fragen im Katalog</span>
              </div>
              <div className="metric-box">
                <span className="metric-box__value">{course.slug === "istqb-foundation" ? "60 / 75 Min" : "10 Min"}</span>
                <span className="metric-box__label">Probeprüfungszeit</span>
              </div>
              <div className="metric-box">
                <span className="metric-box__value">65 %</span>
                <span className="metric-box__label">Bestehensgrenze</span>
              </div>
            </div>

            <div className="course-practice-actions">
              <Link
                to={`/areas/elearning/${course.slug}/practice`}
                className="fui-Button fui-Button--primary elearning-start-btn"
              >
                <Play20Regular aria-hidden="true" />
                <span>Übung starten</span>
              </Link>
              <Link
                to={`/areas/elearning/${course.slug}/exam`}
                className="fui-Button fui-Button--primary elearning-start-btn elearning-start-btn--exam"
              >
                <Clock20Regular aria-hidden="true" />
                <span>Prüfungsmodus</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
