import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coursesData } from "@portal/shared";
import { ElearningPage } from "./elearning-page.js";
import { CourseDetailPage } from "./course-detail-page.js";
import { CoursePracticePage } from "./course-practice-page.js";

const mocks = vi.hoisted(() => ({
  role: "employee" as "employee" | "admin",
  api: {
    courses: {
      list: vi.fn(),
      get: vi.fn(),
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
  mocks.api.courses.create.mockImplementation(async (input) => ({ ...input, id: "new-course", slug: "new-course" }));
  mocks.api.courses.update.mockImplementation(async (id, input) => ({ ...input, id, slug: "fragenkatalog-essentials" }));
  mocks.api.courses.delete.mockResolvedValue({ success: true });
  mocks.api.courses.uploadMaterial.mockResolvedValue({
    id: "uploaded-file",
    title: "Anleitung",
    fileName: "anleitung.pdf",
    fileSize: "1 KB",
    url: "/api/courses/materials/uploaded-file/download",
  });
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

  it("lets admins create courses with an uploaded PDF and authored practice questions", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    renderWithRouter(<ElearningPage />);
    await user.click(await screen.findByRole("button", { name: "Kurs anlegen" }));

    await user.type(screen.getByRole("textbox", { name: "Kurstitel" }), "Sicheres Testen");
    await user.type(screen.getByRole("textbox", { name: "Beschreibung" }), "Ein neuer Lernkurs.");

    const pdf = new File(["%PDF-1.7 example"], "testleitfaden.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("PDF hinzufügen"), { target: { files: [pdf] } });
    await user.click(screen.getByRole("button", { name: "Frage hinzufügen" }));
    await user.type(screen.getByRole("textbox", { name: "Fragetext" }), "Welche Antwort ist richtig?");
    await user.type(screen.getByRole("textbox", { name: "Antwortmöglichkeit 1" }), "Antwort A");
    await user.type(screen.getByRole("textbox", { name: "Antwortmöglichkeit 2" }), "Antwort B");
    await user.click(screen.getByRole("radio", { name: "Antwort 1 ist richtig" }));
    await user.type(screen.getByRole("textbox", { name: "Erklärung der Lösung" }), "Antwort A ist richtig.");
    await user.click(screen.getByRole("button", { name: "Kurs speichern" }));

    await waitFor(() => expect(mocks.api.courses.create).toHaveBeenCalledOnce());
    expect(mocks.api.courses.uploadMaterial).toHaveBeenCalledWith(pdf);
    const payload = mocks.api.courses.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: "Sicheres Testen",
      materials: [{ title: "testleitfaden", id: "uploaded-file" }],
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
    const practiceLink = screen.getByRole("link", { name: /Übung starten/i });
    expect(practiceLink).toHaveAttribute(
      "href",
      "/areas/elearning/fragenkatalog-essentials/practice",
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
    expect(screen.getByText(/Einfachauswahl/i)).toBeInTheDocument();

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
    expect(screen.getByText(/Mehrfachauswahl/i)).toBeInTheDocument();

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
    expect(screen.getByRole("heading", { level: 1, name: /Übung abgeschlossen/i })).toBeInTheDocument();
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
    expect(screen.getByText("Fragenübersicht aus diesem Durchlauf")).toBeInTheDocument();
    expect(screen.getAllByText("Richtig beantwortet")).toHaveLength(3);
    expect(screen.getAllByText("Falsch beantwortet")).toHaveLength(1);

    // Restart test
    const restartBtn = screen.getByRole("button", { name: /Erneut üben/i });
    fireEvent.click(restartBtn);

    expect(screen.getByText("Frage 1 von 4")).toBeInTheDocument();
  });
});
