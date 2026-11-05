import { useEffect, useId, useRef, useState, type FormEvent } from "react";
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
  Textarea,
} from "@fluentui/react-components";
import { Add20Regular, ArrowLeft20Regular, Delete20Regular, Search20Regular } from "@fluentui/react-icons";
import { Link } from "react-router-dom";
import {
  COURSE_EXAM_DURATION_MINUTES,
  CTFL_EXAM_DURATION_MINUTES,
  EXAM_PASS_THRESHOLD,
  type Course,
  type CourseInput,
  type CourseCategory,
  type LearningMaterial,
  type PracticeQuestion,
} from "@portal/shared";
import { ApiError, api } from "../../api/client.js";
import { QuestionContent } from "./question-content.js";

type DraftMaterial = LearningMaterial & { file?: File };
type DraftQuestion = PracticeQuestion & { imageFile?: File };

function QuestionImagePreview({ question }: { question: DraftQuestion }) {
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    if (!question.imageFile) return;
    const url = URL.createObjectURL(question.imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [question.imageFile]);
  const image = question.image;
  if (!image || (question.imageFile && !previewUrl)) return null;
  return <QuestionContent question={{ question: "", image: {
    ...image, url: question.imageFile ? previewUrl : image.url,
  } }} />;
}
type CourseEditorDialogProps = {
  course?: Course;
  presentation?: "dialog" | "page";
  categories?: readonly string[];
  onSave: (course: CourseInput) => Promise<Course>;
  onClose: (savedCourse?: Course) => void;
};

function newId() {
  return crypto.randomUUID();
}

function newQuestion(): PracticeQuestion {
  return {
    id: newId(),
    question: "",
    type: "single",
    options: [
      { id: newId(), text: "" },
      { id: newId(), text: "" },
    ],
    correctOptionIds: [],
    explanation: "",
  };
}

function messageFor(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Der Kurs konnte nicht gespeichert werden. Bitte versuche es erneut.";
}

const materialMimeTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function CourseEditorDialog({ course, presentation = "dialog", categories = [], onSave, onClose }: CourseEditorDialogProps) {
  const editorRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    editorRef.current?.focus();
  }, []);
  const [title, setTitle] = useState(course?.title ?? "");
  const [category, setCategory] = useState<CourseCategory>(course?.category ?? "Sonstiges");
  const [description, setDescription] = useState(course?.description ?? "");
  const [passThreshold, setPassThreshold] = useState(course
    ? String(course.passThreshold === null ? "" : course.passThreshold ?? EXAM_PASS_THRESHOLD) : "");
  const [durationMinutes, setDurationMinutes] = useState(course
    ? String(course.durationMinutes === null ? "" : course.durationMinutes ??
      (course.slug === "istqb-foundation" ? CTFL_EXAM_DURATION_MINUTES : COURSE_EXAM_DURATION_MINUTES)) : "");
  const [isDemo, setIsDemo] = useState(course?.isDemo ?? false);
  const [demoNotice, setDemoNotice] = useState(course?.demoNotice ?? "");
  const [materials, setMaterials] = useState<DraftMaterial[]>(course?.materials ?? []);
  const [questions, setQuestions] = useState<DraftQuestion[]>(course?.questions ?? []);
  const [questionSearch, setQuestionSearch] = useState("");
  const [searchNotice, setSearchNotice] = useState("");
  const searchHintId = useId();
  const query = questionSearch.toLocaleLowerCase("de-DE").trim();
  const matchesQuestion = (question: DraftQuestion, index: number) =>
    !query || (/^[0-9]+$/.test(query)
      ? index + 1 === Number(query)
      : question.question.toLocaleLowerCase("de-DE").includes(query));
  const matchingQuestionCount = questions.filter(matchesQuestion).length;
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>([]);
  const pendingQuestionId = useRef<string | null>(null);
  const addedQuestionRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (!pendingQuestionId.current || !addedQuestionRef.current) return;
    addedQuestionRef.current.scrollIntoView({ block: "start" });
    addedQuestionRef.current.querySelector("textarea")?.focus({ preventScroll: true });
    pendingQuestionId.current = null;
  }, [questions]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryError, setCategoryError] = useState("");

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newCategory = categoryDraft.trim();
    if (!newCategory || newCategory.length > 80) {
      setCategoryError("Bitte gib einen Kategorienamen mit maximal 80 Zeichen ein.");
      return;
    }
    setCategory(newCategory);
    setCategoryDialogOpen(false);
    setCategoryDraft("");
    setCategoryError("");
  }

  function addMaterial(file: File | undefined) {
    if (!file) return;
    const extension = file.name.match(/\.[^.]+$/)?.[0].toLowerCase() ?? "";
    if (!materialMimeTypes[extension] || file.type !== materialMimeTypes[extension]) {
      setError("Bitte wähle eine PDF-, PNG-, JPEG-, GIF- oder WebP-Datei aus.");
      return;
    }
    if (file.size === 0 || file.size > 25 * 1024 * 1024) {
      setError("Dateien müssen größer als 0 Byte und höchstens 25 MB groß sein.");
      return;
    }
    setError("");
    setMaterials((current) => [...current, {
      id: newId(),
      title: file.name.replace(/\.[^.]+$/, ""),
      fileName: file.name,
      fileSize: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      url: "",
      file,
    }]);
  }

  function updateQuestion(questionId: string, update: (question: DraftQuestion) => DraftQuestion) {
    setQuestions((current) => current.map((question) => question.id === questionId ? update(question) : question));
  }

  function addQuestionImage(questionId: string, file: File | undefined) {
    if (!file) return;
    const extension = file.name.match(/\.[^.]+$/)?.[0].toLowerCase() ?? "";
    if (!materialMimeTypes[extension]?.startsWith("image/") || file.type !== materialMimeTypes[extension]) {
      setError("Bitte wähle eine PNG-, JPEG-, GIF- oder WebP-Bilddatei aus.");
      return;
    }
    if (file.size === 0 || file.size > 25 * 1024 * 1024) {
      setError("Dateien müssen größer als 0 Byte und höchstens 25 MB groß sein.");
      return;
    }
    setError("");
    updateQuestion(questionId, (question) => ({
      ...question, imageFile: file, image: { url: "", alt: file.name.slice(0, 500) },
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsedPassThreshold = passThreshold.trim() ? Number(passThreshold) : null;
    const parsedDurationMinutes = durationMinutes.trim() ? Number(durationMinutes) : null;
    if (parsedPassThreshold !== null &&
        (!Number.isInteger(parsedPassThreshold) || parsedPassThreshold < 1 || parsedPassThreshold > 100)) {
      setError("Die Bestehensgrenze muss eine ganze Zahl zwischen 1 und 100 Prozent sein.");
      return;
    }
    if (parsedDurationMinutes !== null &&
        (!Number.isInteger(parsedDurationMinutes) || parsedDurationMinutes < 1 || parsedDurationMinutes > 600)) {
      setError("Die Prüfungsdauer muss eine ganze Zahl zwischen 1 und 600 Minuten sein.");
      return;
    }
    setBusy(true);
    const uploaded: LearningMaterial[] = [];
    try {
      const savedMaterials: LearningMaterial[] = [];
      for (const material of materials) {
        if (material.file) {
          const uploadedMaterial = await api.courses.uploadMaterial(material.file);
          uploaded.push(uploadedMaterial);
          savedMaterials.push({ ...uploadedMaterial, title: material.title.trim() });
        } else {
          savedMaterials.push({
            id: material.id,
            title: material.title.trim(),
            fileName: material.fileName,
            ...(material.fileSize ? { fileSize: material.fileSize } : {}),
            url: material.url,
          });
        }
      }

      const savedQuestions: PracticeQuestion[] = [];
      for (const { imageFile, ...question } of questions) {
        let image = question.image;
        if (imageFile) {
          const uploadedImage = await api.courses.uploadMaterial(imageFile);
          uploaded.push(uploadedImage);
          image = { url: `${uploadedImage.url}?preview=1`, alt: image?.alt.trim() || imageFile.name };
        }
        savedQuestions.push({
          ...question,
          ...(image ? { image: { ...image, alt: image.alt.trim() } } : {}),
          question: question.question.trim(),
          options: question.options.map((option) => ({ ...option, text: option.text.trim() })),
          explanation: question.explanation.trim(),
        });
      }

      const savedCourse = await onSave({
        title: title.trim(),
        category,
        description: description.trim(),
        passThreshold: parsedPassThreshold,
        durationMinutes: parsedDurationMinutes,
        isDemo,
        ...(demoNotice.trim() ? { demoNotice: demoNotice.trim() } : {}),
        materials: savedMaterials,
        questions: savedQuestions,
      });

      onClose(savedCourse);
    } catch (failure) {
      const cleanupErrors: unknown[] = [];
      for (const material of uploaded) {
        try {
          await api.courses.deleteMaterial(material.id);
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      if (cleanupErrors.length > 0) {
        console.error("Uploaded eLearning files could not be cleaned up.", cleanupErrors);
      }
      setError(cleanupErrors.length > 0
        ? `${messageFor(failure)} Einige hochgeladene Dateien konnten nicht bereinigt werden.`
        : messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  const editorContent = (
    <>
      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
      <div className="course-editor-overview">
      <div className="course-editor-fields">
        {presentation === "page" && <h3 className="course-editor-fields__heading">Kursdaten</h3>}
        <Field label="Kurstitel" required>
          <Input value={title} onChange={(_event, data) => setTitle(data.value)} maxLength={160} required />
        </Field>
        <Field label="Kategorie" required>
          <div className="course-editor-category">
            <Select value={category} onChange={(_event, data) => setCategory(data.value)}>
              {[...new Set(["Vorstellung", "ISTQB", "Sonstiges", ...categories, category])]
                .filter(Boolean)
                .map((option) => <option value={option} key={option}>{option}</option>)}
            </Select>
            <Button type="button" appearance="secondary" size="small" onClick={() => {
              setCategoryDraft("");
              setCategoryError("");
              setCategoryDialogOpen(true);
            }}>
              Neue Kategorie
            </Button>
          </div>
        </Field>
        <Field label="Beschreibung" required>
          <Textarea value={description} onChange={(_event, data) => setDescription(data.value)} maxLength={2000} required />
        </Field>
        {course?.slug === "istqb-foundation"
          ? <p>Die standardisierte ISTQB-Foundation-Prüfung verwendet ihren festen Prüfungsablauf mit 60/75 Minuten und 65 % Bestehensgrenze.</p>
          : <div className="course-editor-fields__exam-settings">
            <Field label="Bestehensgrenze (%)" hint="Optional. Leer lassen für keine Bestehensbewertung.">
              <Input type="number" value={passThreshold} min={1} max={100} step={1}
                onChange={(_event, data) => setPassThreshold(data.value)} />
            </Field>
            <Field label="Prüfungsdauer (Minuten)" hint="Optional. Leer lassen für kein Zeitlimit.">
              <Input type="number" value={durationMinutes} min={1} max={600} step={1}
                onChange={(_event, data) => setDurationMinutes(data.value)} />
            </Field>
          </div>}
        <label className="course-editor-checkbox">
          <input type="checkbox" checked={isDemo} onChange={(event) => setIsDemo(event.currentTarget.checked)} />
          Beispielkurs kennzeichnen
        </label>
        {isDemo && (
          <Field label="Hinweis zum Beispielkurs">
            <Textarea value={demoNotice} onChange={(_event, data) => setDemoNotice(data.value)} maxLength={5000} />
          </Field>
        )}
      </div>

      <section className="course-editor-section" aria-label="Lernmaterialien">
        <div className="course-editor-section__heading">
          <h3>Lernmaterialien <Badge appearance="tint">{materials.length}</Badge></h3>
          <label className="course-editor-file-label">
            <Add20Regular aria-hidden="true" /> Datei hinzufügen
            <input
              type="file"
              accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg,image/gif,.gif,image/webp,.webp"
              aria-label="Datei hinzufügen"
              onChange={(event) => {
                addMaterial(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {materials.length === 0 && <p>Noch keine Lernmaterialien.</p>}
        {materials.map((material) => (
          <div className="course-editor-material" key={material.id}>
            <Field label="Anzeigetitel" required>
              <Input
                value={material.title}
                onChange={(_event, data) => setMaterials((current) => current.map((item) =>
                  item.id === material.id ? { ...item, title: data.value } : item))}
                maxLength={200}
                required
              />
            </Field>
            <span>{material.fileName}{material.file ? " (wird hochgeladen)" : ""}</span>
            <Button
              type="button"
              appearance="subtle"
              icon={<Delete20Regular />}
              aria-label={`${material.title} entfernen`}
              onClick={() => setMaterials((current) => current.filter((item) => item.id !== material.id))}
            />
          </div>
        ))}
      </section>
      </div>

      <section className="course-editor-section" aria-label="Übungsfragen">
        <div className="course-editor-section__heading">
          <h3>Übungsfragen <Badge appearance="tint">{questions.length}</Badge></h3>
          <Button type="button" appearance="secondary" icon={<Add20Regular />} onClick={() => {
            setQuestionSearch("");
            setSearchNotice("");
            const question = newQuestion();
            pendingQuestionId.current = question.id;
            setExpandedQuestionIds((current) => [...current, question.id]);
            setQuestions((current) => [...current, question]);
          }}>
            Frage hinzufügen
          </Button>
        </div>
        <div className="course-editor-question-search">
          <Field label="Übungsfragen durchsuchen">
            <Input type="search" value={questionSearch}
              contentBefore={<Search20Regular aria-hidden="true" />}
              placeholder="Fragestellung oder Fragenummer suchen …"
              aria-describedby={searchHintId}
              onChange={(_event, data) => {
                const sanitized = data.value.replace(/[^\p{L}\p{N} ]/gu, "");
                setQuestionSearch(sanitized);
                setSearchNotice(sanitized !== data.value ? "Sonderzeichen wurden entfernt." : "");
              }} />
          </Field>
          <span role="status">{matchingQuestionCount} von {questions.length} Fragen</span>
          <p id={searchHintId}>Buchstaben, Zahlen und Leerzeichen. Eine Zahl sucht die genaue Fragenummer.</p>
          {searchNotice && <p role="status">{searchNotice}</p>}
        </div>
        {questions.length === 0 && <p>Noch keine Übungsfragen.</p>}
        {questions.length > 0 && matchingQuestionCount === 0 && <p>Keine passenden Übungsfragen gefunden.</p>}
        {questions.map((question, questionIndex) => (
          <details className="course-editor-question-collapse" key={question.id}
            hidden={!matchesQuestion(question, questionIndex)}
            open={expandedQuestionIds.includes(question.id)}
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setExpandedQuestionIds((current) => open
                ? current.includes(question.id) ? current : [...current, question.id]
                : current.includes(question.id) ? current.filter((id) => id !== question.id) : current);
            }}
            onInvalidCapture={(event) => {
              // Native validation must reveal the field before the browser tries to focus it.
              event.currentTarget.hidden = false;
              event.currentTarget.open = true;
              setQuestionSearch("");
              setSearchNotice("");
              setExpandedQuestionIds((current) =>
                current.includes(question.id) ? current : [...current, question.id]);
            }}>
            <summary>
              <span className="course-editor-question-collapse__title">
                Frage {questionIndex + 1} · {question.question.trim() || question.image?.alt || "Neue Frage"}
              </span>
              <span className="course-editor-question-collapse__meta">
                {question.type === "single" ? "Einfachauswahl" : "Mehrfachauswahl"} · {question.options.length} Antworten
              </span>
            </summary>
          <fieldset className="course-editor-question" aria-label={`Frage ${questionIndex + 1}`}
            ref={question.id === pendingQuestionId.current ? addedQuestionRef : undefined}>
            <Button
              type="button"
              appearance="subtle"
              icon={<Delete20Regular />}
              aria-label={`Frage ${questionIndex + 1} löschen`}
              onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}
            />
            <Field label="Fragetext" required={!question.image}>
              <Textarea value={question.question} onChange={(_event, data) => updateQuestion(question.id, (item) => ({ ...item, question: data.value }))} maxLength={2000} required={!question.image} />
            </Field>
            <Field label="Aufgabenbild" hint="PNG, JPEG, GIF oder WebP, maximal 25 MB. Fragetext oder Aufgabenbild erforderlich.">
              <input type="file" accept=".png,.jpg,.jpeg,.gif,.webp" aria-label="Aufgabenbild hochladen"
                disabled={busy} onChange={(event) => {
                  addQuestionImage(question.id, event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }} />
            </Field>
            {question.image && (
              <>
                <QuestionImagePreview question={question} />
                <Field label="Bildbeschreibung" required>
                  <Input value={question.image.alt} maxLength={500} required onChange={(_event, data) =>
                    updateQuestion(question.id, (item) => item.image
                      ? { ...item, image: { ...item.image, alt: data.value } } : item)} />
                </Field>
                <Button type="button" disabled={busy} onClick={() => updateQuestion(question.id, (item) => {
                  const { image: _image, imageFile: _file, ...rest } = item;
                  return rest;
                })}>Aufgabenbild entfernen</Button>
              </>
            )}
            <Field label="Antworttyp">
              <Select
                value={question.type}
                onChange={(_event, data) => updateQuestion(question.id, (item) => {
                  const type = data.value as PracticeQuestion["type"];
                  return {
                    ...item,
                    type,
                    correctOptionIds: type === "single" ? item.correctOptionIds.slice(0, 1) : item.correctOptionIds,
                  };
                })}
              >
                <option value="single">Einfachauswahl</option>
                <option value="multiple">Mehrfachauswahl</option>
              </Select>
            </Field>
            <div className="course-editor-options">
              <h4>Antwortmöglichkeiten (richtige Antwort(en) markieren)</h4>
              {question.options.map((option, optionIndex) => (
                <div className="course-editor-option" key={option.id}>
                  <input
                    type={question.type === "single" ? "radio" : "checkbox"}
                    name={`correct-${question.id}`}
                    aria-label={`Antwort ${optionIndex + 1} ist richtig`}
                    checked={question.correctOptionIds.includes(option.id)}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      updateQuestion(question.id, (item) => ({
                        ...item,
                        correctOptionIds: question.type === "single"
                          ? [option.id]
                          : checked
                            ? [...item.correctOptionIds, option.id]
                            : item.correctOptionIds.filter((id) => id !== option.id),
                      }));
                    }}
                  />
                  <Input
                    aria-label={`Antwortmöglichkeit ${optionIndex + 1}`}
                    value={option.text}
                    onChange={(_event, data) => updateQuestion(question.id, (item) => ({
                      ...item,
                      options: item.options.map((entry) => entry.id === option.id ? { ...entry, text: data.value } : entry),
                    }))}
                    maxLength={1000}
                    required
                  />
                  <Button
                    type="button"
                    appearance="subtle"
                    icon={<Delete20Regular />}
                    aria-label={`Antwortmöglichkeit ${optionIndex + 1} löschen`}
                    disabled={question.options.length <= 2}
                    onClick={() => updateQuestion(question.id, (item) => ({
                      ...item,
                      options: item.options.filter((entry) => entry.id !== option.id),
                      correctOptionIds: item.correctOptionIds.filter((id) => id !== option.id),
                    }))}
                  />
                </div>
              ))}
              <Button
                type="button"
                appearance="subtle"
                icon={<Add20Regular />}
                disabled={question.options.length >= 10}
                onClick={() => updateQuestion(question.id, (item) => ({
                  ...item,
                  options: [...item.options, { id: newId(), text: "" }],
                }))}
              >
                Antwortmöglichkeit hinzufügen
              </Button>
            </div>
            <Field label="Erklärung der Lösung (optional)">
              <Textarea value={question.explanation} onChange={(_event, data) => updateQuestion(question.id, (item) => ({ ...item, explanation: data.value }))} maxLength={5000} />
            </Field>
          </fieldset>
          </details>
        ))}
      </section>
    </>
  );
  const editorActions = (
    <>
      <Button type="button" appearance="secondary" disabled={busy} onClick={() => onClose()}>Abbrechen</Button>
      <Button type="submit" appearance="primary" disabled={busy}>
        {busy ? "Wird gespeichert …" : "Kurs speichern"}
      </Button>
    </>
  );
  const categoryDialog = (
    <Dialog modalType="non-modal" open={categoryDialogOpen} onOpenChange={(_event, data) => {
      if (!data.open) {
        setCategoryDialogOpen(false);
        setCategoryError("");
      }
    }}>
      <DialogSurface>
        <form onSubmit={addCategory}>
          <DialogBody>
            <DialogTitle>Neue Kategorie</DialogTitle>
            <DialogContent className="course-category-dialog-content">
              <Field label="Kategoriename" required>
                <Input
                  autoFocus
                  value={categoryDraft}
                  onChange={(_event, data) => setCategoryDraft(data.value)}
                  maxLength={80}
                  required
                />
              </Field>
              {categoryError && <MessageBar intent="error"><MessageBarBody>{categoryError}</MessageBarBody></MessageBar>}
            </DialogContent>
            <DialogActions>
              <Button type="button" appearance="secondary" onClick={() => setCategoryDialogOpen(false)}>Abbrechen</Button>
              <Button type="submit" appearance="primary">Übernehmen</Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );

  if (presentation === "page") {
    return (
      <div className="page-stack elearning-page course-editor-page">
        <div className="elearning-nav-header">
          <Link to="/areas/elearning" className="elearning-back-link">
            <ArrowLeft20Regular aria-hidden="true" />
            <span>Zurück zur Kursübersicht</span>
          </Link>
        </div>
        <header className="page-heading course-editor-page__heading">
          <h1 ref={editorRef} tabIndex={-1}>{course ? "Kurs bearbeiten" : "Kurs anlegen"}</h1>
          <p>Lege Kurstitel, Lernmaterialien und Übungsfragen in Ruhe auf einer eigenen Seite an.</p>
        </header>
        <form className="course-editor-page__surface" onSubmit={submit}>
          <div className="course-editor-form">{editorContent}</div>
          <div className="course-editor-page__actions">{editorActions}</div>
        </form>
        {categoryDialog}
      </div>
    );
  }

  return (
    <>
      <Dialog open onOpenChange={(_event, data) => { if (!data.open && !busy) onClose(); }}>
        <DialogSurface className="course-editor-dialog">
          <form onSubmit={submit}>
            <DialogBody>
              <DialogTitle ref={editorRef} tabIndex={-1}>{course ? "Kurs bearbeiten" : "Kurs anlegen"}</DialogTitle>
              <DialogContent className="course-editor-form">{editorContent}</DialogContent>
              <DialogActions>{editorActions}</DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
      {categoryDialog}
    </>
  );
}
