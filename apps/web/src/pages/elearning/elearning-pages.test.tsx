import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coursesData, type ExamAttempt } from "@portal/shared";
import { ElearningPage } from "./elearning-page.js";
import { CourseEditorDialog } from "./course-editor-dialog.js";
import { CourseDetailPage } from "./course-detail-page.js";
import { CoursePracticePage } from "./course-practice-page.js";
import { CourseExamPage } from "./course-exam-page.js";
import { ExamResultsPage } from "./exam-results-page.js";

const mocks = vi.hoisted(() => ({
  role: "employee" as "employee" | "admin",
  api: {
    courses: {
      list: vi.fn(),
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

describe("ElearningPage - Kursübersicht", () => {
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

  it("opens the course editor immediately while the full course data loads", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    let resolveCourse!: (course: typeof coursesData[number]) => void;
    mocks.api.courses.getAdmin.mockReturnValue(new Promise((resolve) => {
      resolveCourse = resolve;
    }));
    renderWithRouter(<ElearningPage />);

    await user.click(await screen.findByRole("button", { name: /Fragenkatalog Essentials bearbeiten/i }));

    expect(screen.getByRole("heading", { name: "Kurs bearbeiten" })).toBeInTheDocument();
    expect(screen.getByText("Kursdaten werden geladen …")).toBeInTheDocument();
    expect(mocks.api.courses.getAdmin).toHaveBeenCalledWith(coursesData[0].slug);

    resolveCourse(coursesData[0]);
    expect(await screen.findByRole("textbox", { name: "Kurstitel" })).toHaveValue(coursesData[0].title);
  });

  it("lets admins create courses with PDF and image uploads and authored practice questions", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    renderWithRouter(<ElearningPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Kurs anlegen" }));

    await user.type(await screen.findByRole("textbox", { name: "Kurstitel" }), "Sicheres Testen");
    await user.type(screen.getByRole("textbox", { name: "Beschreibung" }), "Ein neuer Lernkurs.");

    const pdf = new File(["%PDF-1.7 example"], "testleitfaden.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Datei hinzufügen"), { target: { files: [pdf] } });
    const image = new File(["png data"], "kursbild.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Datei hinzufügen"), { target: { files: [image] } });
    await user.click(screen.getByRole("button", { name: "Frage hinzufügen" }));
    await user.type(screen.getByRole("textbox", { name: "Fragetext" }), "Welche Antwort ist richtig?");
    await user.type(screen.getByRole("textbox", { name: "Antwortmöglichkeit 1" }), "Antwort A");
    await user.type(screen.getByRole("textbox", { name: "Antwortmöglichkeit 2" }), "Antwort B");
    await user.click(screen.getByRole("radio", { name: "Antwort 1 ist richtig" }));
    await user.type(screen.getByRole("textbox", { name: "Erklärung der Lösung" }), "Antwort A ist richtig.");
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));

    await waitFor(() => expect(mocks.api.courses.create).toHaveBeenCalledOnce());
    expect(mocks.api.courses.uploadMaterial).toHaveBeenNthCalledWith(1, pdf);
    expect(mocks.api.courses.uploadMaterial).toHaveBeenNthCalledWith(2, image);
    const payload = mocks.api.courses.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Sicheres Testen",
      materials: [
        { title: "testleitfaden", id: "uploaded-testleitfaden.pdf" },
        { title: "kursbild", id: "uploaded-kursbild.png" },
      ],
      questions: [{
        question: "Welche Antwort ist richtig?",
        options: [{ text: "Antwort A" }, { text: "Antwort B" }],
        correctOptionIds: [expect.any(String)],
        explanation: "Antwort A ist richtig.",
      }],
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/Kurs „Sicheres Testen“ wurde gespeichert/i);
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

  it("filters courses by search query and allows resetting", async () => {
    renderWithRouter(<ElearningPage />);

    const searchInput = await screen.findByLabelText(/Kurse nach Titel durchsuchen/i);
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
  it("runs full practice flow from questions through evaluation to results", async () => {
    render(
      <MemoryRouter initialEntries={["/areas/elearning/fragenkatalog-essentials/practice"]}>
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
    expect(review.querySelector(".exam-history-review summary")).not.toBeVisible();
    fireEvent.click(review.querySelector<HTMLElement>("summary")!);
    expect(review).toHaveAttribute("open");
    expect(review.querySelectorAll(".exam-history-review__summary-status")).toHaveLength(4);
    expect(review.querySelector(".exam-history-review__question")).not.toHaveTextContent(/Richtig|Falsch \/ offen/);
    expect(screen.getAllByRole("img", { name: "Richtig beantwortet" })).toHaveLength(3);
    expect(screen.getAllByRole("img", { name: "Falsch beantwortet" })).toHaveLength(1);

    // Restart test
    const restartBtn = screen.getByRole("button", { name: /Erneut üben/i });
    fireEvent.click(restartBtn);

    expect(screen.getByText("Frage 1 von 4")).toBeInTheDocument();
  });
});

describe("CourseExamPage - Prüfungsmodus", () => {
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
    const review = document.querySelector<HTMLDetailsElement>(".exam-review")!;
    expect(review).not.toHaveAttribute("open");
    const explanation = within(review).getByText(sourceQuestion.explanation);
    expect(explanation).not.toBeVisible();
    fireEvent.click(review.querySelector<HTMLElement>("summary")!);
    expect(review).toHaveAttribute("open");
    expect(explanation).toBeVisible();
    fireEvent.change(within(review).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "correct" },
    });
    expect(review.querySelectorAll(".exam-review-item")).toHaveLength(1);
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
