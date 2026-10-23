import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamSession } from "@portal/shared";
import { FoundationExamPage } from "./foundation-exam-page.js";

const mocks = vi.hoisted(() => ({
  currentExamSession: vi.fn(), startExamSession: vi.fn(), changeExamSession: vi.fn(),
}));
vi.mock("../../api/client.js", () => ({
  api: { courses: mocks },
  ApiError: class ApiError extends Error {},
}));
let exam: ExamSession;
beforeEach(() => {
  vi.resetAllMocks();
  const now = Date.now();
  exam = {
    id: "exam-1", status: "active", startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3_600_000).toISOString(), serverTime: new Date(now).toISOString(),
    finishedAt: null, durationMinutes: 60, answers: [], result: null,
    course: {
      id: "istqb-foundation", slug: "istqb-foundation", title: "ISTQB Foundation", category: "ISTQB",
      description: "", questions: Array.from({ length: 40 }, (_, index) => ({
        id: `q${index}`, question: `Prüfungsfrage ${index + 1}`, type: "single" as const,
        options: [{ id: "a", text: "Antwort A" }, { id: "b", text: "Antwort B" }], requiredSelections: 1,
      })),
    },
  };
  mocks.currentExamSession.mockResolvedValue(null);
  mocks.startExamSession.mockImplementation(async (extended: boolean) => ({
    ...exam, durationMinutes: extended ? 75 : 60,
    expiresAt: new Date(Date.parse(exam.startedAt) + (extended ? 75 : 60) * 60_000).toISOString(),
  }));
  mocks.changeExamSession.mockImplementation(async (_id, action, answers) => {
    if (action === "save") return { ...exam, answers: answers ?? [] };
    return {
      ...exam, status: action === "abort" ? "aborted" : "submitted",
      finishedAt: new Date(Date.parse(exam.startedAt) + 137_000).toISOString(),
      result: action === "abort" ? null : { correctCount: 1, totalQuestions: 40, percentage: 3, passed: false, results: [] },
    };
  });
});
afterEach(() => vi.useRealTimers());
function show() {
  return render(<MemoryRouter><FluentProvider theme={webLightTheme}><FoundationExamPage /></FluentProvider></MemoryRouter>);
}
async function start() {
  show();
  fireEvent.click(await screen.findByRole("button", { name: "Prüfung starten" }));
  await screen.findByRole("timer");
}
describe("Foundation examination", () => {
  it.each([
    ["Prüfungsverlauf", "/areas/elearning/results"],
    ["Zurück zum Kurs", "/areas/elearning/istqb-foundation"],
  ])("renders %s as a button and navigates to %s", async (name, destination) => {
    render(<MemoryRouter><FluentProvider theme={webLightTheme}>
      <Routes>
        <Route path="/" element={<FoundationExamPage />} />
        <Route path={destination} element={<h1>Navigationsziel</h1>} />
      </Routes>
    </FluentProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Prüfung starten" }));
    fireEvent.click(await screen.findByRole("button", { name: "Prüfung abgeben" }));
    fireEvent.click(screen.getByRole("button", { name: "Endgültig abgeben" }));
    fireEvent.click(await screen.findByRole("button", { name }));
    expect(await screen.findByRole("heading", { name: "Navigationsziel" })).toBeInTheDocument();
  });
  it("shows preparation without starting the clock, explains the blueprint and starts the selected 75 minutes explicitly", async () => {
    show();
    expect(await screen.findByRole("heading", { name: "ISTQB Foundation Level - Prüfungsmodus" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zurück zum Kurs" }))
      .toHaveAttribute("href", "/areas/elearning/istqb-foundation");
    expect(document.querySelector(".course-practice-actions a")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prüfung starten" }).parentElement)
      .toHaveClass("foundation-exam__start-actions");
    expect(mocks.startExamSession).not.toHaveBeenCalled();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Themen- und Wissensverteilung der 40 Prüfungsfragen"));
    expect(screen.getByText("K1 – Erinnern: 8 · K2 – Verstehen: 24 · K3 – Anwenden: 8")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Prüfungssprache ist nicht meine Muttersprache" }));
    expect(screen.getByText("Gewählte Dauer: 75 Minuten.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Prüfung starten" }));
    expect(await screen.findByRole("timer")).toHaveTextContent("75:00");
    expect(screen.getByText("Verbleibende Zeit:")).toBeInTheDocument();
    expect(mocks.startExamSession).toHaveBeenCalledWith(true);
    expect(screen.getAllByRole("button", { name: /^Frage \d+,/ })).toHaveLength(40);
    expect(screen.getByRole("progressbar", { name: "Fortschritt: Frage 1 von 40" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unterbrechen" })).not.toBeInTheDocument();
  });
  it("autosaves, retains answers across navigation and waits for pending saves before confirmed submission", async () => {
    await start();
    let complete!: (value: ExamSession) => void;
    mocks.changeExamSession.mockReturnValueOnce(new Promise<ExamSession>((resolve) => { complete = resolve; }));
    fireEvent.click(screen.getByLabelText("Antwort A"));
    expect(screen.getByRole("button", { name: "Nächste Frage" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nächste Frage" }));
    fireEvent.click(screen.getByRole("button", { name: "Vorherige Frage" }));
    expect(screen.getByLabelText("Antwort A")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Prüfung abgeben" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("39 Fragen sind noch ohne Auswahl");
    fireEvent.click(screen.getByRole("button", { name: "Endgültig abgeben" }));
    await waitFor(() => expect(mocks.changeExamSession).toHaveBeenCalledTimes(1));
    expect(mocks.changeExamSession).toHaveBeenCalledWith("exam-1", "save", [{ questionId: "q0", selectedOptionIds: ["a"] }]);
    await act(async () => { complete(exam); });
    expect(await screen.findByRole("heading", { name: "Prüfung abgeschlossen!" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zurück zum Kurs „ISTQB Foundation“" }))
      .toHaveAttribute("href", "/areas/elearning/istqb-foundation");
    expect(screen.getByText("Kurs: ISTQB Foundation")).toBeInTheDocument();
    expect(screen.getByText(`Abgegeben: ${new Date(Date.parse(exam.startedAt) + 137_000).toLocaleString("de-DE")}`)).toBeInTheDocument();
    expect(screen.getByText("Zeitlimit: 60 Minuten · Bearbeitungsdauer: 2 Minuten 17 Sekunden")).toBeInTheDocument();
    expect(mocks.changeExamSession).toHaveBeenLastCalledWith("exam-1", "submit");
  });
  it("groups exam actions into left, centered and right footer areas and clears the current answer", async () => {
    await start();
    const footer = document.querySelector<HTMLElement>(".foundation-exam__footer")!;
    const leftActions = footer.querySelector<HTMLElement>(".practice-card__answer-actions")!;
    const navigation = footer.querySelector<HTMLElement>(".practice-card__navigation")!;
    const rightActions = footer.querySelector<HTMLElement>(".foundation-exam__submit")!;
    expect(within(leftActions).getByRole("button", { name: "Auswahl aufheben" })).toBeDisabled();
    expect(within(navigation).getByRole("button", { name: "Vorherige Frage" })).toBeDisabled();
    expect(within(navigation).getByRole("button", { name: "Überspringen" })).toBeEnabled();
    expect(within(rightActions).getByRole("button", { name: "Prüfung abgeben" })).toBeEnabled();
    expect(within(rightActions).getByRole("button", { name: "Prüfung abbrechen" })).toBeEnabled();

    fireEvent.click(screen.getByLabelText("Antwort A"));
    const clearButton = within(leftActions).getByRole("button", { name: "Auswahl aufheben" });
    await waitFor(() => expect(clearButton).toBeEnabled());
    fireEvent.click(clearButton);
    expect(screen.getByLabelText("Antwort A")).not.toBeChecked();
    await waitFor(() => expect(mocks.changeExamSession).toHaveBeenLastCalledWith(
      "exam-1",
      "save",
      [{ questionId: "q0", selectedOptionIds: [] }],
    ));
  });
  it("resumes persisted answers without starting another exam, and documents confirmed aborts without a score", async () => {
    mocks.currentExamSession.mockResolvedValue({ ...exam, answers: [{ questionId: "q0", selectedOptionIds: ["b"] }] });
    show();
    expect(await screen.findByLabelText("Antwort B")).toBeChecked();
    expect(mocks.startExamSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Prüfung abbrechen" }));
    fireEvent.click(screen.getByRole("button", { name: "Weiter bearbeiten" }));
    expect(mocks.changeExamSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Prüfung abbrechen" }));
    fireEvent.click(screen.getByRole("button", { name: "Endgültig abbrechen" }));
    expect(await screen.findByRole("heading", { name: "Prüfung abgebrochen" })).toBeInTheDocument();
    expect(screen.queryByText("Ergebnis")).not.toBeInTheDocument();
  });
  it("shows answer status icons and the solution explanation in the completed foundation exam review", async () => {
    const explanation = "Die richtige Antwort beschreibt den vorbeugenden Ansatz.";
    exam.course.questions[0].metadata = {
      chapter: 1, chapterTitle: "Grundlagen des Testens", learningObjective: "FL-1.1.1", kLevel: "K1",
    };
    exam.course.questions[1].metadata = {
      chapter: 1, chapterTitle: "Grundlagen des Testens", learningObjective: "FL-1.1.2", kLevel: "K2",
    };
    exam.course.questions[2].metadata = {
      chapter: 2,
      chapterTitle: "Testen im Softwareentwicklungslebenszyklus",
      learningObjective: "FL-2.1.1",
      kLevel: "K1",
    };
    mocks.changeExamSession.mockImplementation(async (_id, action) => action === "submit" ? ({
      ...exam,
      status: "submitted",
      finishedAt: new Date(Date.parse(exam.startedAt) + 137_000).toISOString(),
      result: {
        correctCount: 1,
        totalQuestions: 40,
        percentage: 3,
        passed: false,
        results: [
          {
            question: {
              ...exam.course.questions[0],
              metadata: {
                chapter: 1,
                chapterTitle: "Grundlagen des Testens",
                learningObjective: "FL-1.1.1",
                kLevel: "K1",
              },
            },
            selectedOptionIds: ["b"],
            correctOptionIds: ["a"],
            explanation,
            isCorrect: false,
          },
          {
            question: {
              ...exam.course.questions[1],
              metadata: {
                chapter: 1,
                chapterTitle: "Grundlagen des Testens",
                learningObjective: "FL-1.1.2",
                kLevel: "K2",
              },
            },
            selectedOptionIds: ["a"],
            correctOptionIds: ["a"],
            explanation,
            isCorrect: true,
          },
          {
            question: {
              ...exam.course.questions[2],
              metadata: {
                chapter: 2,
                chapterTitle: "Testen im Softwareentwicklungslebenszyklus",
                learningObjective: "FL-2.1.1",
                kLevel: "K1",
              },
            },
            selectedOptionIds: [],
            correctOptionIds: ["a"],
            explanation,
            isCorrect: false,
          },
        ],
      },
    }) : ({ ...exam, answers: [] }));

    await start();
    fireEvent.click(screen.getByRole("button", { name: "Prüfung abgeben" }));
    fireEvent.click(screen.getByRole("button", { name: "Endgültig abgeben" }));
    expect(await screen.findByRole("heading", { name: "Prüfung abgeschlossen!" })).toBeInTheDocument();

    const reviewSection = document.querySelector<HTMLDetailsElement>(".exam-review")!;
    expect(reviewSection).not.toHaveAttribute("open");
    const reviewQuestionSummary = reviewSection.querySelector(".exam-history-review summary");
    expect(reviewQuestionSummary).not.toBeVisible();
    fireEvent.click(reviewSection.querySelector<HTMLElement>("summary")!);
    expect(reviewSection).toHaveAttribute("open");
    fireEvent.change(within(reviewSection).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "incorrect" },
    });
    expect(reviewSection.querySelectorAll(".exam-history-review")).toHaveLength(1);
    expect(reviewSection.querySelector(".exam-history-review summary")).toHaveTextContent("Prüfungsfrage 1");
    fireEvent.change(within(reviewSection).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "open" },
    });
    expect(reviewSection.querySelectorAll(".exam-history-review")).toHaveLength(1);
    expect(reviewSection.querySelector(".exam-history-review summary")).toHaveTextContent("Prüfungsfrage 3");
    fireEvent.change(within(reviewSection).getByRole("combobox", { name: "Antworten anzeigen" }), {
      target: { value: "all" },
    });
    const review = reviewSection.querySelector<HTMLElement>(".exam-history-review")!;
    expect(review).not.toHaveAttribute("open");
    expect(review.querySelector("summary")).toHaveTextContent("Frage 1: Prüfungsfrage 1");
    expect(review.querySelector(".exam-history-review__question"))
      .toHaveTextContent("Frage 1: Prüfungsfrage 1");
    expect(within(review).getByRole("img", { name: "Falsch beantwortet" }))
      .toHaveClass("exam-history-review__status-icon", "practice-review-option--wrong");
    const reviews = document.querySelectorAll<HTMLElement>(".exam-history-review");
    expect(within(reviews[0]).getByText("0 Punkte (falsch)"))
      .toHaveClass("exam-history-review__summary-status", "practice-review-option--wrong");
    expect(within(reviews[1]).getByText("1 Punkt (richtig)"))
      .toHaveClass("exam-history-review__summary-status", "practice-review-option--correct");
    expect(within(reviews[1]).getByRole("img", { name: "Richtig beantwortet" }))
      .toHaveClass("exam-history-review__status-icon", "practice-review-option--correct");
    expect(within(reviews[2]).getByRole("img", { name: "Nicht beantwortet" }))
      .toHaveClass("exam-history-review__status-icon", "exam-history-review__open-icon");
    const chapterRows = within(screen.getByRole("table")).getAllByRole("row");
    expect(within(chapterRows[1]).getAllByRole("cell").slice(0, 4).map((cell) => cell.textContent))
      .toEqual(["1", "1", "0", "2"]);
    expect(within(chapterRows[1]).getAllByRole("cell")[4]).toHaveTextContent("1/2 Pkt.");
    expect(within(chapterRows[1]).getByText("Lernziele dieses Kapitels wiederholen und Fehler gezielt üben."))
      .toBeInTheDocument();
    expect(within(chapterRows[2]).getAllByRole("cell").slice(0, 4).map((cell) => cell.textContent))
      .toEqual(["0", "0", "1", "1"]);
    expect(within(chapterRows[2]).getAllByRole("cell")[4]).toHaveTextContent("0/1 Pkt.");
    fireEvent.click(review.querySelector<HTMLElement>("summary")!);
    expect(review.querySelector(".exam-history-review__options"))
      .toHaveClass("exam-history-review__options", "exam-history-review__options--standalone");
    expect(within(review).getByText("Erklärung zur Lösung:")).toBeInTheDocument();
    const explanationText = within(review).getByText(explanation);
    expect(explanationText.tagName).toBe("P");
    expect(explanationText.parentElement).toHaveClass("exam-history-review__explanation");
    const unansweredReview = reviews[2];
    expect(within(unansweredReview).getByText("0 Punkte (übersprungen/nicht geprüft)"))
      .toHaveClass("exam-history-review__summary-status");
    fireEvent.click(unansweredReview.querySelector<HTMLElement>("summary")!);
    expect(unansweredReview.querySelector(".exam-history-review__answer-card"))
      .not.toHaveTextContent("0 Punkte (übersprungen/nicht geprüft)");
  });
  it("reports save errors and retries unsaved answers before submission", async () => {
    await start();
    mocks.changeExamSession.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByLabelText("Antwort A"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Antworten nicht gespeichert");
    expect(screen.getByRole("status")).toHaveTextContent("Nicht gespeicherte Antworten");
    fireEvent.click(screen.getByRole("button", { name: "Prüfung abgeben" }));
    fireEvent.click(screen.getByRole("button", { name: "Endgültig abgeben" }));
    expect(await screen.findByRole("heading", { name: "Prüfung abgeschlossen!" })).toBeInTheDocument();
    expect(mocks.changeExamSession.mock.calls.map((call) => call[1])).toEqual(["save", "save", "submit"]);
  });
  it("does not overwrite a new local answer when a cross-tab refresh arrives during selection", async () => {
    await start();
    let finishRefresh!: (value: ExamSession) => void;
    mocks.currentExamSession.mockReturnValueOnce(new Promise<ExamSession>((resolve) => { finishRefresh = resolve; }));
    fireEvent.focus(window);
    await waitFor(() => expect(mocks.currentExamSession).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByLabelText("Antwort B"));
    await act(async () => { finishRefresh(exam); });
    await waitFor(() => expect(mocks.changeExamSession).toHaveBeenCalledWith(
      "exam-1", "save", [{ questionId: "q0", selectedOptionIds: ["b"] }],
    ));
    expect(screen.getByLabelText("Antwort B")).toBeChecked();
  });
  it("uses the absolute deadline after time jumps rather than pausing or decrementing only once", async () => {
    vi.useFakeTimers();
    mocks.currentExamSession.mockResolvedValue(exam);
    show();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("timer")).toHaveTextContent("60:00");
    await act(async () => {
      vi.setSystemTime(Date.parse(exam.expiresAt) + 10_000);
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mocks.changeExamSession).toHaveBeenCalledWith("exam-1", "submit");
    expect(screen.getByRole("heading", { name: "Prüfung abgeschlossen!" })).toBeInTheDocument();
  });
});
