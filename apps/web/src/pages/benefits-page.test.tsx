import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Benefit } from "@portal/shared";
import { ApiError } from "../api/client.js";
import { BenefitsPage } from "./benefits-page.js";
import { BenefitDetailPage } from "./benefit-detail-page.js";

const mocks = vi.hoisted(() => ({
  role: "employee" as "employee" | "admin" | "user",
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), reorder: vi.fn(),
}));
vi.mock("../app/auth-context.js", () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock("../api/client.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/client.js")>(),
  api: { benefits: mocks },
}));

const benefit: Benefit = {
  id: "benefit-1", sortOrder: 0, url: null, title: "Test-Benefit", description: "Ein Vorteil im Test",
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
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Benefits pages", () => {
  it.each(["Sachbezug - Sachbezugskarte", "Sachbezugskarte"])("shows a payment card icon for %s on the card and detail page", async (title) => {
    const card = { ...benefit, title };
    mocks.list.mockResolvedValue([card]);
    mocks.get.mockResolvedValue(card);
    const user = userEvent.setup();
    renderPage();
    const tile = await screen.findByRole("article", { name: title });
    expect(tile.querySelector(".benefit-card__icon--image img")).toHaveAttribute("src", "/images/sachbezugskarte.png");
    await user.click(within(tile).getByRole("link", { name: `${title}: Details ansehen` }));
    await screen.findByRole("heading", { name: title, level: 1 });
    expect(document.querySelector(".benefit-card__icon--image img")).toHaveAttribute("src", "/images/sachbezugskarte.png");
  });

  it("renders web addresses in benefit details as safe new-tab links while keeping text", async () => {
    const url = "https://confluence-testconsulting.atlassian.net/wiki/spaces/SL/pages/7686651909/Firmenhandy-Konzept+und+Beantragungshinweise";
    const details = `Informationen:\n${url}\nWeitere Informationen unter https://example.test/info. Kein HTML: <b>Text</b>`;
    mocks.get.mockResolvedValue({ ...benefit, details });
    renderPage("/areas/benefits/benefit-1");
    const link = await screen.findByRole("link", { name: url });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "https://example.test/info" })).toHaveAttribute("href", "https://example.test/info");
    expect(screen.getByRole("region", { name: "Details" }).querySelector("p")?.textContent).toBe(details);
    expect(screen.getByRole("region", { name: "Details" }).querySelector("b")).toBeNull();
  });

  it.each(["/areas/benefits", "/areas/benefits/benefit-1"])("shows email links without opening a new tab on %s", async (path) => {
    const linked = { ...benefit, url: "mailto:backoffice@testconsulting.de" };
    mocks.list.mockResolvedValue([linked]);
    mocks.get.mockResolvedValue(linked);
    renderPage(path);
    const action = await screen.findByRole("link", { name: `${benefit.title}: E-Mail schreiben` });
    expect(action).toHaveAttribute("href", linked.url);
    expect(action).not.toHaveAttribute("target");
    expect(action).toHaveAttribute("draggable", "false");
  });

  it.each(["Dein Sachbezug", "Dein Sachbezug - Informationen"])("shows a filled gift icon for %s on the card and detail page", async (title) => {
    const sachbezug = { ...benefit, title };
    mocks.list.mockResolvedValue([sachbezug]);
    mocks.get.mockResolvedValue(sachbezug);
    const user = userEvent.setup();
    renderPage();
    const tile = await screen.findByRole("article", { name: sachbezug.title });
    expect(tile.querySelector(".benefit-card__icon--gift svg")).toHaveAttribute("fill", "currentColor");
    await user.click(within(tile).getByRole("link", { name: `${sachbezug.title}: Details ansehen` }));
    await screen.findByRole("heading", { name: sachbezug.title, level: 1 });
    expect(document.querySelector(".benefit-card__icon--gift svg")).toBeInTheDocument();
  });

  it.each([
    ["UrbanSports", "/images/urban-sports.webp"],
    ["Urban Sports", "/images/urban-sports.webp"],
    ["Urban Sports Club", "/images/urban-sports.webp"],
    ["Sachbezug - UrbanSports", "/images/urban-sports.webp"],
    ["Sachbezug - Urban Sports", "/images/urban-sports.webp"],
    ["Firmenhandy", "/images/firmenhandy.jpg"],
  ])("shows the supplied %s icon on the card and detail page", async (title, source) => {
    const urbanSports = { ...benefit, title };
    mocks.list.mockResolvedValue([urbanSports, { ...benefit, id: "other-benefit", sortOrder: 1 }]);
    mocks.get.mockResolvedValue(urbanSports);
    const user = userEvent.setup();
    renderPage();
    const tile = await screen.findByRole("article", { name: title });
    expect(tile.querySelector("img")).toHaveAttribute("src", source);
    expect(tile.querySelector("img")).toHaveAttribute("alt", "");
    expect(tile.querySelector("img")).toHaveAttribute("draggable", "false");
    expect(screen.getByRole("article", { name: benefit.title }).querySelector("img")).toBeNull();
    await user.click(within(tile).getByRole("link", { name: `${title}: Details ansehen` }));
    await screen.findByRole("heading", { name: title, level: 1 });
    expect(document.querySelector(".benefit-card__icon--image img")).toHaveAttribute("src", source);
  });

  it("shows cards and navigates to details without employee management controls", async () => {
    const user = userEvent.setup();
    renderPage();
    const details = await screen.findByRole("link", { name: `${benefit.title}: Details ansehen` });
    expect(screen.getByText(benefit.description)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Benefit hinzufügen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bearbeiten|löschen/ })).not.toBeInTheDocument();
    expect(screen.getByRole("article")).not.toHaveAttribute("tabindex");
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

  it("appends a new Benefit with title, summary and detail text", async () => {
    mocks.role = "admin";
    const created = { ...benefit, id: "benefit-2", title: "A Vorteil", sortOrder: 1 };
    mocks.create.mockResolvedValue(created);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Benefit hinzufügen" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Titel", { exact: false }), created.title);
    await user.type(dialog.getByLabelText("Kurzbeschreibung", { exact: false }), created.description);
    await user.type(dialog.getByLabelText("Details", { exact: false }), created.details);
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Benefit wurde gespeichert.")).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith({
      title: created.title, description: created.description, details: created.details, url: null,
    });
    await waitFor(() => {
      expect(screen.getAllByRole("article").map((card) => card.getAttribute("aria-label"))).toEqual([
        `${benefit.title} verschieben`, `${created.title} verschieben`,
      ]);
    });
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
      title: updated.title, description: updated.description, details: updated.details, url: null,
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
    expect(await screen.findByRole("article", { name: `${benefit.title} verschieben` })).toBeInTheDocument();
  });

  it("preserves a card and shows an explicit error after failed deletion", async () => {
    mocks.role = "admin";
    mocks.delete.mockRejectedValue(new Error("Offline"));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: `${benefit.title} löschen` }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Löschen" }));
    expect(await screen.findByText("Der Benefit konnte nicht gelöscht werden. Bitte versuche es erneut.")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: `${benefit.title} verschieben`, hidden: true })).toBeInTheDocument();
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

  it.each(["admin", "user"] as const)("lets %s reorder cards with the keyboard and restore the order after a reload", async (role) => {
    mocks.role = role;
    const second = { ...benefit, id: "benefit-2", title: "Weiterbildung", sortOrder: 1 };
    const reordered = [{ ...second, sortOrder: 0 }, { ...benefit, sortOrder: 1 }];
    mocks.list.mockResolvedValueOnce([benefit, second]).mockResolvedValue(reordered);
    mocks.reorder.mockResolvedValue(reordered);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = this.matches("article") ? Array.from(this.parentElement!.children).indexOf(this) : 0;
      return { x: index * 300, y: 0, left: index * 300, top: 0, right: index * 300 + 260, bottom: 200,
        width: 260, height: 200, toJSON: () => ({}) };
    });
    const user = userEvent.setup();
    const rendered = renderPage();
    (await screen.findByRole("article", { name: `${benefit.title} verschieben` })).focus();
    await user.keyboard(" {ArrowRight} ");
    expect(mocks.reorder).toHaveBeenCalledWith([second.id, benefit.id]);
    expect(await screen.findByText("Reihenfolge wurde für alle Mitarbeitenden gespeichert.")).toBeInTheDocument();
    expect(screen.getAllByRole("article").map((card) => card.getAttribute("aria-label"))).toEqual([
      `${second.title} verschieben`, `${benefit.title} verschieben`,
    ]);
    rendered.unmount();
    renderPage();
    await screen.findByRole("article", { name: `${second.title} verschieben` });
    expect(screen.getAllByRole("article")[0]).toHaveAccessibleName(`${second.title} verschieben`);
  });

  it("restores the old order and surfaces errors after a failed reorder", async () => {
    mocks.role = "user";
    const second = { ...benefit, id: "benefit-2", title: "Weiterbildung", sortOrder: 1 };
    mocks.list.mockResolvedValue([benefit, second]);
    mocks.reorder.mockRejectedValue(new ApiError("Die Benefits haben sich geändert.", 409));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = this.matches("article") ? Array.from(this.parentElement!.children).indexOf(this) : 0;
      return { x: index * 300, y: 0, left: index * 300, top: 0, right: index * 300 + 260, bottom: 200,
        width: 260, height: 200, toJSON: () => ({}) };
    });
    const user = userEvent.setup();
    renderPage();
    (await screen.findByRole("article", { name: `${benefit.title} verschieben` })).focus();
    await user.keyboard(" {ArrowRight} ");
    expect(await screen.findByText("Die Benefits haben sich geändert.")).toBeInTheDocument();
    expect(screen.getAllByRole("article")[0]).toHaveAccessibleName(`${benefit.title} verschieben`);
  });

  it("does not drag from edit controls and disables dragging while a dialog is open", async () => {
    mocks.role = "user";
    const user = userEvent.setup();
    renderPage();
    const edit = await screen.findByRole("button", { name: `${benefit.title} bearbeiten` });
    edit.focus();
    await user.keyboard(" ");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("article", { hidden: true })).not.toHaveAttribute("tabindex"));
    expect(mocks.reorder).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(screen.getByRole("article")).toHaveAttribute("tabindex", "0"));
  });

  it.each(["/areas/benefits", "/areas/benefits/benefit-1"])("shows optional external URLs safely on %s", async (path) => {
    const linked = { ...benefit, url: "https://example.test/benefit" };
    mocks.list.mockResolvedValue([linked]);
    mocks.get.mockResolvedValue(linked);
    renderPage(path);
    const link = await screen.findByRole("link", { name: `${benefit.title}: Angebot öffnen (neuer Tab)` });
    expect(link).toHaveAttribute("href", linked.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("draggable", "false");
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it.each([
    ["www.example.test/benefit", "https://www.example.test/benefit", "Angebot öffnen (neuer Tab)"],
    ["mailto:backoffice@testconsulting.de", "mailto:backoffice@testconsulting.de", "E-Mail schreiben"],
  ])("creates a Benefit with a supported URL: %s", async (url, expectedUrl, action) => {
    mocks.role = "user";
    const created = { ...benefit, id: "benefit-2", sortOrder: 1, url: expectedUrl };
    mocks.create.mockResolvedValue(created);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Benefit hinzufügen" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Titel", { exact: false }), benefit.title);
    await user.type(dialog.getByLabelText("Kurzbeschreibung", { exact: false }), benefit.description);
    await user.type(dialog.getByLabelText("Details", { exact: false }), benefit.details);
    await user.type(dialog.getByLabelText("Ziel-URL", { exact: false }), url);
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("link", { name: `${benefit.title}: ${action}` })).toHaveAttribute("href", created.url);
    expect(mocks.create).toHaveBeenCalledWith({
      title: benefit.title, description: benefit.description, details: benefit.details, url: created.url,
    });
  });

  it("prefills the URL and can remove it", async () => {
    mocks.role = "user";
    mocks.list.mockResolvedValue([{ ...benefit, url: "https://example.test/benefit" }]);
    mocks.update.mockResolvedValue(benefit);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: `${benefit.title} bearbeiten` }));
    const dialog = within(screen.getByRole("dialog"));
    const url = dialog.getByLabelText("Ziel-URL", { exact: false });
    expect(url).toHaveValue("https://example.test/benefit");
    await user.clear(url);
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    await screen.findByText("Benefit wurde gespeichert.");
    expect(mocks.update).toHaveBeenCalledWith(benefit.id, {
      title: benefit.title, description: benefit.description, details: benefit.details, url: null,
    });
    expect(screen.queryByRole("link", { name: /Angebot öffnen/ })).not.toBeInTheDocument();
  });

  it.each(["javascript:alert(1)", "https://user:password@example.test", "not-a-url"])("rejects unsafe or invalid URLs before saving: %s", async (value) => {
    mocks.role = "user";
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: `${benefit.title} bearbeiten` }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Ziel-URL", { exact: false }), value);
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Bitte gib eine HTTP-/HTTPS-URL ohne Zugangsdaten oder mailto: mit einer einzelnen E-Mail-Adresse ohne Zusatzparameter an (maximal 2048 Zeichen).")).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
