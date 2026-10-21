import { useState, type FormEvent } from "react";
import {
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
import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import type { Course, CourseInput, CourseCategory, LearningMaterial, PracticeQuestion } from "@portal/shared";
import { ApiError, api } from "../../api/client.js";
import { QuestionContent } from "./question-content.js";

type DraftMaterial = LearningMaterial & { file?: File };
type CourseEditorDialogProps = {
  course?: Course;
  onSave: (course: CourseInput) => Promise<Course>;
  onClose: () => void;
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

export function CourseEditorDialog({ course, onSave, onClose }: CourseEditorDialogProps) {
  const [title, setTitle] = useState(course?.title ?? "");
  const [category, setCategory] = useState<CourseCategory>(course?.category ?? "Sonstiges");
  const [description, setDescription] = useState(course?.description ?? "");
  const [isDemo, setIsDemo] = useState(course?.isDemo ?? false);
  const [demoNotice, setDemoNotice] = useState(course?.demoNotice ?? "");
  const [materials, setMaterials] = useState<DraftMaterial[]>(course?.materials ?? []);
  const [questions, setQuestions] = useState<PracticeQuestion[]>(course?.questions ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  function updateQuestion(questionId: string, update: (question: PracticeQuestion) => PracticeQuestion) {
    setQuestions((current) => current.map((question) => question.id === questionId ? update(question) : question));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
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

      await onSave({
        title: title.trim(),
        category,
        description: description.trim(),
        isDemo,
        ...(demoNotice.trim() ? { demoNotice: demoNotice.trim() } : {}),
        materials: savedMaterials,
        questions: questions.map((question) => ({
          ...question,
          question: question.question.trim(),
          options: question.options.map((option) => ({ ...option, text: option.text.trim() })),
          explanation: question.explanation.trim(),
        })),
      });

      onClose();
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

  return (
    <Dialog open onOpenChange={(_event, data) => { if (!data.open && !busy) onClose(); }}>
      <DialogSurface className="course-editor-dialog">
        <form onSubmit={submit}>
          <DialogBody>
            <DialogTitle>{course ? "Kurs bearbeiten" : "Kurs anlegen"}</DialogTitle>
            <DialogContent className="course-editor-form">
              {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
              <div className="course-editor-fields">
                <Field label="Kurstitel" required>
                  <Input value={title} onChange={(_event, data) => setTitle(data.value)} maxLength={160} required />
                </Field>
                <Field label="Kategorie" required>
                  <Select value={category} onChange={(_event, data) => setCategory(data.value as CourseCategory)}>
                    <option value="Vorstellung">Vorstellung</option>
                    <option value="ISTQB">ISTQB</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </Select>
                </Field>
                <Field label="Beschreibung" required>
                  <Textarea value={description} onChange={(_event, data) => setDescription(data.value)} maxLength={2000} required />
                </Field>
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
                  <h3>Lernmaterialien</h3>
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

              <section className="course-editor-section" aria-label="Übungsfragen">
                <div className="course-editor-section__heading">
                  <h3>Übungsfragen</h3>
                  <Button type="button" appearance="secondary" icon={<Add20Regular />} onClick={() => setQuestions((current) => [...current, newQuestion()])}>
                    Frage hinzufügen
                  </Button>
                </div>
                {questions.length === 0 && <p>Noch keine Übungsfragen.</p>}
                {questions.map((question, questionIndex) => (
                  <fieldset className="course-editor-question" key={question.id}>
                    <legend>Frage {questionIndex + 1}</legend>
                    <Button
                      type="button"
                      appearance="subtle"
                      icon={<Delete20Regular />}
                      aria-label={`Frage ${questionIndex + 1} löschen`}
                      onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}
                    />
                    <Field label="Fragetext" required>
                      <Textarea value={question.question} onChange={(_event, data) => updateQuestion(question.id, (item) => ({ ...item, question: data.value }))} maxLength={2000} required />
                      {question.image && <QuestionContent question={{ question: "", image: question.image }} />}
                    </Field>
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
                            onChange={(event) => updateQuestion(question.id, (item) => ({
                              ...item,
                              correctOptionIds: question.type === "single"
                                ? [option.id]
                                : event.currentTarget.checked
                                  ? [...item.correctOptionIds, option.id]
                                  : item.correctOptionIds.filter((id) => id !== option.id),
                            }))}
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
                    <Field label="Erklärung der Lösung" required>
                      <Textarea value={question.explanation} onChange={(_event, data) => updateQuestion(question.id, (item) => ({ ...item, explanation: data.value }))} maxLength={5000} required />
                    </Field>
                  </fieldset>
                ))}
              </section>
            </DialogContent>
            <DialogActions>
              <Button type="button" appearance="secondary" disabled={busy} onClick={onClose}>Abbrechen</Button>
              <Button type="submit" appearance="primary" disabled={busy}>
                {busy ? "Wird gespeichert …" : "Kurs speichern"}
              </Button>
            </DialogActions>
          </DialogBody>
        </form>
      </DialogSurface>
    </Dialog>
  );
}
