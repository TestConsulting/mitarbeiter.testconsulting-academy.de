import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Benefit } from "@portal/shared";
import { ApiError } from "../api/client.js";
import { BenefitsPage } from "./benefits-page.js";
import { BenefitDetailPage } from "./benefit-detail-page.js";

const mocks = vi.hoisted(() => ({
  role: "employee" as "employee" | "admin",
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
}));
vi.mock("../app/auth-context.js", () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock("../api/client.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/client.js")>(),
  api: { benefits: mocks },
}));

const benefit: Benefit = {
  id: "benefit-1", title: "Test-Benefit", description: "Ein Vorteil im Test",
  details: "Informationen und Bedingungen\nKontakt: Testadministration",
};

function renderPage(path = "/areas/benefits") {
  return render(
    <FluentProvider theme={webLightTheme}><MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/areas/benefits" element={<BenefitsPage />} />
        <Route path="/areas/benefits/:id" element={<BenefitDetailPage />} />
      </Routes>
    </MemoryRouter></FluentProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.role = "employee";
  mocks.list.mockResolvedValue([benefit]);
  mocks.get.mockResolvedValue(benefit);
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Benefits pages", () => {
  it("shows cards and navigates to details without employee management controls", async () => {
    const user = userEvent.setup();
    renderPage();
    const details = await screen.findByRole("link", { name: `${benefit.title}: Details ansehen` });
    expect(screen.getByText(benefit.description)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Benefit hinzufügen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bearbeiten|löschen/ })).not.toBeInTheDocument();
    await user.click(details);
    expect(await screen.findByRole("heading", { name: benefit.title, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Informationen und Bedingungen/)).toHaveTextContent("Kontakt: Testadministration");
    expect(mocks.get).toHaveBeenCalledWith(benefit.id);
    expect(screen.queryByRole("button", { name: /bearbeiten|löschen/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Alle Benefits" }));
    expect(await screen.findByRole("heading", { name: "Benefits" })).toBeInTheDocument();
  });

  it("shows a distinct empty state", async () => {
    mocks.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Noch keine Benefits vorhanden.")).toBeInTheDocument();
    expect(screen.getByText("Die Benefits werden von der Administration bereitgestellt.")).toBeInTheDocument();
  });

  it("shows loading and retries failed list loads", async () => {
    mocks.list.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue([benefit]);
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText("Benefits werden geladen …")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Benefits konnten nicht geladen werden.");
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("article", { name: benefit.title })).toBeInTheDocument();
  });

  it("creates a Benefit with title, summary and detail text, sorted by title", async () => {
    mocks.role = "admin";
    const created = { ...benefit, id: "benefit-2", title: "A Vorteil" };
    mocks.create.mockResolvedValue(created);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Benefit hinzufügen" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Titel", { exact: false }), created.title);
    await user.type(dialog.getByLabelText("Kurzbeschreibung", { exact: false }), created.description);
    await user.type(dialog.getByLabelText("Details", { exact: false }), created.details);
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Benefit wurde gespeichert.");
    expect(mocks.create).toHaveBeenCalledWith({
      title: created.title, description: created.description, details: created.details,
    });
    expect(screen.getAllByRole("article").map((card) => card.getAttribute("aria-label"))).toEqual([created.title, benefit.title]);
  });

  it.each(["/areas/benefits", "/areas/benefits/benefit-1"])("edits all fields from %s", async (path) => {
    mocks.role = "admin";
    const updated = { ...benefit, title: "Aktualisiert", description: "Neue Beschreibung", details: "Neue Bedingungen" };
    mocks.update.mockResolvedValue(updated);
    const user = userEvent.setup();
    renderPage(path);
    await user.click(await screen.findByRole("button", { name: `${benefit.title} bearbeiten` }));
    const dialog = within(screen.getByRole("dialog"));
    for (const [label, value] of [["Titel", updated.title], ["Kurzbeschreibung", updated.description], ["Details", updated.details]]) {
      const field = dialog.getByLabelText(label, { exact: false });
      await user.clear(field);
      await user.type(field, value);
    }
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Benefit wurde gespeichert.")).toBeInTheDocument();
    expect(mocks.update).toHaveBeenCalledWith(benefit.id, {
      title: updated.title, description: updated.description, details: updated.details,
    });
    expect(screen.getByText(updated.description)).toBeInTheDocument();
    if (path.endsWith(benefit.id)) expect(screen.getByText(updated.details)).toBeInTheDocument();
  });

  it("requires confirmation and can cancel before deleting a card", async () => {
    mocks.role = "admin";
    mocks.delete.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: `${benefit.title} löschen` }));
    expect(mocks.delete).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `${benefit.title} löschen` }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Löschen" }));
    expect(await screen.findByText("Noch keine Benefits vorhanden.")).toBeInTheDocument();
    expect(mocks.delete).toHaveBeenCalledWith(benefit.id);
  });

  it("returns to the list after deleting from the detail page", async () => {
    mocks.role = "admin";
    mocks.list.mockResolvedValue([]);
    mocks.delete.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPage(`/areas/benefits/${benefit.id}`);
    await user.click(await screen.findByRole("button", { name: `${benefit.title} löschen` }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Löschen" }));
    expect(await screen.findByRole("heading", { name: "Benefits" })).toBeInTheDocument();
    expect(await screen.findByText("Benefit wurde gelöscht.")).toBeInTheDocument();
  });

  it("preserves the form and existing card after a failed save", async () => {
    mocks.role = "admin";
    mocks.update.mockRejectedValue(new ApiError("Nicht gespeichert.", 500));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: `${benefit.title} bearbeiten` }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Nicht gespeichert.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Titel", { exact: false })).toHaveValue(benefit.title);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Abbrechen" }));
    expect(await screen.findByRole("article", { name: benefit.title })).toBeInTheDocument();
  });

  it("preserves a card and shows an explicit error after failed deletion", async () => {
    mocks.role = "admin";
    mocks.delete.mockRejectedValue(new Error("Offline"));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: `${benefit.title} löschen` }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Löschen" }));
    expect(await screen.findByText("Der Benefit konnte nicht gelöscht werden. Bitte versuche es erneut.")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: benefit.title, hidden: true })).toBeInTheDocument();
  });

  it("rejects whitespace-only fields without calling the API", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: `${benefit.title} bearbeiten` }));
    const dialog = within(screen.getByRole("dialog"));
    await user.clear(dialog.getByLabelText("Details", { exact: false }));
    await user.type(dialog.getByLabelText("Details", { exact: false }), " ");
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText(/Bitte fülle Titel/)).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([400, 404])("shows a missing detail page for HTTP %s", async (status) => {
    mocks.get.mockRejectedValue(new ApiError("Nicht gefunden.", status));
    renderPage(`/areas/benefits/${benefit.id}`);
    expect(await screen.findByRole("heading", { name: "Benefit wurde nicht gefunden." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alle Benefits" })).toBeInTheDocument();
  });

  it("retries failed detail loads and escapes HTML-like content", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({
      ...benefit, details: '<script>alert("test")</script>\nZweite Zeile',
    });
    const user = userEvent.setup();
    renderPage(`/areas/benefits/${benefit.id}`);
    expect(screen.getByText("Benefit wird geladen …")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Benefit konnte nicht geladen werden.");
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    const content = await screen.findByText(/<script>/);
    expect(content.querySelector("script")).toBeNull();
    expect(content).toHaveTextContent("Zweite Zeile");
  });
});
