import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuestionContent } from "./question-content.js";

function renderQuestion(question: Parameters<typeof QuestionContent>[0]["question"]) {
  return render(
    <FluentProvider theme={webLightTheme}>
      <QuestionContent question={question} />
    </FluentProvider>,
  );
}

describe("question content", () => {
  it("preserves statement lines and displays the provided diagram with accessible alternative text", () => {
    renderQuestion({
      question: "Welche Phase ist markiert?\nI: Erste Aussage\nII: Zweite Aussage",
      image: { url: "/questions/istqb-foundation/prozess-116.png", alt: "Zweite Position gelb markiert" },
    });
    expect(screen.getByText("I: Erste Aussage")).toBeInTheDocument();
    expect(screen.getByText("II: Zweite Aussage")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Zweite Position gelb markiert" }))
      .toHaveAttribute("src", "/questions/istqb-foundation/prozess-116.png");
    expect(screen.getByRole("button", { name: "Bild vergrößern: Zweite Position gelb markiert" }))
      .toContainElement(screen.getByRole("img", { name: "Zweite Position gelb markiert" }));
  });

  it("does not add a diagram to text-only questions", () => {
    renderQuestion({ question: "Was ist richtig?" });
    expect(screen.getByText("Was ist richtig?")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders uploaded image-only questions using the authenticated preview route", () => {
    const url = "/api/courses/materials/7ef487bd-b454-4346-ad10-699241334752/download?preview=1";
    renderQuestion({ question: "", image: { url, alt: "Aufgabendiagramm" } });
    expect(screen.getByRole("img", { name: "Aufgabendiagramm" })).toHaveAttribute("src", url);
  });

  it("opens a zoomable image dialog and closes it from its button or Escape", async () => {
    const user = userEvent.setup();
    renderQuestion({ question: "Was zeigt die Grafik?", image: { url: "/diagram.png", alt: "Prozessgrafik" } });
    await user.click(screen.getByRole("button", { name: "Bild vergrößern: Prozessgrafik" }));
    const dialog = await screen.findByRole("dialog");
    const modalImage = within(dialog).getByRole("img", { name: "Prozessgrafik" });
    vi.spyOn(modalImage, "getBoundingClientRect").mockReturnValue({
      width: 600, height: 300, top: 0, right: 600, bottom: 300, left: 0, x: 0, y: 0,
      toJSON: () => ({}),
    });
    await user.click(within(dialog).getByRole("button", { name: "Vergrößern" }));
    expect(modalImage).toHaveStyle({ width: "900px" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bild vergrößern: Prozessgrafik" }));
    const reopenedDialog = await screen.findByRole("dialog");
    await user.click(within(reopenedDialog).getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
