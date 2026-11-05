import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coursesData, type ExamAttempt } from "@portal/shared";
import { ElearningPage } from "./elearning-page.js";
import { CourseEditorDialog } from "./course-editor-dialog.js";
import { CourseCreatePage } from "./course-create-page.js";
import { CourseEditPage } from "./course-edit-page.js";
import { CourseDetailPage } from "./course-detail-page.js";
import { CoursePracticePage } from "./course-practice-page.js";
import { CourseExamPage } from "./course-exam-page.js";
import { ExamResultsPage } from "./exam-results-page.js";

const mocks = vi.hoisted(() => ({
  role: "employee" as "employee" | "admin",
  api: {
    courses: {
      list: vi.fn(),
      renameCategory: vi.fn(),
      deleteCategory: vi.fn(),
      get: vi.fn(),
      getAdmin: vi.fn(),
      getPractice: vi.fn(),
      getExam: vi.fn(),
      submitExam: vi.fn(),
      examResults: vi.fn(),
      abortedExamSessions: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      uploadMaterial: vi.fn(),
      deleteMaterial: vi.fn(),
    },
  },
}));

vi.mock("../../api/client.js", () => ({
  api: mocks.api,
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));
vi.mock("../../app/auth-context.js", () => ({
  useAuth: () => ({ user: { id: "test-user", role: mocks.role } }),
}));

beforeEach(() => {
  mocks.role = "employee";
  mocks.api.courses.list.mockResolvedValue([...coursesData]);
  mocks.api.courses.renameCategory.mockResolvedValue({ updatedCourses: 1 });
  mocks.api.courses.deleteCategory.mockResolvedValue({ updatedCourses: 1 });
  mocks.api.courses.get.mockImplementation((slug: string) =>
    Promise.resolve(coursesData.find((course) => course.slug === slug || course.id === slug)),
  );
  mocks.api.courses.getAdmin.mockImplementation((slug: string) =>
    Promise.resolve(coursesData.find((course) => course.slug === slug || course.id === slug)),
  );
  mocks.api.courses.getPractice.mockImplementation((slug: string) =>
    Promise.resolve(coursesData.find((course) => course.slug === slug || course.id === slug)),
  );
  mocks.api.courses.examResults.mockResolvedValue([]);
  mocks.api.courses.abortedExamSessions.mockResolvedValue([]);
  mocks.api.courses.create.mockImplementation(async (input) => ({ ...input, id: "new-course", slug: "new-course" }));
  mocks.api.courses.update.mockImplementation(async (id, input) => ({ ...input, id, slug: "fragenkatalog-essentials" }));
  mocks.api.courses.delete.mockResolvedValue({ success: true });
  mocks.api.courses.uploadMaterial.mockImplementation(async (file: File) => ({
    id: `uploaded-${file.name}`,
    title: file.name.replace(/\.[^.]+$/, ""),
    fileName: file.name,
    fileSize: "1 KB",
    url: `/api/courses/materials/uploaded-${file.name}/download`,
  }));
  mocks.api.courses.deleteMaterial.mockResolvedValue({ success: true });
});

function renderWithRouter(ui: React.ReactElement, initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <FluentProvider theme={webLightTheme}>
        {ui}
      </FluentProvider>
    </MemoryRouter>,
  );
}

function CurrentPath() {
  const { pathname } = useLocation();
  return <output data-testid="current-path">{pathname}</output>;
}

describe("ElearningPage - Kursübersicht", () => {
  it.each(["page", "dialog"] as const)("filters only question text or the exact number without changing saved questions (%s)", async (presentation) => {
    const user = userEvent.setup();
    const original = coursesData[0].questions[0];
    const questions = Array.from({ length: 12 }, (_, index) => ({
      ...original,
      id: `search-question-${index}`,
      question: index === 0 ? "Änderung der Software" : `Andere Fragestellung ${index + 1}`,
      options: original.options.map((option) => ({ ...option, text: `Software ${option.text}` })),
      explanation: "Software",
    }));
    const save = vi.fn().mockResolvedValue(coursesData[0]);
    renderWithRouter(<CourseEditorDialog presentation={presentation}
      course={{ ...coursesData[0], questions }} onSave={save} onClose={vi.fn()} />);
    const search = screen.getByRole("searchbox", { name: "Übungsfragen durchsuchen" });
    const cards = document.querySelectorAll<HTMLDetailsElement>(".course-editor-question-collapse");
    fireEvent.change(search, { target: { value: "software" } });
    expect(screen.getByText("1 von 12 Fragen")).toBeInTheDocument();
    expect(cards[0]).not.toHaveAttribute("hidden");
    expect(cards[1]).toHaveAttribute("hidden");
    fireEvent.change(search, { target: { value: "12" } });
    expect(cards[0]).toHaveAttribute("hidden");
    expect(cards[11]).not.toHaveAttribute("hidden");
    fireEvent.change(search, { target: { value: "1" } });
    expect(cards[0]).not.toHaveAttribute("hidden");
    expect(cards[11]).toHaveAttribute("hidden");
    fireEvent.change(search, { target: { value: "unbekannt" } });
    expect(screen.getByText("Keine passenden Übungsfragen gefunden.")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "12" } });
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].questions).toEqual(questions);
  });

  it("removes special characters from typed and pasted searches while preserving umlauts", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CourseEditorDialog presentation="page" course={coursesData[0]}
      onSave={vi.fn()} onClose={vi.fn()} />);
    const search = screen.getByRole("searchbox", { name: "Übungsfragen durchsuchen" });
    await user.type(search, "Äöü ß 12!?");
    expect(search).toHaveValue("Äöü ß 12");
    expect(screen.getByText("Sonderzeichen wurden entfernt.")).toBeInTheDocument();
    await user.clear(search);
    await user.paste("Änderung@#-_ 12");
    expect(search).toHaveValue("Änderung 12");
    expect(screen.getByText("Sonderzeichen wurden entfernt.")).toBeInTheDocument();
  });

  it("reveals invalid filtered questions and clears the filter when adding questions", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CourseEditorDialog presentation="page"
      course={{ ...coursesData[0], questions: coursesData[0].questions.slice(0, 2) }}
      onSave={vi.fn()} onClose={vi.fn()} />);
    const search = screen.getByRole("searchbox", { name: "Übungsfragen durchsuchen" });
    const cards = document.querySelectorAll<HTMLDetailsElement>(".course-editor-question-collapse");
    await user.type(search, "1");
    expect(cards[1]).toHaveAttribute("hidden");
    fireEvent.invalid(cards[1].querySelector("textarea")!);
    expect(search).toHaveValue("");
    expect(cards[1]).not.toHaveAttribute("hidden");
    expect(cards[1]).toHaveAttribute("open");
    await user.type(search, "1");
    await user.click(screen.getByRole("button", { name: "Frage hinzufügen" }));
    expect(search).toHaveValue("");
    expect(within(screen.getByRole("group", { name: "Frage 3" })).getByRole("textbox", { name: "Fragetext" })).toHaveFocus();
    expect(screen.getByText("3 von 3 Fragen")).toBeInTheDocument();
  });

  it("allows removing both exam settings when editing and restores empty inputs", async () => {
    const save = vi.fn().mockResolvedValue(coursesData[0]);
    const { rerender } = renderWithRouter(<CourseEditorDialog presentation="page"
      course={{ ...coursesData[0], passThreshold: 80, durationMinutes: 25 }}
      onSave={save} onClose={vi.fn()} />);
    const threshold = screen.getByRole("spinbutton", { name: "Bestehensgrenze (%)" });
    const duration = screen.getByRole("spinbutton", { name: "Prüfungsdauer (Minuten)" });
    expect(threshold).not.toBeRequired();
    expect(duration).not.toBeRequired();
    fireEvent.change(threshold, { target: { value: "" } });
    fireEvent.change(duration, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Kurs speichern" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      passThreshold: null, durationMinutes: null,
    })));
    rerender(<MemoryRouter><FluentProvider theme={webLightTheme}>
      <CourseEditorDialog key="empty-settings" presentation="page"
        course={{ ...coursesData[0], passThreshold: null, durationMinutes: null }}
        onSave={save} onClose={vi.fn()} />
    </FluentProvider></MemoryRouter>);
    expect(screen.getByRole("spinbutton", { name: "Bestehensgrenze (%)" })).toHaveValue(null);
    expect(screen.getByRole("spinbutton", { name: "Prüfungsdauer (Minuten)" })).toHaveValue(null);
  });

  it.each([false, true])("uploads an image-only question when editing=%s", async (editing) => {
    mocks.role = "admin";
    const user = userEvent.setup();
    mocks.api.courses.getAdmin.mockResolvedValue({ ...coursesData[0], questions: [], materials: [] });
    const save = editing ? mocks.api.courses.update : mocks.api.courses.create;
    renderWithRouter(
      <Routes>
        <Route path="/areas/elearning/new" element={<CourseCreatePage />} />
        <Route path="/areas/elearning/:courseId/edit" element={<CourseEditPage />} />
        <Route path="/areas/elearning/:courseId" element={<p>Gespeicherter Bildkurs</p>} />
      </Routes>,
      [editing ? `/areas/elearning/${coursesData[0].slug}/edit` : "/areas/elearning/new"],
    );
    await user.click(await screen.findByRole("button", { name: "Frage hinzufügen" }));
    if (!editing) {
      const title = screen.getByRole("textbox", { name: "Kurstitel" });
      await user.clear(title);
      await user.type(title, "Neuer Bildkurs");
      await user.type(screen.getByRole("textbox", { name: "Beschreibung" }), "Ein Kurs mit Aufgabenbild.");
    }
    fireEvent.change(screen.getByRole("spinbutton", { name: "Bestehensgrenze (%)" }), { target: { value: "80" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Prüfungsdauer (Minuten)" }), { target: { value: "25" } });
    const image = new File(["png data"], "aufgabe.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Aufgabenbild hochladen"), image);
    expect(await screen.findByRole("img", { name: "aufgabe.png" })).toHaveAttribute("src", "blob:question-image-preview");
    expect(screen.getByRole("textbox", { name: "Fragetext" })).not.toBeRequired();
    await user.clear(screen.getByRole("textbox", { name: "Bildbeschreibung" }));
    await user.type(screen.getByRole("textbox", { name: "Bildbeschreibung" }), "Diagramm zur Aufgabe");
    await user.type(screen.getByRole("textbox", { name: "Antwortmöglichkeit 1" }), "Ja");
    await user.type(screen.getByRole("textbox", { name: "Antwortmöglichkeit 2" }), "Nein");
    await user.click(screen.getByRole("radio", { name: "Antwort 1 ist richtig" }));
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(mocks.api.courses.uploadMaterial).toHaveBeenCalledWith(image);
    const input = save.mock.calls[0][editing ? 1 : 0];
    expect(input.questions[0]).toMatchObject({
      question: "",
      image: { url: "/api/courses/materials/uploaded-aufgabe.png/download?preview=1", alt: "Diagramm zur Aufgabe" },
    });
    expect(input).toMatchObject({ passThreshold: 80, durationMinutes: 25 });
    expect(input.questions[0]).not.toHaveProperty("imageFile");
    expect(await screen.findByText("Gespeicherter Bildkurs")).toBeInTheDocument();
  }, 15_000);

  it("replaces and removes an existing question image without uploading removed drafts", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CourseEditorDialog presentation="page" course={{
      ...coursesData[0], materials: [], questions: [{
        ...coursesData[0].questions[0],
        image: { url: "/questions/istqb-foundation/prozess-116.png", alt: "Vorhandenes Bild" },
      }],
    }} onSave={vi.fn()} onClose={vi.fn()} />);
    await user.click(document.querySelector(".course-editor-question-collapse > summary")!);
    expect(screen.getByRole("img", { name: "Vorhandenes Bild" })).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Aufgabenbild hochladen"),
      new File(["image"], "ersatz.jpg", { type: "image/jpeg" }));
    expect(await screen.findByRole("img", { name: "ersatz.jpg" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aufgabenbild entfernen" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Fragetext" })).toBeRequired();
    expect(mocks.api.courses.uploadMaterial).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("rejects unsupported, empty and oversized question image files", async () => {
    renderWithRouter(<CourseEditorDialog presentation="page"
      course={{ ...coursesData[0], questions: [coursesData[0].questions[0]] }}
      onSave={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Aufgabenbild hochladen");
    fireEvent.change(input, { target: { files: [new File(["pdf"], "aufgabe.pdf", { type: "application/pdf" })] } });
    expect(screen.getByText("Bitte wähle eine PNG-, JPEG-, GIF- oder WebP-Bilddatei aus.")).toBeInTheDocument();
    for (const size of [0, 25 * 1024 * 1024 + 1]) {
      const file = new File(["png"], "aufgabe.png", { type: "image/png" });
      Object.defineProperty(file, "size", { value: size });
      fireEvent.change(input, { target: { files: [file] } });
      expect(screen.getByText("Dateien müssen größer als 0 Byte und höchstens 25 MB groß sein.")).toBeInTheDocument();
    }
    expect(mocks.api.courses.uploadMaterial).not.toHaveBeenCalled();
  });

  it("cleans up uploaded question images after a save failure and permits retrying", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValueOnce(new Error("Save failed"))
      .mockResolvedValueOnce({ ...coursesData[0] });
    renderWithRouter(<CourseEditorDialog presentation="page"
      course={{ ...coursesData[0], materials: [], questions: [coursesData[0].questions[0]] }}
      onSave={save} onClose={vi.fn()} />);
    await user.upload(screen.getByLabelText("Aufgabenbild hochladen"),
      new File(["image"], "aufgabe.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));
    expect(await screen.findByText(/Der Kurs konnte nicht gespeichert werden/)).toBeInTheDocument();
    expect(mocks.api.courses.deleteMaterial).toHaveBeenCalledWith("uploaded-aufgabe.png");
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(mocks.api.courses.uploadMaterial).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])("only cleans up a stored question image when removed=%s", async (removed) => {
    mocks.role = "admin";
    const user = userEvent.setup();
    const id = "7ef487bd-b454-4346-ad10-699241334752";
    mocks.api.courses.getAdmin.mockResolvedValue({
      ...coursesData[0], materials: [], questions: [{
        ...coursesData[0].questions[0],
        image: { url: `/api/courses/materials/${id}/download?preview=1`, alt: "Gespeichertes Aufgabenbild" },
      }],
    });
    renderWithRouter(
      <Routes>
        <Route path="/areas/elearning/:courseId/edit" element={<CourseEditPage />} />
        <Route path="/areas/elearning/:courseId" element={<p>Gespeicherter Kurs</p>} />
      </Routes>,
      [`/areas/elearning/${coursesData[0].slug}/edit`],
    );
    await screen.findByRole("img", { name: "Gespeichertes Aufgabenbild" });
    if (removed) await user.click(screen.getByRole("button", { name: "Aufgabenbild entfernen" }));
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));
    expect(await screen.findByText("Gespeicherter Kurs")).toBeInTheDocument();
    if (removed) {
      expect(mocks.api.courses.deleteMaterial).toHaveBeenCalledWith(id);
    } else {
      expect(mocks.api.courses.deleteMaterial).not.toHaveBeenCalled();
    }
    expect(mocks.api.courses.uploadMaterial).not.toHaveBeenCalled();
  });

  it.each(["page", "dialog"] as const)("keeps question editing unchanged inside independent collapsible cards (%s)", async (presentation) => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(coursesData[0]);
    renderWithRouter(<CourseEditorDialog presentation={presentation}
      course={{ ...coursesData[0], questions: coursesData[0].questions.slice(0, 2) }}
      onSave={save} onClose={vi.fn()} />);
    const cards = document.querySelectorAll<HTMLDetailsElement>(".course-editor-question-collapse");
    expect(cards).toHaveLength(2);
    expect(cards[0]).not.toHaveAttribute("open");
    expect(cards[1]).not.toHaveAttribute("open");
    expect(cards[1].querySelector("summary")).toHaveTextContent(coursesData[0].questions[1].question);
    await user.click(cards[1].querySelector("summary")!);
    expect(cards[0]).not.toHaveAttribute("open");
    expect(cards[1]).toHaveAttribute("open");
    const second = within(cards[1]);
    const text = second.getByRole("textbox", { name: "Fragetext" });
    await user.clear(text);
    await user.type(text, "Überarbeitete Frage");
    await user.selectOptions(second.getByRole("combobox", { name: "Antworttyp" }), "multiple");
    const choices = second.getAllByRole("checkbox");
    await user.click(choices[0]);
    if (!choices.some((choice) => (choice as HTMLInputElement).checked)) await user.click(choices[1]);
    expect(cards[1].querySelector("summary")).toHaveTextContent("Überarbeitete Frage");
    expect(cards[1].querySelector("summary")).toHaveTextContent("Mehrfachauswahl");
    const selected = choices.map((choice) => (choice as HTMLInputElement).checked);
    await user.click(cards[1].querySelector("summary")!);
    expect(cards[1]).not.toHaveAttribute("open");
    await user.click(cards[1].querySelector("summary")!);
    expect(second.getByRole("textbox", { name: "Fragetext" })).toHaveValue("Überarbeitete Frage");
    expect(second.getAllByRole("checkbox").map((choice) => (choice as HTMLInputElement).checked)).toEqual(selected);
    await user.click(cards[1].querySelector("summary")!);
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0].questions[1]).toMatchObject({
      question: "Überarbeitete Frage", type: "multiple",
      correctOptionIds: coursesData[0].questions[1].options.filter((_option, index) => selected[index]).map((option) => option.id),
    });
  });

  it("opens a collapsed question when its required field is invalid and retains deletion", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CourseEditorDialog presentation="page"
      course={{ ...coursesData[0], questions: coursesData[0].questions.slice(0, 2) }}
      onSave={vi.fn()} onClose={vi.fn()} />);
    const cards = document.querySelectorAll<HTMLDetailsElement>(".course-editor-question-collapse");
    fireEvent.invalid(cards[1].querySelector("textarea")!);
    expect(cards[1]).toHaveAttribute("open");
    await user.click(within(cards[1]).getByRole("button", { name: "Frage 2 löschen" }));
    expect(document.querySelectorAll(".course-editor-question-collapse")).toHaveLength(1);
    await user.click(cards[0].querySelector("summary")!);
    expect(within(cards[0]).getByRole("textbox", { name: "Fragetext" })).toHaveValue(coursesData[0].questions[0].question);
  });

  it.each([false, true])("scrolls to and focuses each added question when editing=%s", async (editing) => {
    const user = userEvent.setup();
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    renderWithRouter(
      <CourseEditorDialog presentation="page"
        course={editing ? { ...coursesData[0], questions: [coursesData[0].questions[0]] } : undefined}
        onSave={vi.fn()} onClose={vi.fn()} />,
    );
    for (const number of editing ? [2, 3] : [1, 2]) {
      await user.click(screen.getByRole("button", { name: "Frage hinzufügen" }));
      const question = screen.getByRole("group", { name: `Frage ${number}` });
      expect(question.closest("details")).toHaveAttribute("open");
      expect(within(question).getByRole("textbox", { name: "Fragetext" })).toHaveFocus();
      expect(scroll).toHaveBeenLastCalledWith({ block: "start" });
      expect(scroll.mock.instances.at(-1)).toBe(question);
    }
    scroll.mockRestore();
  });

  it("starts editing without highlighting the course title and moves focus between fields", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CourseEditorDialog course={coursesData[0]} onSave={vi.fn()} onClose={vi.fn()} />);
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByRole("heading", { name: "Kurs bearbeiten" })).toHaveFocus();
    const title = dialog.getByRole("textbox", { name: "Kurstitel" });
    await user.click(title);
    expect(title).toHaveFocus();
    await user.click(dialog.getByRole("textbox", { name: "Beschreibung" }));
    expect(title).not.toHaveFocus();
  });

  it("supports selecting multiple correct answers and switching back to a single answer", async () => {
    const user = userEvent.setup();
    renderWithRouter(
      <CourseEditorDialog
        presentation="page"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Frage hinzufügen" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Antworttyp" }), "multiple");

    const firstAnswer = screen.getByRole("checkbox", { name: "Antwort 1 ist richtig" });
    const secondAnswer = screen.getByRole("checkbox", { name: "Antwort 2 ist richtig" });
    await user.click(firstAnswer);
    await user.click(secondAnswer);
    expect(firstAnswer).toBeChecked();
    expect(secondAnswer).toBeChecked();

    await user.selectOptions(screen.getByRole("combobox", { name: "Antworttyp" }), "single");
    const firstRadio = screen.getByRole("radio", { name: "Antwort 1 ist richtig" });
    const secondRadio = screen.getByRole("radio", { name: "Antwort 2 ist richtig" });
    expect(firstRadio).toBeChecked();
    expect(secondRadio).not.toBeChecked();

    await user.click(secondRadio);
    expect(firstRadio).not.toBeChecked();
    expect(secondRadio).toBeChecked();
  });

  it("renders heading and limits employee listings to the first two courses", async () => {
    renderWithRouter(<ElearningPage />);

    expect(screen.getByRole("heading", { level: 1, name: /eLearning/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Hier findest du Lernmaterialien und Übungsfragen für deine Weiterbildung/i),
    ).toBeInTheDocument();

    expect(await screen.findByRole("heading", { level: 2, name: /Fragenkatalog Essentials/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /ISTQB Foundation/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: /Projektausschreibung TA-Robot/i }),
    ).not.toBeInTheDocument();
  });

  it("lets admins manage all courses while employees cannot see management actions", async () => {
    const { unmount } = renderWithRouter(<ElearningPage />);
    await screen.findByRole("heading", { level: 2, name: /ISTQB Foundation/i });
    expect(screen.queryByRole("button", { name: /Kurs anlegen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fragenkatalog Essentials bearbeiten/i })).not.toBeInTheDocument();
    unmount();

    mocks.role = "admin";
    renderWithRouter(<ElearningPage />);
    expect(await screen.findByRole("heading", { level: 2, name: /Projektausschreibung TA-Robot/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kurs anlegen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fragenkatalog Essentials bearbeiten/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fragenkatalog Essentials löschen/i })).toBeInTheDocument();
  });

  it("opens a dedicated editing page while the full course data loads", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    let resolveCourse!: (course: typeof coursesData[number]) => void;
    mocks.api.courses.getAdmin.mockReturnValue(new Promise((resolve) => {
      resolveCourse = resolve;
    }));
    renderWithRouter(
      <>
        <CurrentPath />
        <Routes>
          <Route path="/areas/elearning" element={<ElearningPage />} />
          <Route path="/areas/elearning/:courseId/edit" element={<CourseEditPage />} />
        </Routes>
      </>,
      ["/areas/elearning"],
    );

    await user.click(await screen.findByRole("button", { name: /Fragenkatalog Essentials bearbeiten/i }));

    expect(screen.getByRole("heading", { name: "Kurs bearbeiten" })).toBeInTheDocument();
    expect(screen.getByText("Kursdaten werden geladen …")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent(`/areas/elearning/${coursesData[0].slug}/edit`);
    expect(mocks.api.courses.getAdmin).toHaveBeenCalledWith(coursesData[0].slug);

    resolveCourse(coursesData[0]);
    expect(await screen.findByRole("textbox", { name: "Kurstitel" })).toHaveValue(coursesData[0].title);
  });

  it("saves changes from the editing page and navigates to the saved course", async () => {
    mocks.role = "admin";
    mocks.api.courses.getAdmin.mockResolvedValue({ ...coursesData[0], questions: [], materials: [] });
    const user = userEvent.setup();
    renderWithRouter(
      <Routes>
        <Route path="/areas/elearning/:courseId/edit" element={<CourseEditPage />} />
        <Route path="/areas/elearning/:courseId" element={<p>Gespeicherter Kurs</p>} />
      </Routes>,
      [`/areas/elearning/${coursesData[0].slug}/edit`],
    );
    const title = await screen.findByRole("textbox", { name: "Kurstitel" });
    await user.clear(title);
    await user.type(title, "Aktualisierter Kurs");
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));
    expect(await screen.findByText("Gespeicherter Kurs")).toBeInTheDocument();
    expect(mocks.api.courses.update).toHaveBeenCalledWith(coursesData[0].id, expect.objectContaining({
      title: "Aktualisierter Kurs",
      category: coursesData[0].category,
    }));
    expect(mocks.api.courses.create).not.toHaveBeenCalled();
  });

  it("cancels editing without saving", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    renderWithRouter(
      <Routes>
        <Route path="/areas/elearning/:courseId/edit" element={<CourseEditPage />} />
        <Route path="/areas/elearning" element={<p>Kursübersicht</p>} />
      </Routes>,
      [`/areas/elearning/${coursesData[0].slug}/edit`],
    );
    await user.click(await screen.findByRole("button", { name: "Abbrechen" }));
    expect(await screen.findByText("Kursübersicht")).toBeInTheDocument();
    expect(mocks.api.courses.update).not.toHaveBeenCalled();
  });

  it.each([false, true])("cleans up removed materials and surfaces cleanup failures (%s)", async (cleanupError) => {
    mocks.role = "admin";
    const material = {
      id: "stored-material",
      title: "Testmaterial",
      fileName: "test.pdf",
      url: "/api/courses/materials/stored-material/download",
    };
    mocks.api.courses.getAdmin.mockResolvedValue({ ...coursesData[0], questions: [], materials: [material] });
    if (cleanupError) mocks.api.courses.deleteMaterial.mockRejectedValueOnce(new Error("Cleanup failed"));
    const user = userEvent.setup();
    renderWithRouter(
      <Routes>
        <Route path="/areas/elearning/:courseId/edit" element={<CourseEditPage />} />
        <Route path="/areas/elearning/:courseId" element={<p>Gespeicherter Kurs</p>} />
      </Routes>,
      [`/areas/elearning/${coursesData[0].slug}/edit`],
    );
    await user.click(await screen.findByRole("button", { name: "Testmaterial entfernen" }));
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));
    if (cleanupError) {
      expect(await screen.findByText(/Der Kurs wurde gespeichert, aber mindestens eine entfernte Materialdatei/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Zum Kurs" })).toHaveAttribute("href", "/areas/elearning/fragenkatalog-essentials");
      expect(screen.queryByRole("button", { name: "Kurs speichern" })).not.toBeInTheDocument();
    } else {
      expect(await screen.findByText("Gespeicherter Kurs")).toBeInTheDocument();
    }
    expect(mocks.api.courses.deleteMaterial).toHaveBeenCalledWith(material.id);
    expect(mocks.api.courses.update).toHaveBeenCalledWith(coursesData[0].id, expect.objectContaining({ materials: [] }));
  });

  it("redirects employees away from course editing without loading admin data", async () => {
    renderWithRouter(
      <Routes>
        <Route path="/areas/elearning/:courseId/edit" element={<CourseEditPage />} />
        <Route path="/areas/elearning" element={<p>Kursübersicht</p>} />
      </Routes>,
      [`/areas/elearning/${coursesData[0].slug}/edit`],
    );
    expect(await screen.findByText("Kursübersicht")).toBeInTheDocument();
    expect(mocks.api.courses.getAdmin).not.toHaveBeenCalled();
  });

  it("shows loading errors on the editing page and allows retrying", async () => {
    mocks.role = "admin";
    mocks.api.courses.getAdmin.mockRejectedValueOnce(new Error("Network unavailable"));
    const user = userEvent.setup();
    renderWithRouter(
      <Routes>
        <Route path="/areas/elearning/:courseId/edit" element={<CourseEditPage />} />
      </Routes>,
      [`/areas/elearning/${coursesData[0].slug}/edit`],
    );
    expect(await screen.findByText("Der Kurs konnte nicht geladen werden.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("textbox", { name: "Kurstitel" })).toHaveValue(coursesData[0].title);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets admins create courses with PDF and image uploads and authored practice questions", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    renderWithRouter(
      <>
        <CurrentPath />
        <Routes>
          <Route path="/areas/elearning" element={<ElearningPage />} />
          <Route path="/areas/elearning/new" element={<CourseCreatePage />} />
          <Route path="/areas/elearning/:courseId" element={<p>Kursdetails</p>} />
        </Routes>
      </>,
      ["/areas/elearning"],
    );
    await user.click(await screen.findByRole("button", { name: "Kurs anlegen" }));

    expect(await screen.findByRole("heading", { name: "Kurs anlegen" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/areas/elearning/new");

    await user.type(await screen.findByRole("textbox", { name: "Kurstitel" }), "Sicheres Testen");
    const categorySelect = screen.getByRole("combobox", { name: "Kategorie" });
    expect(categorySelect).toHaveValue("Sonstiges");
    await user.click(screen.getByRole("button", { name: "Neue Kategorie" }));
    const categoryDialog = within(await screen.findByRole("dialog", { name: "Neue Kategorie" }));
    await user.type(categoryDialog.getByRole("textbox", { name: "Kategoriename" }), "Datenschutz");
    await user.click(categoryDialog.getByRole("button", { name: "Übernehmen" }));
    expect(categorySelect).toHaveValue("Datenschutz");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Beschreibung" }), "Ein neuer Lernkurs.");

    const pdf = new File(["%PDF-1.7 example"], "testleitfaden.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Datei hinzufügen"), { target: { files: [pdf] } });
    const image = new File(["png data"], "kursbild.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Datei hinzufügen"), { target: { files: [image] } });
    await user.click(screen.getByRole("button", { name: "Frage hinzufügen" }));
    await user.type(screen.getByRole("textbox", { name: "Fragetext" }), "Welche Antwort ist richtig?");
    await user.type(screen.getByRole("textbox", { name: "Antwortmöglichkeit 1" }), "Antwort A");
    await user.type(screen.getByRole("textbox", { name: "Antwortmöglichkeit 2" }), "Antwort B");
    await user.selectOptions(screen.getByRole("combobox", { name: "Antworttyp" }), "multiple");
    await user.click(screen.getByRole("checkbox", { name: "Antwort 1 ist richtig" }));
    await user.click(screen.getByRole("checkbox", { name: "Antwort 2 ist richtig" }));
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));

    await waitFor(() => expect(mocks.api.courses.create).toHaveBeenCalledOnce());
    expect(mocks.api.courses.uploadMaterial).toHaveBeenNthCalledWith(1, pdf);
    expect(mocks.api.courses.uploadMaterial).toHaveBeenNthCalledWith(2, image);
    const payload = mocks.api.courses.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Sicheres Testen",
      category: "Datenschutz",
      passThreshold: null,
      durationMinutes: null,
      materials: [
        { title: "testleitfaden", id: "uploaded-testleitfaden.pdf" },
        { title: "kursbild", id: "uploaded-kursbild.png" },
      ],
      questions: [{
        question: "Welche Antwort ist richtig?",
        options: [{ text: "Antwort A" }, { text: "Antwort B" }],
        type: "multiple",
        correctOptionIds: [expect.any(String), expect.any(String)],
        explanation: "",
      }],
    });
    expect(await screen.findByText("Kursdetails")).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/areas/elearning/new-course");
  }, 10_000);

  it("redirects employees away from the course creation page", async () => {
    renderWithRouter(
      <>
        <CurrentPath />
        <Routes>
          <Route path="/areas/elearning" element={<p>Kursübersicht</p>} />
          <Route path="/areas/elearning/new" element={<CourseCreatePage />} />
        </Routes>
      </>,
      ["/areas/elearning/new"],
    );

    expect(await screen.findByText("Kursübersicht")).toBeInTheDocument();
    expect(screen.getByTestId("current-path")).toHaveTextContent("/areas/elearning");
  });

  it("filters courses by category", async () => {
    renderWithRouter(<ElearningPage />);
    await screen.findByRole("heading", { level: 2, name: /ISTQB Foundation/i });

    const istqbFilterBtn = screen.getByRole("button", { name: "ISTQB" });
    fireEvent.click(istqbFilterBtn);

    expect(screen.getByRole("heading", { level: 2, name: /ISTQB Foundation/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /Fragenkatalog Essentials/i })).not.toBeInTheDocument();

    const allFilterBtn = screen.getByRole("button", { name: "Alle" });
    fireEvent.click(allFilterBtn);

    expect(screen.getByRole("heading", { level: 2, name: /Fragenkatalog Essentials/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /ISTQB Foundation/i })).toBeInTheDocument();
  });

  it("adds custom course categories to the overview filters", async () => {
    mocks.role = "admin";
    const customCourse = {
      ...coursesData[0],
      id: "datenschutz",
      slug: "datenschutz",
      title: "Datenschutz",
      category: "Datenschutz",
    };
    mocks.api.courses.list.mockResolvedValue([...coursesData, customCourse]);
    const user = userEvent.setup();
    renderWithRouter(<ElearningPage />);

    await user.click(await screen.findByRole("button", { name: "Datenschutz" }));

    expect(screen.getByRole("heading", { level: 2, name: "Datenschutz" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Fragenkatalog Essentials" })).not.toBeInTheDocument();
  });

  it("lets admins rename and delete categories while moving assigned courses", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    renderWithRouter(<ElearningPage />);
    await screen.findByRole("heading", { name: /Fragenkatalog Essentials/i });
    await user.click(screen.getByRole("button", { name: "Kategorien verwalten" }));
    await user.click(screen.getByRole("button", { name: "Vorstellung umbenennen" }));
    const renameDialog = within(screen.getByRole("dialog"));
    const nameInput = renameDialog.getByRole("textbox", { name: /Neuer Name für/ });
    await user.clear(nameInput);
    await user.type(nameInput, "Onboarding");
    await user.click(renameDialog.getByRole("button", { name: "Umbenennen" }));

    await waitFor(() => expect(mocks.api.courses.renameCategory).toHaveBeenCalledWith("Vorstellung", "Onboarding"));
    const categoryDialog = within(screen.getByRole("dialog"));
    expect(await categoryDialog.findByText("Onboarding")).toBeInTheDocument();
    await user.click(categoryDialog.getByRole("button", { name: "Onboarding löschen" }));
    const deleteDialog = within(screen.getByRole("dialog"));
    expect(deleteDialog.getByRole("combobox", { name: "Ersatzkategorie" })).toHaveValue("ISTQB");
    await user.click(deleteDialog.getByRole("button", { name: "Kategorie löschen" }));
    await waitFor(() => expect(mocks.api.courses.deleteCategory).toHaveBeenCalledWith("Onboarding", "ISTQB"));
    expect(within(screen.getByRole("dialog")).queryByText("Onboarding")).not.toBeInTheDocument();
  });

  it("filters courses by search query and allows resetting", async () => {
    renderWithRouter(<ElearningPage />);

    const searchInput = await screen.findByRole("textbox", { name: "Kurse nach Titel oder Beschreibung durchsuchen" });
    fireEvent.change(searchInput, { target: { value: "Essentials" } });

    expect(screen.getByRole("heading", { level: 2, name: /Fragenkatalog Essentials/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: /ISTQB Foundation/i })).not.toBeInTheDocument();

    // No matches case
    fireEvent.change(searchInput, { target: { value: "Nicht-existierender-Kurs" } });
    expect(screen.getByText(/Keine Kurse gefunden/i)).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: /Filter zurücksetzen/i });
    fireEvent.click(resetBtn);

    expect(screen.getByRole("heading", { level: 2, name: /Fragenkatalog Essentials/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /ISTQB Foundation/i })).toBeInTheDocument();
  });

  it("prioritizes testing title matches from the first letter without hiding description matches", async () => {
    mocks.role = "admin";
    const testing = {
      ...coursesData[0],
      id: "testing",
      slug: "testing",
      title: "testing",
      category: "TEST",
      description: "dasdasdasd",
    };
    const foundation = {
      ...coursesData[1],
      description: "Grundlagen des Softwaretestens und testing nach ISTQB",
    };
    mocks.api.courses.list.mockResolvedValue([foundation, testing]);
    renderWithRouter(<ElearningPage />);
    const search = await screen.findByRole("textbox", { name: "Kurse nach Titel oder Beschreibung durchsuchen" });

    for (const query of ["t", "te", "tes", "test", "testi", "testing", " TE "]) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.getAllByRole("article").map((card) => card.getAttribute("aria-label")))
        .toEqual(["testing", foundation.title]);
    }

    fireEvent.change(search, { target: { value: "is" } });
    expect(screen.getAllByRole("article").map((card) => card.getAttribute("aria-label")))
      .toEqual([foundation.title]);
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByRole("article").map((card) => card.getAttribute("aria-label")))
      .toEqual([foundation.title, "testing"]);
  });

  it("shows the latest exam result above the course action", async () => {
    const course = coursesData.find((entry) => entry.slug === "istqb-foundation")!;
    const earlierAttempt: ExamAttempt = {
      id: "exam-earlier",
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      percentage: 58,
      passed: false,
      correctCount: 23,
      totalQuestions: 40,
      results: [],
      submittedAt: "2026-10-18T10:00:00.000Z",
    };
    const latestAttempt: ExamAttempt = {
      ...earlierAttempt,
      id: "exam-latest",
      percentage: 78,
      passed: true,
      correctCount: 31,
      submittedAt: "2026-10-19T10:00:00.000Z",
    };
    mocks.api.courses.examResults.mockResolvedValue([latestAttempt, earlierAttempt]);
    renderWithRouter(<ElearningPage />);

    const card = await screen.findByRole("article", { name: course.title });
    expect(await within(card).findByText("Letzte Prüfung · 19.10.26")).toBeInTheDocument();
    expect(within(card).getByText("Richtigkeit: 78 %")).toBeInTheDocument();
    expect(within(card).getByText("Bestehensgrenze: 65 %")).toBeInTheDocument();
    expect(within(card).getByText("Bestanden")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Kurs ansehen/i })).toHaveAttribute(
      "href", `/areas/elearning/${course.slug}`,
    );
    expect(card.querySelector(".elearning-card__last-exam")?.nextElementSibling)
      .toBe(within(card).getByRole("link", { name: /Kurs ansehen/i }).parentElement);
  });

  it("indicates demo contents and available learning materials", async () => {
    renderWithRouter(<ElearningPage />);
    await screen.findByText(/1 PDF-Lernmaterial/i);

    // Check available materials info
    expect(screen.getByText(/1 PDF-Lernmaterial/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Lernmaterialien folgen/i).length).toBeGreaterThan(0);
  });
});

describe("CourseDetailPage - Kursdetailansicht", () => {
  it("renders course details with downloadable PDF for courses with materials", async () => {
    render(
      <MemoryRouter initialEntries={["/areas/elearning/fragenkatalog-essentials"]}>
        <FluentProvider theme={webLightTheme}>
          <Routes>
            <Route path="/areas/elearning/:courseId" element={<CourseDetailPage />} />
          </Routes>
        </FluentProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: /Fragenkatalog Essentials/i })).toBeInTheDocument();

    // Material with download button exists
    const downloadBtn = screen.getByRole("link", { name: /Herunterladen/i });
    expect(downloadBtn).toBeInTheDocument();
    expect(downloadBtn).toHaveAttribute(
      "href",
      "/documents/TC-Fragenkatalog-Essentials-Leitfaden.pdf",
    );
    expect(downloadBtn).toHaveAttribute(
      "download",
      "TC-Fragenkatalog-Essentials-Leitfaden.pdf",
    );

    // Practice section
    expect(screen.getByRole("heading", { level: 2, name: /Übungsfragen/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Übungsfragen/i }).closest("section"))
      .toHaveClass("course-detail-card--practice");
    const practiceLink = screen.getByRole("link", { name: /Übung starten/i });
    expect(practiceLink).toHaveAttribute(
      "href",
      "/areas/elearning/fragenkatalog-essentials/practice",
    );
    expect(screen.getByRole("link", { name: /Prüfungsmodus/i })).toHaveAttribute(
      "href",
      "/areas/elearning/fragenkatalog-essentials/exam",
    );
  });

  it("previews uploaded course images and keeps them downloadable", async () => {
    const courseWithImage = {
      ...coursesData[0],
      materials: [{
        id: "course-image",
        title: "Kursübersicht",
        fileName: "kursuebersicht.webp",
        url: "/api/courses/materials/course-image/download",
      }],
    };
    mocks.api.courses.get.mockResolvedValueOnce(courseWithImage);
    render(
      <MemoryRouter initialEntries={["/areas/elearning/fragenkatalog-essentials"]}>
        <FluentProvider theme={webLightTheme}>
          <Routes>
            <Route path="/areas/elearning/:courseId" element={<CourseDetailPage />} />
          </Routes>
        </FluentProvider>
      </MemoryRouter>,
    );

    const preview = await screen.findByRole("img", { name: "Kursübersicht" });
    expect(preview).toHaveAttribute("src", "/api/courses/materials/course-image/download?preview=1");
    expect(screen.getByText("Bilddatei • kursuebersicht.webp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Herunterladen/i })).toHaveAttribute(
      "href",
      "/api/courses/materials/course-image/download",
    );
  });

  it("shows 'Lernmaterialien folgen' without download button when course has no PDF", async () => {
    render(
      <MemoryRouter initialEntries={["/areas/elearning/istqb-foundation"]}>
        <FluentProvider theme={webLightTheme}>
          <Routes>
            <Route path="/areas/elearning/:courseId" element={<CourseDetailPage />} />
          </Routes>
        </FluentProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: /ISTQB Foundation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Übung starten" })).toHaveAttribute(
      "href", "/areas/elearning/istqb-foundation/practice",
    );
    expect(screen.getByRole("link", { name: "Prüfungsmodus" })).toHaveAttribute(
      "href", "/areas/elearning/istqb-foundation/exam",
    );

    // Check fallback text
    expect(screen.getByText("Lernmaterialien folgen")).toBeInTheDocument();
    // No download button should exist
    expect(screen.queryByRole("link", { name: /Herunterladen/i })).not.toBeInTheDocument();
  });

  it("shows error empty state for invalid course slug", async () => {
    render(
      <MemoryRouter initialEntries={["/areas/elearning/unbekannter-kurs"]}>
        <FluentProvider theme={webLightTheme}>
          <Routes>
            <Route path="/areas/elearning/:courseId" element={<CourseDetailPage />} />
          </Routes>
        </FluentProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Kurs nicht gefunden/i)).toBeInTheDocument());
    expect(screen.getByText(/Der angeforderte Kurs existiert nicht/i)).toBeInTheDocument();
  });
});

describe("CoursePracticePage - Interaktiver Übungsablauf", () => {
  it.each(["testing-c3433111", "neuer-kurs"])("grades selected drafts on finish and leaves empty answers skipped for %s", async (slug) => {
    const questions = [0, 1, 2].map((index) => ({
      id: `draft-${index}`, question: `Entwurfsfrage ${index}`, type: "single" as const,
      options: [{ id: "a", text: "Antwort A" }, { id: "b", text: "Antwort B" }],
      correctOptionIds: ["a"], explanation: "Lösung",
    }));
    mocks.api.courses.getPractice.mockResolvedValue({ ...coursesData[0], slug, questions });
    renderWithRouter(<Routes>
      <Route path="/areas/elearning/:courseId/practice" element={<CoursePracticePage />} />
    </Routes>, [`/areas/elearning/${slug}/practice`]);
    await screen.findByText("Frage 1 von 3");
    fireEvent.click(screen.getByLabelText("Antwort A"));
    fireEvent.click(screen.getByRole("button", { name: "Nächste Frage" }));
    fireEvent.click(screen.getByLabelText("Antwort B"));
    fireEvent.click(screen.getByRole("button", { name: "Übung abgeben" }));
    fireEvent.click(screen.getByRole("button", { name: "Endgültig beenden" }));
    expect(await screen.findByRole("heading", { name: "Übung abgeschlossen!" })).toBeInTheDocument();
    expect(screen.getByText("33 %")).toBeInTheDocument();
    const review = document.querySelector<HTMLDetailsElement>(".exam-review")!;
    fireEvent.click(review.querySelector("summary")!);
    expect(within(review).getByText("1 Punkt (richtig)")).toBeVisible();
    expect(within(review).getByText("0 Punkte (falsch)")).toBeVisible();
    expect(within(review).getByText("0 Punkte (übersprungen/nicht geprüft)")).toBeVisible();
  });

  it.each(["fragenkatalog-essentials", "testing-c3433111", "neuer-kurs"])(
    "runs full practice flow with independently collapsed reviews for %s", async (slug) => {
    mocks.api.courses.getPractice.mockResolvedValue({
      ...coursesData[0], slug,
      questions: coursesData[0].questions.map((question, index) => ({
        ...question, image: { url: `/practice-${index}.png`, alt: `Übungsgrafik ${index + 1}` },
      })),
    });
    render(
      <MemoryRouter initialEntries={[`/areas/elearning/${slug}/practice`]}>
        <FluentProvider theme={webLightTheme}>
          <Routes>
            <Route
              path="/areas/elearning/:courseId/practice"
              element={<CoursePracticePage />}
            />
          </Routes>
        </FluentProvider>
      </MemoryRouter>,
    );

    // Question 1: Check progress indicator and type
    expect(await screen.findByText("Frage 1 von 4")).toBeInTheDocument();
    expect(screen.getByText("Wähle eine Antwort.")).toBeInTheDocument();
    expect(screen.queryByText(/Einfachauswahl/i)).not.toBeInTheDocument();
    const questionCard = screen.getByRole("article");
    expect(within(questionCard).getByRole("navigation", { name: "Fragen in dieser Sitzung" })).toBeInTheDocument();
    expect(within(questionCard).getByRole("progressbar", { name: "Fortschritt: Frage 1 von 4" })).toBeInTheDocument();
    expect(within(questionCard).getByRole("button", { name: /Antwort prüfen/i })).toBeInTheDocument();
    const questionNavigation = questionCard.querySelector(".practice-card__navigation");
    expect(questionNavigation).toContainElement(within(questionCard).getByRole("button", { name: "Vorherige Frage" }));
    expect(questionNavigation).toContainElement(within(questionCard).getByRole("button", { name: "Überspringen" }));
    expect(within(questionCard).getByRole("button", { name: "Übung abgeben" }).parentElement)
      .toHaveClass("practice-card__submit");

    // Check button initially disabled until selection
    const checkBtn = screen.getByRole("button", { name: /Antwort prüfen/i });
    expect(checkBtn).toBeDisabled();

    // Select correct option for question 1 (Partnerschaftliche Begleitung...)
    const correctOption = screen.getByLabelText(/Partnerschaftliche Begleitung/i);
    fireEvent.click(correctOption);
    expect(checkBtn).toBeEnabled();

    // Submit answer
    fireEvent.click(checkBtn);

    // Verify feedback text and explanation
    expect(screen.getByText(/Richtig gelöst!/i)).toBeInTheDocument();
    expect(screen.getByText(/Erklärung zur Lösung:/i)).toBeInTheDocument();
    expect(screen.getByText("Richtige Antwort")).toBeInTheDocument();

    // Advance to next question
    const nextBtn = screen.getByRole("button", { name: /Nächste Frage/i });
    fireEvent.click(nextBtn);

    // Question 2
    expect(screen.getByText("Frage 2 von 4")).toBeInTheDocument();
    expect(screen.getByText("Wähle mehrere Antworten.")).toBeInTheDocument();

    // Answer incorrectly on purpose:
    const wrongOption = screen.getByLabelText(/Pauschales Versprechen aller Anforderungen/i);
    fireEvent.click(wrongOption);
    fireEvent.click(screen.getByRole("button", { name: /Antwort prüfen/i }));

    expect(screen.getByText(/Leider nicht richtig./i)).toBeInTheDocument();
    expect(screen.getByText("Deine Auswahl (falsch)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Nächste Frage/i }));

    // Question 3
    expect(screen.getByText("Frage 3 von 4")).toBeInTheDocument();
    const q3Option = screen.getByLabelText(/Unklarheiten frühzeitig ansprechen/i);
    fireEvent.click(q3Option);
    fireEvent.click(screen.getByRole("button", { name: /Antwort prüfen/i }));
    fireEvent.click(screen.getByRole("button", { name: /Nächste Frage/i }));

    // Question 4 (last question)
    expect(screen.getByText("Frage 4 von 4")).toBeInTheDocument();

    // Select correct option
    const q4Option = screen.getByLabelText(/Schnelles, reproduzierbares Feedback/i);
    fireEvent.click(q4Option);

    fireEvent.click(screen.getByRole("button", { name: /Antwort prüfen/i }));
    expect(screen.getByText(/Richtig gelöst!/i)).toBeInTheDocument();

    // Last question action should say "Ergebnis ansehen"
    const finishBtn = screen.getByRole("button", { name: /Ergebnis ansehen/i });
    fireEvent.click(finishBtn);

    // Summary Screen
    expect(screen.getByRole("heading", { level: 1, name: "Übung abgeschlossen!" })).toBeInTheDocument();
    expect(screen.getByText("75 %")).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName.toLowerCase() === "p" &&
          (element?.textContent ?? "").includes("3 von 4 Fragen richtig beantwortet (75 %)")
        );
      }),
    ).toBeInTheDocument();

    // Check Question Breakdown list
    expect(screen.getByText("Alle Fragen im Rückblick")).toBeInTheDocument();
    const review = document.querySelector<HTMLDetailsElement>(".exam-review")!;
    expect(review).not.toHaveAttribute("open");
    expect(review.querySelector(".exam-history-review__question-review summary")).not.toBeVisible();
    fireEvent.click(review.querySelector<HTMLElement>("summary")!);
    expect(review).toHaveAttribute("open");
    expect(review.querySelectorAll(".exam-history-review__summary-status")).toHaveLength(4);
    expect(review.querySelector(".exam-history-review__question")).not.toHaveTextContent(/Richtig|Falsch \/ offen/);
    expect(screen.getAllByRole("img", { name: "Richtig beantwortet" })).toHaveLength(3);
    expect(screen.getAllByRole("img", { name: "Falsch beantwortet" })).toHaveLength(1);
    const entries = Array.from(review.querySelectorAll<HTMLDetailsElement>(".exam-history-review__question-review"));
    expect(entries).toHaveLength(4);
    for (const [index, entry] of entries.entries()) {
      expect(entry).not.toHaveAttribute("open");
      expect(within(entry).getByAltText(`Übungsgrafik ${index + 1}`)).not.toBeVisible();
      expect(within(entry).getByText(coursesData[0].questions[index].explanation)).not.toBeVisible();
    }
    fireEvent.click(entries[0].querySelector("summary")!);
    expect(within(entries[0]).getByAltText("Übungsgrafik 1")).toBeVisible();
    expect(within(entries[0]).getByText(coursesData[0].questions[0].explanation)).toBeVisible();
    expect(entries[1]).not.toHaveAttribute("open");
    fireEvent.click(entries[1].querySelector("summary")!);
    expect(entries[0]).toHaveAttribute("open");
    expect(entries[1]).toHaveAttribute("open");
    fireEvent.click(entries[0].querySelector("summary")!);
    expect(within(entries[0]).getByAltText("Übungsgrafik 1")).not.toBeVisible();
    const filter = within(review).getByRole("combobox", { name: "Antworten anzeigen" });
    fireEvent.change(filter, { target: { value: "incorrect" } });
    expect(review.querySelectorAll(".exam-history-review__question-review")).toHaveLength(1);
    fireEvent.change(filter, { target: { value: "open" } });
    expect(within(review).getByText("Keine Fragen in dieser Kategorie.")).toBeVisible();
    fireEvent.change(filter, { target: { value: "all" } });
    expect(review.querySelectorAll(".exam-history-review__question-review")).toHaveLength(4);

    // Restart test
    const restartBtn = screen.getByRole("button", { name: /Erneut üben/i });
    fireEvent.click(restartBtn);

    expect(screen.getByText("Frage 1 von 4")).toBeInTheDocument();
  });
});

describe("CourseExamPage - Prüfungsmodus", () => {
  it.each(["testing-c3433111", "neuer-kurs"])("keeps question reviews independently collapsed for %s", async (slug) => {
    const questions = ["Richtig", "Falsch", "Offen"].map((text, index) => ({
      id: `review-${index}`,
      question: `Aufgabe ${text}`,
      type: "single" as const,
      options: [{ id: "a", text: `Antwort A ${text}` }, { id: "b", text: `Antwort B ${text}` }],
      image: { url: `/review-${index}.png`, alt: `Grafik ${text}` },
    }));
    mocks.api.courses.getExam.mockResolvedValue({
      ...coursesData[0], slug, questions, passThreshold: null, durationMinutes: null,
    });
    mocks.api.courses.submitExam.mockResolvedValue({
      percentage: 33, passed: null, correctCount: 1, totalQuestions: 3,
      results: questions.map((question, index) => ({
        question, selectedOptionIds: index === 2 ? [] : [index === 0 ? "a" : "b"],
        correctOptionIds: ["a"], explanation: `Erklärung ${index}`, isCorrect: index === 0,
      })),
    });
    renderWithRouter(<Routes>
      <Route path="/areas/elearning/:courseId/exam" element={<CourseExamPage />} />
    </Routes>, [`/areas/elearning/${slug}/exam`]);
    await screen.findByText("Ohne Zeitlimit");
    fireEvent.click(screen.getByRole("button", { name: "Beenden" }));
    fireEvent.click(screen.getByRole("button", { name: "Jetzt abgeben" }));
    await screen.findByRole("heading", { name: "Prüfung abgeschlossen!" });
    const review = document.querySelector<HTMLDetailsElement>(".exam-review")!;
    fireEvent.click(review.querySelector("summary")!);
    const entries = Array.from(review.querySelectorAll<HTMLDetailsElement>(".exam-history-review__question-review"));
    expect(entries).toHaveLength(3);
    for (const [index, entry] of entries.entries()) {
      expect(entry).not.toHaveAttribute("open");
      expect(within(entry).getByText(`Erklärung ${index}`)).not.toBeVisible();
      expect(within(entry).getByAltText(questions[index].image.alt)).not.toBeVisible();
    }
    expect(entries[0].querySelector("summary")).toHaveTextContent("1 Punkt (richtig)");
    expect(entries[1].querySelector("summary")).toHaveTextContent("0 Punkte (falsch)");
    expect(entries[2].querySelector("summary")).toHaveTextContent("0 Punkte (übersprungen/nicht geprüft)");
    fireEvent.click(entries[0].querySelector("summary")!);
    expect(within(entries[0]).getByText("Erklärung 0")).toBeVisible();
    expect(within(entries[0]).getByAltText("Grafik Richtig")).toBeVisible();
    expect(within(entries[0]).getByRole("img", { name: "Richtige Antwort" })).toBeVisible();
    expect(entries[1]).not.toHaveAttribute("open");
    fireEvent.click(entries[1].querySelector("summary")!);
    expect(entries[0]).toHaveAttribute("open");
    expect(within(entries[1]).getByRole("img", { name: "Falsche Antwort" })).toBeVisible();
    fireEvent.click(entries[0].querySelector("summary")!);
    expect(within(entries[0]).getByText("Erklärung 0")).not.toBeVisible();
    const filter = within(review).getByRole("combobox", { name: "Antworten anzeigen" });
    for (const [value, text] of [["incorrect", "Aufgabe Falsch"], ["open", "Aufgabe Offen"], ["correct", "Aufgabe Richtig"]]) {
      fireEvent.change(filter, { target: { value } });
      expect(review.querySelectorAll(".exam-history-review__question-review")).toHaveLength(1);
      expect(review.querySelector(".exam-history-review__question-review > summary")).toHaveTextContent(text);
    }
  });

  it("runs without a timer or pass assessment when both settings are disabled", async () => {
    mocks.api.courses.getExam.mockResolvedValue({
      ...coursesData[0], passThreshold: null, durationMinutes: null,
      questions: [coursesData[0].questions[0]],
    });
    mocks.api.courses.submitExam.mockResolvedValue({
      percentage: 0, passed: null, correctCount: 0, totalQuestions: 1, results: [],
    });
    renderWithRouter(<Routes>
      <Route path="/areas/elearning/:courseId/exam" element={<CourseExamPage />} />
    </Routes>, [`/areas/elearning/${coursesData[0].slug}/exam`]);
    expect(await screen.findByText("Ohne Zeitlimit")).toBeInTheDocument();
    vi.useFakeTimers();
    try {
      act(() => vi.advanceTimersByTime(2 * 60 * 60 * 1000));
      expect(mocks.api.courses.submitExam).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(screen.getByRole("button", { name: "Beenden" }));
    fireEvent.click(screen.getByRole("button", { name: "Jetzt abgeben" }));
    expect(await screen.findByText("Ohne Bestehensbewertung")).toBeInTheDocument();
    expect(screen.queryByText("Nicht bestanden")).not.toBeInTheDocument();
    expect(screen.queryByText(/Bestehensgrenze:/)).not.toBeInTheDocument();
  });

  it.each([
    ["Zur Kursübersicht", "/areas/elearning"],
    ["Auswertung ansehen", "/areas/elearning/results"],
  ])("keeps solutions hidden until submission and navigates via the %s button", async (name, destination) => {
    const user = userEvent.setup();
    const sourceQuestion = coursesData[0].questions[0];
    const examQuestion = {
      id: sourceQuestion.id,
      question: sourceQuestion.question,
      type: sourceQuestion.type,
      options: sourceQuestion.options,
    };
    mocks.api.courses.getExam.mockResolvedValue({
      id: coursesData[0].id,
      slug: coursesData[0].slug,
      title: coursesData[0].title,
      category: coursesData[0].category,
      description: coursesData[0].description,
      passThreshold: 80,
      durationMinutes: 25,
      questions: [examQuestion],
    });
    mocks.api.courses.submitExam.mockResolvedValue({
      percentage: 100,
      passed: true,
      correctCount: 1,
      totalQuestions: 1,
      results: [{
        question: examQuestion,
        selectedOptionIds: [sourceQuestion.correctOptionIds[0]],
        correctOptionIds: sourceQuestion.correctOptionIds,
        explanation: sourceQuestion.explanation,
        isCorrect: true,
      }],
    });
    render(
      <MemoryRouter initialEntries={[`/areas/elearning/${coursesData[0].slug}/exam`]}>
        <FluentProvider theme={webLightTheme}>
          <Routes>
            <Route path="/areas/elearning/:courseId/exam" element={<CourseExamPage />} />
            <Route path={destination} element={<h1>Navigationsziel</h1>} />
          </Routes>
        </FluentProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Probeprüfung")).toBeInTheDocument();
    expect(await screen.findByText(/^25:0[0-5]$/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Fortschritt: Frage 1 von 1" })).toBeInTheDocument();
    expect(screen.queryByText(sourceQuestion.explanation)).not.toBeInTheDocument();
    expect(mocks.api.courses.get).not.toHaveBeenCalled();
    expect(mocks.api.courses.getExam).toHaveBeenCalledWith(coursesData[0].slug);

    await user.click(screen.getByRole("radio", { name: new RegExp(sourceQuestion.options[0].text.slice(0, 20)) }));
    await user.click(screen.getByRole("button", { name: "Antwort bestätigen" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/Lösungen und Erklärungen werden erst nach der Abgabe angezeigt/i);
    expect(screen.queryByText(sourceQuestion.explanation)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Jetzt abgeben" }));
    expect(await screen.findByRole("heading", { name: "Prüfung abgeschlossen!" })).toBeInTheDocument();
    expect(screen.getByText("Bestehensgrenze: 80%")).toBeInTheDocument();
    const review = document.querySelector<HTMLDetailsElement>(".exam-review")!;
    expect(review).not.toHaveAttribute("open");
    const explanation = within(review).getByText(sourceQuestion.explanation);
    expect(explanation).not.toBeVisible();
    fireEvent.click(review.querySelector<HTMLElement>("summary")!);
    expect(review).toHaveAttribute("open");
    const questionReview = review.querySelector<HTMLDetailsElement>(".exam-history-review__question-review")!;
    expect(questionReview).not.toHaveAttribute("open");
    expect(explanation).not.toBeVisible();
    fireEvent.click(questionReview.querySelector<HTMLElement>("summary")!);
    expect(questionReview).toHaveAttribute("open");
    expect(explanation).toBeVisible();
    fireEvent.change(within(review).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "correct" },
    });
    expect(review.querySelectorAll(".exam-history-review__question-review")).toHaveLength(1);
    fireEvent.change(within(review).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "open" },
    });
    expect(within(review).getByText("Keine Fragen in dieser Kategorie.")).toBeInTheDocument();
    fireEvent.change(within(review).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "all" },
    });
    expect(screen.getByText("Erklärung zur Lösung:")).toBeInTheDocument();
    expect(screen.getByText(sourceQuestion.explanation)).toBeInTheDocument();
    expect(mocks.api.courses.submitExam).toHaveBeenCalledWith(coursesData[0].slug, [{
      questionId: sourceQuestion.id,
      selectedOptionIds: [sourceQuestion.options[0].id],
    }]);
    await user.click(screen.getByRole("button", { name }));
    expect(await screen.findByRole("heading", { name: "Navigationsziel" })).toBeInTheDocument();
  });
});

describe("ExamResultsPage - Prüfungsauswertung", () => {
  it("displays ungraded results neutrally and excludes them from the passed total", async () => {
    mocks.api.courses.examResults.mockResolvedValue([{
      id: "ungraded", courseId: coursesData[0].id, courseSlug: coursesData[0].slug,
      courseTitle: coursesData[0].title, percentage: 25, passed: null,
      correctCount: 1, totalQuestions: 4, results: [], submittedAt: "2026-10-16T08:00:00.000Z",
    }]);
    renderWithRouter(<ExamResultsPage />, ["/areas/elearning/results"]);
    expect(await screen.findByText("Ohne Bestehensbewertung")).toBeInTheDocument();
    expect(screen.queryByText("Nicht bestanden")).not.toBeInTheDocument();
    expect(screen.getByText("Nur bewertete Prüfungen")).toBeInTheDocument();
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
  });

  it("filters the history by course before limiting results and resets show all on selection", async () => {
    const user = userEvent.setup();
    const attempts = Array.from({ length: 8 }, (_, index) => ({
      id: `attempt-${index}`,
      courseId: index < 6 ? "course-a" : "course-b",
      courseSlug: index < 6 ? "kurs-a" : "kurs-b",
      courseTitle: index < 6 ? "Kurs A" : "Kurs B",
      percentage: 50,
      passed: false,
      correctCount: 2,
      totalQuestions: 4,
      results: [],
      submittedAt: "2026-10-16T08:00:00.000Z",
    }));
    mocks.api.courses.examResults.mockResolvedValue(attempts);
    renderWithRouter(<ExamResultsPage />, ["/areas/elearning/results"]);
    const history = within(await screen.findByRole("region", { name: "Bisherige Ergebnisse" }));
    const filter = history.getByRole("combobox", { name: "Kurs auswählen" });
    expect(history.getAllByRole("listitem")).toHaveLength(5);
    await user.click(filter);
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(3);
    await user.click(screen.getByRole("option", { name: "Alle Kurse" }));
    fireEvent.click(history.getByRole("button", { name: "Alle anzeigen" }));
    expect(history.getAllByRole("listitem")).toHaveLength(8);

    await user.click(filter);
    await user.click(screen.getByRole("option", { name: "Kurs B" }));
    expect(history.getAllByRole("listitem")).toHaveLength(2);
    expect(history.queryByRole("link", { name: "Kurs A" })).not.toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Alle anzeigen" })).not.toBeInTheDocument();
    expect(screen.getByText("8", { selector: ".exam-summary-card strong" })).toBeInTheDocument();

    await user.click(filter);
    await user.click(screen.getByRole("option", { name: "Kurs A" }));
    expect(history.getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(history.getByRole("button", { name: "Alle anzeigen" }));
    expect(history.getAllByRole("listitem")).toHaveLength(6);
    await user.click(filter);
    await user.click(screen.getByRole("option", { name: "Alle Kurse" }));
    expect(history.getAllByRole("listitem")).toHaveLength(5);
  });

  it("shows a user's history, best result, average per course and saved answer review", async () => {
    const course = coursesData[0];
    const question = course.questions[0];
    mocks.api.courses.examResults.mockResolvedValue([
      {
        id: "attempt-latest",
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        percentage: 50,
        passed: false,
        correctCount: 2,
        totalQuestions: 4,
        results: [{
          question: {
            id: question.id,
            question: question.question,
            type: question.type,
            options: question.options,
          },
          selectedOptionIds: [],
          correctOptionIds: question.correctOptionIds,
          explanation: question.explanation,
          isCorrect: false,
        }],
        submittedAt: "2026-10-16T08:00:00.000Z",
      },
      {
        id: "attempt-previous",
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        percentage: 100,
        passed: true,
        correctCount: 4,
        totalQuestions: 4,
        results: [{
          question: {
            id: question.id,
            question: question.question,
            type: question.type,
            options: question.options,
          },
          selectedOptionIds: question.correctOptionIds,
          correctOptionIds: question.correctOptionIds,
          explanation: question.explanation,
          isCorrect: true,
        }],
        submittedAt: "2026-10-15T08:00:00.000Z",
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/areas/elearning/results"]}>
        <FluentProvider theme={webLightTheme}>
          <Routes>
            <Route path="/areas/elearning/results" element={<ExamResultsPage />} />
          </Routes>
        </FluentProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Prüfungsauswertung" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: ".exam-summary-card strong" })).toBeInTheDocument();
    expect(screen.getByText("75%", { selector: ".exam-summary-card strong" })).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("100%", { selector: ".exam-best-list strong" })).toBeInTheDocument();
    expect(screen.getByText("75% · 2 Versuche")).toBeInTheDocument();

    const review = screen.getAllByText(/Prüfung ansehen: Fragenkatalog Essentials/i)[0];
    const attempts = document.querySelectorAll<HTMLElement>(".exam-history-review");
    const scrollToStart = vi.fn();
    attempts.forEach((attempt) => { attempt.scrollIntoView = scrollToStart; });
    fireEvent.click(review);
    await waitFor(() => expect(scrollToStart).toHaveBeenCalledWith({ block: "start", behavior: "instant" }));
    scrollToStart.mockClear();
    fireEvent.change(within(attempts[0]).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "correct" },
    });
    expect(within(attempts[0]).getByText("Keine Fragen in dieser Kategorie.")).toBeInTheDocument();
    fireEvent.change(within(attempts[0]).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "open" },
    });
    expect(within(attempts[0]).getByText(/Frage 1:/)).toBeInTheDocument();
    fireEvent.change(within(attempts[0]).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "all" },
    });
    fireEvent.click(attempts[1].querySelector<HTMLElement>("summary")!);
    await waitFor(() => expect(scrollToStart).toHaveBeenCalledTimes(1));
    const questionReviews = document.querySelectorAll<HTMLDetailsElement>(".exam-history-review__question-review");
    expect(questionReviews).toHaveLength(2);
    expect([...questionReviews].every((questionReview) => !questionReview.open)).toBe(true);
    expect(within(questionReviews[0]).getByText(question.explanation)).not.toBeVisible();
    expect(within(attempts[0]).getByRole("img", { name: "Nicht beantwortet" }))
      .toHaveClass("exam-history-review__status-icon", "exam-history-review__open-icon");
    expect(within(questionReviews[0]).getByRole("img", { name: "Nicht beantwortet" }))
      .toHaveClass("exam-history-review__status-icon", "exam-history-review__open-icon");
    expect(within(questionReviews[1]).getByRole("img", { name: "Richtig beantwortet" }))
      .toHaveClass("exam-history-review__status-icon", "practice-review-option--correct");
    expect(within(questionReviews[0]).getByText("0 Punkte (übersprungen/nicht geprüft)"))
      .toHaveClass("exam-history-review__summary-status");
    expect(within(questionReviews[1]).getByText("1 Punkt (richtig)"))
      .toHaveClass("exam-history-review__summary-status", "practice-review-option--correct");
    fireEvent.click(questionReviews[0].querySelector<HTMLElement>("summary")!);
    fireEvent.click(questionReviews[1].querySelector<HTMLElement>("summary")!);
    expect(await screen.findAllByText(question.explanation)).toHaveLength(2);
    expect(within(questionReviews[0]).getByText(question.explanation)).toBeVisible();
    expect(scrollToStart).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Erklärung zur Lösung:")).toHaveLength(2);
    expect(document.querySelectorAll(".exam-history-review__list > li")).toHaveLength(2);
    expect(document.querySelectorAll(".exam-history-review__options")).toHaveLength(2);
    expect(questionReviews[0].querySelector(".exam-history-review__answer-card")).toBeInTheDocument();
    expect(questionReviews[0].querySelector(".exam-history-review__options"))
      .toHaveClass("exam-history-review__options--standalone");
    expect(questionReviews[0].querySelector(".exam-history-review__explanation"))
      .toHaveClass("exam-history-review__explanation--standalone");
    expect(mocks.api.courses.examResults).toHaveBeenCalledOnce();
  });

  it.each(["Zur Kursübersicht", "Kurse ansehen"])("shows a clear empty state and navigates via the %s button", async (name) => {
    renderWithRouter(<Routes>
      <Route path="/areas/elearning/results" element={<ExamResultsPage />} />
      <Route path="/areas/elearning" element={<h1>Kursübersicht</h1>} />
    </Routes>, ["/areas/elearning/results"]);
    expect(await screen.findByRole("heading", { name: "Noch keine Prüfungen abgelegt" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name }));
    expect(await screen.findByRole("heading", { name: "Kursübersicht" })).toBeInTheDocument();
  });
});
