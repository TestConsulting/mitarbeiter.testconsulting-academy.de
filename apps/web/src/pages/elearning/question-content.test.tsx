import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionContent } from "./question-content.js";

describe("question content", () => {
  it("preserves statement lines and displays the provided diagram with accessible alternative text", () => {
    render(<QuestionContent question={{
      question: "Welche Phase ist markiert?\nI: Erste Aussage\nII: Zweite Aussage",
      image: { url: "/questions/istqb-foundation/prozess-116.png", alt: "Zweite Position gelb markiert" },
    }} />);
    expect(screen.getByText("I: Erste Aussage")).toBeInTheDocument();
    expect(screen.getByText("II: Zweite Aussage")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Zweite Position gelb markiert" }))
      .toHaveAttribute("src", "/questions/istqb-foundation/prozess-116.png");
  });

  it("does not add a diagram to text-only questions", () => {
    render(<QuestionContent question={{ question: "Was ist richtig?" }} />);
    expect(screen.getByText("Was ist richtig?")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
