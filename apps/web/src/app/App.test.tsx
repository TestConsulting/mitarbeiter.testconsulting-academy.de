import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

const testUser = { id: "u1", email: "alex@example.test", name: "Alex Beispiel", role: "employee" as const };
const authApi = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  links: { list: vi.fn() },
  benefits: { list: vi.fn(), get: vi.fn() },
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
  authApi.links.list.mockResolvedValue([]);
  authApi.benefits.list.mockResolvedValue([]);
});

describe("portal shell", () => {
  it("shows the signed-in employee and all six phase-one destinations", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Willkommen, Alex" })).toBeInTheDocument();
    for (const title of ["eLearning", "Application Links", "Benefits", "Marketing", "Vertrieb", "Tasks"]) {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    }
  });

  it("toggles dark mode from the portal header", async () => {
    render(<App />);
    const switcher = await screen.findByRole("button", { name: /dark mode/i });

    expect(document.documentElement.dataset.theme).toBe("light");
    await userEvent.click(switcher);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: /light mode/i })).toBeInTheDocument();
  });

  it("opens a protected placeholder from portal navigation", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Willkommen, Alex" });
    const sidebarNav = screen.getByRole("complementary", { name: "Portalnavigation" });
    await userEvent.click(within(sidebarNav).getByRole("link", { name: "Marketing" }));
    expect(await screen.findByRole("heading", { name: "Dieser Bereich wird in einer späteren Phase eingerichtet." })).toBeInTheDocument();
    expect(screen.getByText("In Vorbereitung")).toBeInTheDocument();
  });

  it("opens the implemented Application Links page instead of the placeholder", async () => {
    render(<App />);
    const sidebarNav = await screen.findByRole("complementary", { name: "Portalnavigation" });
    await userEvent.click(within(sidebarNav).getByRole("link", { name: "Application Links" }));
    expect(await screen.findByRole("heading", { name: "Application Links" })).toBeInTheDocument();
    expect(await screen.findByText("Noch keine Application Links vorhanden.")).toBeInTheDocument();
    expect(screen.queryByText("Dieser Bereich wird in einer späteren Phase eingerichtet.")).not.toBeInTheDocument();
  });

  it("opens Benefits from navigation and supports a direct detail URL", async () => {
    const benefit = { id: "benefit-1", sortOrder: 0, url: null, title: "Test-Benefit", description: "Kurzbeschreibung", details: "Alle Details" };
    authApi.benefits.list.mockResolvedValue([benefit]);
    authApi.benefits.get.mockResolvedValue(benefit);
    render(<App />);
    const sidebarNav = await screen.findByRole("complementary", { name: "Portalnavigation" });
    await userEvent.click(within(sidebarNav).getByRole("link", { name: "Benefits" }));
    expect(await screen.findByRole("heading", { name: "Benefits" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("link", { name: "Test-Benefit: Details ansehen" }));
    expect(await screen.findByRole("heading", { name: "Test-Benefit", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Alle Details")).toBeInTheDocument();
    expect(authApi.benefits.get).toHaveBeenCalledWith("benefit-1");
  });
});