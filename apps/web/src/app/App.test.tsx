import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

const testUser = { id: "u1", email: "alex@example.test", name: "Alex Beispiel", role: "employee" as const };
const authApi = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../api/client.js", () => ({
  api: authApi,
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));

beforeEach(() => {
  authApi.me.mockResolvedValue(testUser);
  authApi.login.mockResolvedValue(testUser);
  authApi.logout.mockResolvedValue({ success: true });
});

describe("portal shell", () => {
  it("shows the signed-in employee and all six phase-one destinations", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Willkommen, Alex" })).toBeInTheDocument();
    for (const title of ["eLearning", "Application Links", "Benefits", "Marketing", "Vertrieb", "Tasks"]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });

  it("opens a protected placeholder from portal navigation", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Willkommen, Alex" });
    await userEvent.click(screen.getByRole("link", { name: "Benefits", exact: true }));
    expect(await screen.findByRole("heading", { name: "Dieser Bereich wird in einer späteren Phase eingerichtet." })).toBeInTheDocument();
    expect(screen.getByText("In Vorbereitung")).toBeInTheDocument();
  });
});