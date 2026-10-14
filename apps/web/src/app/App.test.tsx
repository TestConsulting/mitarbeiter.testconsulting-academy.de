import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { AuthProvider } from "./auth-context.js";
import { AdminUsersPage } from "../pages/admin-users-page.js";

const testUser = { id: "u1", email: "alex@example.test", name: "Alex Beispiel", role: "employee" as const };
const authApi = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  auth: { changePassword: vi.fn() },
  links: { list: vi.fn() },
  benefits: { list: vi.fn(), get: vi.fn() },
  users: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("../api/client.js", () => ({
  api: authApi,
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  authApi.me.mockResolvedValue(testUser);
  authApi.login.mockResolvedValue(testUser);
  authApi.logout.mockResolvedValue({ success: true });
  authApi.auth.changePassword.mockResolvedValue({ success: true });
  authApi.links.list.mockResolvedValue([]);
  authApi.benefits.list.mockResolvedValue([]);
  authApi.users.list.mockResolvedValue([]);
  authApi.users.create.mockResolvedValue({ id: "u-new", email: "", name: "", role: "employee" });
  authApi.users.update.mockResolvedValue({ id: "u-new", email: "", name: "", role: "employee" });
  authApi.users.delete.mockResolvedValue({ success: true });
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

  it("opens the same profile from the account navigation and header, then updates the password", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Willkommen, Alex" });

    const sidebar = screen.getByRole("complementary", { name: "Portalnavigation" });
    await userEvent.click(within(sidebar).getByRole("link", { name: "Mein Profil" }));
    const personalData = within(await screen.findByRole("region", { name: "Persönliche Daten" }));
    expect(personalData.getByText("Alex")).toBeInTheDocument();
    expect(personalData.getByText("Beispiel")).toBeInTheDocument();
    expect(personalData.getByText("alex@example.test")).toBeInTheDocument();
    expect(personalData.getByText("Mitarbeiter")).toBeInTheDocument();

    const passwordSection = within(screen.getByRole("region", { name: "Sicherheit" }));
    expect(passwordSection.getByText("Passwort")).toBeInTheDocument();
    expect(passwordSection.getByText("••••••••")).toBeInTheDocument();
    fireEvent.click(passwordSection.getByRole("button", { name: "Passwort ändern" }));
    const dialog = await waitFor(() => {
      const el = document.querySelector('[role="dialog"]');
      if (!el) throw new Error("Dialog not found");
      return el as HTMLElement;
    });
    expect(within(dialog).getByText("Passwort ändern", { selector: "h2" })).toBeInTheDocument();

    const currentPwInput = within(dialog).getByLabelText("Aktuelles Passwort", { selector: "input" });
    const newPwInput = within(dialog).getByLabelText("Neues Passwort", { selector: "input" });
    const confirmPwInput = within(dialog).getByLabelText("Neues Passwort bestätigen", { selector: "input" });

    fireEvent.change(currentPwInput, { target: { value: "old-password-value" } });
    fireEvent.change(newPwInput, { target: { value: "new-password-value" } });
    fireEvent.change(confirmPwInput, { target: { value: "new-password-value" } });

    const submitButton = within(dialog)
      .getAllByRole("button", { hidden: true })
      .find((button) => button.textContent?.includes("Passwort ändern"));
    expect(submitButton).toBeDefined();
    fireEvent.click(submitButton!);

    expect(await screen.findByRole("status")).toHaveTextContent("Dein Passwort wurde geändert.");
    expect(authApi.auth.changePassword).toHaveBeenCalledWith(
      "old-password-value",
      "new-password-value",
      "new-password-value",
    );

    const headerProfile = screen.getByRole("link", { name: "Mein Profil: alex@example.test" });
    fireEvent.click(headerProfile);
    expect(screen.getByRole("heading", { name: "Mein Profil" })).toBeInTheDocument();

    const personalSubLink = within(sidebar).getByRole("link", { name: "Persönliche Daten" });
    fireEvent.click(personalSubLink);
    expect(await screen.findByRole("region", { name: "Persönliche Daten" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Sicherheit" })).not.toBeInTheDocument();

    const securitySubLink = within(sidebar).getByRole("link", { name: "Sicherheit" });
    fireEvent.click(securitySubLink);
    expect(await screen.findByRole("region", { name: "Sicherheit" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Persönliche Daten" })).not.toBeInTheDocument();
  });

  it("allows selecting the admin role in the user form without crashing", async () => {
    const adminUser = { id: "admin-1", email: "admin@example.test", name: "Admin Beispiel", role: "admin" as const };
    authApi.me.mockResolvedValue(adminUser);
    authApi.users.list.mockResolvedValue([]);

    render(
      <AuthProvider>
        <AdminUsersPage />
      </AuthProvider>,
    );

    await screen.findByRole("heading", { name: "Benutzerverwaltung" });
    const roleSelect = screen.getAllByRole("combobox")[0];
    expect(roleSelect).toHaveValue("employee");

    await userEvent.selectOptions(roleSelect, "admin");
    expect(roleSelect).toHaveValue("admin");
  });
});