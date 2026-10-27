import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coursesData, type Course, type PracticeProgress } from "@portal/shared";
import { CoursePracticePage } from "./course-practice-page.js";

const mocks = vi.hoisted(() => ({
  getPractice: vi.fn(), getPracticeProgress: vi.fn(), checkPracticeAnswer: vi.fn(),
}));
vi.mock("../../api/client.js", () => ({
  api: { courses: mocks },
  ApiError: class ApiError extends Error {},
}));
const course: Course = {
  ...coursesData[1],
  questions: [1, 2, 3].map((number) => ({
    id: `q${number}`, question: `Übungsfrage ${number}`, type: number === 3 ? "multiple" : "single",
    options: [{ id: "a", text: "Antwort A" }, { id: "b", text: "Antwort B" }, { id: "c", text: "Antwort C" }],
    correctOptionIds: number === 3 ? ["a", "c"] : ["a"], explanation: `Lösung ${number}`,
    metadata: { chapter: number, chapterTitle: `Thema ${number}`, learningObjective: `FL-${number}.1.1`,
      kLevel: (["K1", "K2", "K3"] as const)[number - 1] },
  })),
};
let progress: PracticeProgress[];
beforeEach(() => {
  vi.resetAllMocks();
  progress = [];
  mocks.getPractice.mockResolvedValue(course);
  mocks.getPracticeProgress.mockImplementation(async () => [...progress]);
  mocks.checkPracticeAnswer.mockImplementation(async (_slug, questionId: string, ids: string[]) => {
    const question = course.questions.find((item) => item.id === questionId)!;
    const saved = { questionId, lastCorrect: ids.length === question.correctOptionIds.length &&
      ids.every((id) => question.correctOptionIds.includes(id)) };
    progress = [...progress.filter((item) => item.questionId !== questionId), saved];
    return saved;
  });
});

function renderPractice(withCourseNavigation = false) {
  return render(<MemoryRouter initialEntries={["/areas/elearning/istqb-foundation/practice"]}>
    <FluentProvider theme={webLightTheme}>
      {withCourseNavigation && <Link to="/areas/elearning/fragenkatalog-essentials/practice">Anderer Kurs</Link>}
      <Routes>
      <Route path="/areas/elearning/:courseId/practice" element={<CoursePracticePage />} />
    </Routes></FluentProvider>
  </MemoryRouter>);
}

describe("ISTQB practice setup", () => {
  it("uses question-pool proportions by default when all chapters are selected", async () => {
    const sizes = [2, 4, 6, 8, 10, 10];
    mocks.getPractice.mockResolvedValue({
      ...course,
      questions: sizes.flatMap((size, index) => Array.from({ length: size }, (_, questionIndex) => ({
        ...course.questions[0], id: `proportional-${index}-${questionIndex}`,
        question: `Kapitel ${index + 1} Frage ${questionIndex}`,
        metadata: { ...course.questions[0].metadata!, chapter: index + 1, chapterTitle: `Thema ${index + 1}` },
      }))),
    });
    renderPractice();
    await screen.findByRole("heading", { name: "Übungsfragen" });
    const weighting = screen.getByRole("checkbox", { name: "Kapitel nach Prüfungsrichtlinie gewichten" });
    expect(weighting).not.toBeChecked();
    expect(weighting).toBeEnabled();
    expect(within(screen.getByRole("group", { name: "Kapitel" })).getAllByRole("checkbox").at(-1))
      .toBe(weighting);
    fireEvent.click(screen.getByRole("checkbox", { name: "6. Thema 6" }));
    expect(weighting).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "6. Thema 6" }));
    fireEvent.click(screen.getByRole("radio", { name: "Alle verfügbaren Fragen" }));
    expect(weighting).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "20 Fragen" }));
    expect(weighting).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));
    const actual = [0, 0, 0, 0, 0, 0];
    const navigation = screen.getByRole("navigation", { name: "Fragen in dieser Sitzung" });
    for (const button of within(navigation).getAllByRole("button")) {
      fireEvent.click(button);
      const title = screen.getByRole("heading", { name: /^Kapitel \d Frage \d+$/ }).textContent!;
      actual[Number(title.split(" ")[1]) - 1] += 1;
    }
    expect(actual).toEqual([1, 2, 3, 4, 5, 5]);
  });

  it.each([
    ["20 Fragen", [4, 3, 2, 6, 4, 1]],
    ["40 Fragen (gleiche Anzahl wie in der CTFL-Prüfung)", [8, 6, 4, 11, 9, 2]],
  ] as const)("applies CTFL chapter quotas through the setup: %s", async (label, counts) => {
    mocks.getPractice.mockResolvedValue({
      ...course,
      questions: [1, 2, 3, 4, 5, 6].flatMap((chapter) =>
        Array.from({ length: 15 }, (_, index) => ({
          ...course.questions[0], id: `chapter-${chapter}-${index}`, question: `Kapitel ${chapter} Frage ${index}`,
          metadata: { ...course.questions[0].metadata!, chapter, chapterTitle: `Thema ${chapter}` },
        }))),
    });
    renderPractice();
    await screen.findByRole("heading", { name: "Übungsfragen" });
    expect(screen.queryByText(/CTFL-Kapitelverteilung/)).not.toBeInTheDocument();
    const weighting = screen.getByRole("checkbox", { name: "Kapitel nach Prüfungsrichtlinie gewichten" });
    expect(weighting).not.toBeChecked();
    fireEvent.click(weighting);
    fireEvent.click(screen.getByRole("radio", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));
    const navigation = screen.getByRole("navigation", { name: "Fragen in dieser Sitzung" });
    const buttons = within(navigation).getAllByRole("button");
    const actual = [0, 0, 0, 0, 0, 0];
    for (const button of buttons) {
      fireEvent.click(button);
      const title = screen.getByRole("heading", { name: /^Kapitel \d Frage \d+$/ }).textContent!;
      actual[Number(title.split(" ")[1]) - 1] += 1;
    }
    expect(actual).toEqual(counts);
    expect(mocks.checkPracticeAnswer).not.toHaveBeenCalled();
  });

  it.each([
    ["20 Fragen", 20], ["40 Fragen (gleiche Anzahl wie in der CTFL-Prüfung)", 40], ["Alle verfügbaren Fragen", 45],
  ] as const)("starts the selected session size: %s", async (label, count) => {
    mocks.getPractice.mockResolvedValue({
      ...course,
      questions: Array.from({ length: 45 }, (_, index) => ({
        ...course.questions[index % course.questions.length], id: `session-${index}`,
      })),
    });
    renderPractice();
    await screen.findByRole("heading", { name: "Übungsfragen" });
    expect(screen.getByRole("radio", { name: "20 Fragen" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "30 Fragen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "60 Fragen" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));
    expect(screen.getByRole("heading", { name: `Frage 1 von ${count}` })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Fragen in dieser Sitzung" }))
      .getAllByRole("button")).toHaveLength(count);
    expect(mocks.checkPracticeAnswer).not.toHaveBeenCalled();
  });

  it("does not apply a delayed answer response to another course after navigation", async () => {
    let finishAnswer: (progress: PracticeProgress) => void = () => { throw new Error("Promise not initialized"); };
    const pending = new Promise<PracticeProgress>((resolve) => { finishAnswer = resolve; });
    mocks.checkPracticeAnswer.mockReturnValueOnce(pending);
    mocks.getPractice.mockImplementation(async (slug: string) => slug === course.slug ? course : coursesData[0]);
    renderPractice(true);
    await screen.findByRole("heading", { name: "Übungsfragen" });
    fireEvent.click(screen.getByLabelText("K1 – Erinnern"));
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));
    fireEvent.click(screen.getByLabelText("Antwort A"));
    fireEvent.click(screen.getByRole("button", { name: "Antwort prüfen" }));
    expect(screen.getByRole("button", { name: "Antwort wird gespeichert …" })).toBeDisabled();
    fireEvent.click(screen.getByRole("link", { name: "Anderer Kurs" }));
    expect(await screen.findByText("Frage 1 von 4")).toBeInTheDocument();
    await act(async () => { finishAnswer({ questionId: "q1", lastCorrect: true }); await pending; });
    expect(screen.queryByText("Richtig gelöst!")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Antwort prüfen" })).toBeDisabled();
  });

  it("opens setup first, combines chapter and K-level filters and starts only the matching questions", async () => {
    renderPractice();
    expect(await screen.findByRole("heading", { name: "Übungsfragen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ISTQB Foundation Level - Übungsmodus" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zurück zum Kurs" }))
      .toHaveAttribute("href", "/areas/elearning/istqb-foundation");
    expect(screen.queryByText("Übungsfrage 1")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Alle Kapitel")).toBeChecked();
    expect(screen.getByLabelText("20 Fragen")).toBeChecked();
    expect(screen.getByLabelText("40 Fragen (gleiche Anzahl wie in der CTFL-Prüfung)")).toBeInTheDocument();
    expect(screen.getByLabelText("Alle verfügbaren Fragen")).toBeInTheDocument();
    expect(screen.getByLabelText("K1 – Erinnern")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Alle Kapitel"));
    expect(screen.getByRole("button", { name: "Übung starten" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("3. Thema 3"));
    fireEvent.click(screen.getByLabelText("K3 – Anwenden"));
    expect(screen.getByRole("status")).toHaveTextContent("1 Frage passt zur Auswahl");
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));
    expect(screen.getByRole("heading", { name: "ISTQB Foundation Level - Übungsfragen" })).toBeInTheDocument();
    expect(screen.getByText("Frage 1 von 1")).toBeInTheDocument();
    expect(screen.getByText("Wähle mehrere Antworten.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Übungsfrage 3" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Übungsfragen" })).not.toBeInTheDocument();
    expect(screen.getByText(/FL-3.1.1 · K3/)).toBeInTheDocument();
    expect(screen.queryByText("Lösung 3")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Antwort A"));
    fireEvent.click(screen.getByLabelText("Antwort C"));
    fireEvent.click(screen.getByRole("button", { name: "Antwort prüfen" }));
    expect(await screen.findByText("Richtig gelöst!")).toBeInTheDocument();
    expect(screen.getByText("Lösung 3")).toBeInTheDocument();
    expect(screen.getByLabelText(/Antwort A/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ergebnis ansehen" }));
    expect(screen.getByText("100 %")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erneut üben" }));
    expect(screen.getByRole("heading", { name: "Übungsfragen" })).toBeInTheDocument();
  });

  it("navigates through the question grid, keeps draft answers, and marks questions", async () => {
    renderPractice();
    await screen.findByRole("heading", { name: "Übungsfragen" });
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));
    expect(screen.queryByText(/Einfachauswahl/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Frage 2: offen" }));
    expect(screen.getByRole("button", { name: "Überspringen" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Antwort A"));
    expect(screen.getByRole("button", { name: "Nächste Frage" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Frage 2: unvollständig" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Frage 1: offen" }));
    fireEvent.click(screen.getByRole("button", { name: "Frage 2: unvollständig" }));
    expect(screen.getByLabelText("Antwort A")).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Frage markieren" }));
    expect(screen.getByRole("checkbox", { name: "Frage markieren" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Antwort prüfen" }));
    expect(await screen.findByRole("button", { name: /Frage 2: beantwortet und geprüft, markiert/ }))
      .toBeInTheDocument();
  });

  it("allows submitting the practice early and identifies unanswered questions", async () => {
    renderPractice();
    await screen.findByRole("heading", { name: "Übungsfragen" });
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));

    fireEvent.click(screen.getByRole("button", { name: "Übung abgeben" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("Übung beenden?");
    expect(screen.getByRole("dialog")).toHaveTextContent("3 unbeantwortete Fragen (davon 0 unvollständig ausgewählt).");
    expect(screen.getByRole("dialog")).toHaveTextContent("3 nicht geprüfte Fragen zählen als übersprungen.");
    expect(screen.queryByRole("heading", { name: "Übung abgeschlossen!" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Weiter bearbeiten" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Frage 1 von 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Übung abgeben" }));
    fireEvent.click(screen.getByRole("button", { name: "Endgültig beenden" }));
    expect(screen.getByRole("heading", { name: "Übung abgeschlossen!" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
    const chapterRow = within(screen.getByRole("table")).getAllByRole("row")[1];
    expect(within(chapterRow).getAllByRole("cell").slice(0, 4).map((cell) => cell.textContent))
      .toEqual(["0", "0", "1", "1"]);
    expect(within(chapterRow).getAllByRole("cell")[4]).toHaveTextContent("0/1 Pkt.");
    expect(screen.getByText("0 %", { selector: ".practice-score-ring__percent" })).toBeInTheDocument();
    const reviewSection = document.querySelector<HTMLDetailsElement>(".exam-review")!;
    expect(reviewSection).not.toHaveAttribute("open");
    expect(reviewSection.querySelectorAll(".exam-history-review")).toHaveLength(3);
    expect(screen.queryByText("Frage 1: Frage 1")).not.toBeInTheDocument();
    fireEvent.click(reviewSection.querySelector<HTMLElement>("summary")!);
    expect(reviewSection).toHaveAttribute("open");
    expect(reviewSection.querySelectorAll(".exam-history-review__summary-status")).toHaveLength(3);
    fireEvent.change(screen.getByRole("combobox", { name: "Antworten anzeigen" }), { target: { value: "correct" } });
    expect(reviewSection.querySelectorAll(".exam-history-review")).toHaveLength(0);
    expect(within(reviewSection).getByText("Keine Fragen in dieser Kategorie.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Antworten anzeigen" }), { target: { value: "open" } });
    expect(reviewSection.querySelectorAll(".exam-history-review")).toHaveLength(3);
    const review = reviewSection.querySelector<HTMLElement>(".exam-history-review")!;
    expect(review).not.toHaveAttribute("open");
    expect(review.querySelector("summary")).toHaveTextContent(/^Frage 1: /);
    expect(review.querySelector("summary")).not.toHaveTextContent(/Richtig|Falsch|Nicht beantwortet/);
    expect(within(review).getByRole("img", { name: "Nicht beantwortet" }))
      .toHaveClass("exam-history-review__status-icon", "exam-history-review__open-icon");
    fireEvent.click(review.querySelector<HTMLElement>("summary")!);
    expect(review).toHaveAttribute("open");
    expect(review.querySelector(".exam-history-review__list > li > div > strong")).toBeNull();
    expect(within(review).getByText(/^Lösung \d$/)).toBeVisible();
    expect(within(review).getByText("Erklärung zur Lösung:")).toBeVisible();
    expect(review.querySelector(".exam-history-review__list > li")).toBeInTheDocument();
    expect(review.querySelector(".exam-history-review__options"))
      .toHaveClass("exam-history-review__options--indented");
    expect(review.querySelector(".exam-history-review__explanation"))
      .toHaveClass("exam-history-review__explanation--indented");
    expect(within(review).getByText("0 Punkte (übersprungen/nicht geprüft)"))
      .toHaveClass("exam-history-review__summary-status");
  });

  it("marks review answers with circled status icons while keeping answer text neutral", async () => {
    mocks.getPractice.mockResolvedValue({ ...course, questions: [course.questions[0]] });
    renderPractice();
    await screen.findByRole("heading", { name: "Übungsfragen" });
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));
    fireEvent.click(screen.getByLabelText("Antwort B"));
    fireEvent.click(screen.getByRole("button", { name: "Antwort prüfen" }));
    await screen.findByText("Leider nicht richtig.");
    fireEvent.click(screen.getByRole("button", { name: "Ergebnis ansehen" }));
    const reviewSection = document.querySelector<HTMLDetailsElement>(".exam-review")!;
    expect(reviewSection).not.toHaveAttribute("open");
    fireEvent.click(reviewSection.querySelector<HTMLElement>("summary")!);
    const review = reviewSection.querySelector<HTMLElement>(".exam-history-review")!;
    expect(review).not.toHaveAttribute("open");
    expect(within(review).getByRole("img", { name: "Falsch beantwortet" }))
      .toHaveClass("exam-history-review__status-icon", "practice-review-option--wrong");
    expect(within(review).getByText("0 Punkte (falsch)"))
      .toHaveClass("exam-history-review__summary-status", "practice-review-option--wrong");
    expect(within(review).getByText("Frage 1: Übungsfrage 1", { selector: ".exam-history-review__question span" }))
      .toBeInTheDocument();
    fireEvent.click(review.querySelector<HTMLElement>("summary")!);
    const wrongAnswer = within(review).getByText(/Antwort B/).closest<HTMLElement>("li")!;
    const correctAnswer = within(review).getByText(/Antwort A/).closest<HTMLElement>("li")!;
    expect(within(wrongAnswer).getByRole("img", { name: "Deine falsche Auswahl" }))
      .toHaveClass("practice-review-option--wrong");
    expect(within(correctAnswer).getByRole("img", { name: "Richtige Antwort" }))
      .toHaveClass("practice-review-option--correct");
    expect(wrongAnswer).toHaveClass("practice-review-option");
    expect(correctAnswer).toHaveClass("practice-review-option");
    expect(wrongAnswer).toHaveTextContent("◉ Antwort B");
    expect(correctAnswer).toHaveTextContent("○ Antwort A");
    expect(review.parentElement).toBe(reviewSection);
    expect(review).toHaveClass("exam-history-review");
    expect(within(review).queryByText(/Deine Auswahl|Richtige Antwort/)).not.toBeInTheDocument();
    expect(within(within(review).getByText(/Antwort C/).closest<HTMLElement>("li")!)
      .queryByText(/Deine Auswahl|Richtige Antwort/)).not.toBeInTheDocument();
  });

  it("counts incomplete multiple answers and confirms submission on the last question", async () => {
    mocks.getPractice.mockResolvedValue({ ...course, questions: [course.questions[2]] });
    renderPractice();
    await screen.findByRole("heading", { name: "Übungsfragen" });
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));
    fireEvent.click(screen.getByLabelText("Antwort A"));
    fireEvent.click(screen.getByRole("button", { name: "Übung abgeben" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("1 unbeantwortete Fragen (davon 1 unvollständig ausgewählt).");
    fireEvent.click(screen.getByRole("button", { name: "Weiter bearbeiten" }));
    expect(screen.getByLabelText("Antwort A")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Antwort C"));
    fireEvent.click(screen.getByRole("button", { name: "Übung abgeben" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("0 unbeantwortete Fragen (davon 0 unvollständig ausgewählt).");
    expect(screen.getByRole("dialog")).toHaveTextContent("1 nicht geprüfte Fragen zählen als übersprungen.");
    fireEvent.click(screen.getByRole("button", { name: "Endgültig beenden" }));
    expect(screen.getByText("0 %")).toBeInTheDocument();
  });

  it("reloads saved errors, retries a failed save explicitly and removes corrected errors", async () => {
    progress = [{ questionId: "q1", lastCorrect: false }, { questionId: "q2", lastCorrect: true }];
    renderPractice();
    await screen.findByRole("heading", { name: "Übungsfragen" });
    fireEvent.click(screen.getByLabelText("Fehler wiederholen"));
    fireEvent.click(screen.getByRole("button", { name: "Übung starten" }));
    expect(screen.getByText("Frage 1 von 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Übungsfrage 1" })).toBeInTheDocument();
    mocks.checkPracticeAnswer.mockRejectedValueOnce(new Error("Connection failed"));
    fireEvent.click(screen.getByLabelText("Antwort A"));
    fireEvent.click(screen.getByRole("button", { name: "Antwort prüfen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("konnte nicht gespeichert werden");
    expect(screen.queryByText("Lösung 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Antwort prüfen" }));
    expect(await screen.findByText("Richtig gelöst!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ergebnis ansehen" }));
    fireEvent.click(screen.getByRole("button", { name: "Erneut üben" }));
    fireEvent.click(screen.getByLabelText("Fehler wiederholen"));
    expect(screen.getByRole("button", { name: "Übung starten" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Keine zuletzt falsch beantworteten Fragen");
    expect(progress.find((item) => item.questionId === "q1")?.lastCorrect).toBe(true);
  });

  it("reports missing metadata and progress loading failures instead of starting unfiltered", async () => {
    mocks.getPracticeProgress.mockRejectedValueOnce(new Error("Unavailable"));
    const view = renderPractice();
    expect(await screen.findByRole("alert")).toHaveTextContent("konnten nicht geladen werden");
    mocks.getPractice.mockResolvedValue({ ...course, questions: [{ ...course.questions[0], metadata: undefined }] });
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("heading", { name: "Übungsfragen" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Übung starten" })).toBeDisabled());
    expect(screen.getAllByRole("alert").some((element) => element.textContent?.includes("unvollständig"))).toBe(true);
    view.unmount();
  });
});
