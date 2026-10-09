import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppLink } from "@portal/shared";
import { ApiError } from "../api/client.js";
import { ApplicationLinksPage } from "./application-links-page.js";

const mocks = vi.hoisted(() => ({
  role: "employee" as "employee" | "admin" | "user",
  list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), reorder: vi.fn(),
}));

vi.mock("../app/auth-context.js", () => ({
  useAuth: () => ({ user: { role: mocks.role } }),
}));
vi.mock("../api/client.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/client.js")>(),
  api: { links: mocks },
}));

const link: AppLink = { id: "link-1", name: "Microsoft 365", description: "Outlook, Teams, OneDrive", icon: "M365", url: "https://www.microsoft365.com/", sortOrder: 0 };

function renderPage() {
  return render(<FluentProvider theme={webLightTheme}><MemoryRouter><ApplicationLinksPage /></MemoryRouter></FluentProvider>);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.role = "employee";
  mocks.list.mockResolvedValue([link]);
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("application links page", () => {
  it("renders email links with an envelope and no new tab", async () => {
    mocks.list.mockResolvedValue([{ ...link, name: "Backoffice", url: "mailto:backoffice@testconsulting.de" }]);
    renderPage();
    const action = await screen.findByRole("link", { name: "Backoffice: E-Mail schreiben" });
    expect(action).toHaveAttribute("href", "mailto:backoffice@testconsulting.de");
    expect(action).not.toHaveAttribute("target");
    expect(screen.getByRole("article", { name: "Backoffice" }).querySelector(".application-link-card__icon svg")).toBeInTheDocument();
  });

  it.each([
    ["Outlook", "/images/outlook.png"],
    ["Timebutler", "/images/timebutler.jpeg"],
    ["Confluence", "/images/confluence.jpg"],
    ["DATEV", "/images/datev.png"],
    ["DATEV - Arbeitnehmer online", "/images/datev.png"],
    ["Microsoft 365", "/images/m365.png"],
    ["Jenkins", "/images/jenkins-icon.png"],
    ["GitHub", "/images/github.png"],
    ["GitLab", "/images/gitlab.ico"],
    ["Git", "/images/git.png"],
  ])("renders the supplied %s logo without changing other application icons", async (name, source) => {
    const genericLink = { ...link, name: "Team Wiki" };
    mocks.list.mockResolvedValue([genericLink, { ...link, id: "logo-link", name, sortOrder: 1 }]);
    renderPage();
    const tile = await screen.findByRole("article", { name });
    const image = tile.querySelector(".application-link-icon--image img");
    expect(image).toHaveAttribute("src", source);
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("draggable", "false");
    expect(screen.getByRole("article", { name: genericLink.name }).querySelector(".application-link-card__icon svg")).toBeInTheDocument();
  });

  it.each(["employee", "admin"] as const)("opens details from the tile surface for %s without editing or dragging", async (role) => {
    mocks.role = role;
    const description = "Vollständige Beschreibung. ".repeat(15);
    mocks.list.mockResolvedValue([{ ...link, description }]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("article"));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(description.trim())).toBeInTheDocument();
    expect(dialog.getByRole("link", { name: link.url })).toHaveAttribute("href", link.url);
    expect(dialog.getByRole("link", { name: "Öffnen" })).toHaveAttribute("target", "_blank");
    expect(dialog.getByRole("button", { name: "Popup schließen" })).toBeInTheDocument();
    expect(dialog.getByRole("heading", { name: "Beschreibung" })).toBeInTheDocument();
    expect(mocks.reorder).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    await user.click(dialog.getByRole("button", { name: "Schließen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the description out of the tile", async () => {
    renderPage();
    await screen.findByRole("link", { name: /Microsoft 365/ });
    expect(screen.queryByRole("button", { name: /mehr anzeigen/ })).not.toBeInTheDocument();
    expect(screen.queryByText(link.description)).not.toBeInTheDocument();
  });

  it.each(["employee", "admin"] as const)("opens details with Enter for %s", async (role) => {
    mocks.role = role;
    const user = userEvent.setup();
    renderPage();
    const card = await screen.findByRole("article");
    card.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText(link.description)).toBeInTheDocument();
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("does not open details after dragging on the tile surface", async () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    renderPage();
    const card = await screen.findByRole("article");
    fireEvent.pointerDown(card, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: 20, clientY: 0 });
    fireEvent.click(card);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open details when the external link is clicked", async () => {
    renderPage();
    const action = await screen.findByRole("link", { name: /Microsoft 365/ });
    fireEvent.click(action);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders external link tiles without management controls for employees", async () => {
    renderPage();
    const tile = await screen.findByRole("link", { name: /Microsoft 365/ });
    expect(tile).toHaveAttribute("href", link.url);
    expect(tile).toHaveAttribute("target", "_blank");
    expect(tile).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByText(link.description)).not.toBeInTheDocument();
    expect(screen.queryByText("M365")).not.toBeInTheDocument();
    expect(tile.closest("article")?.querySelector(".application-link-card__icon")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link hinzufügen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bearbeiten|löschen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /verschieben/i })).not.toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveAttribute("tabindex", "0");
  });

  it("renders an explicit empty state", async () => {
    mocks.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Noch keine Application Links vorhanden.")).toBeInTheDocument();
  });

  it.each([false, true])("reorders with the keyboard and handles save failure (%s)", async (fails) => {
    mocks.role = "admin";
    const second = { ...link, id: "link-2", name: "Wiki", url: "https://wiki.example.test/", sortOrder: 5 };
    mocks.list.mockResolvedValue([link, second]);
    if (fails) mocks.reorder.mockRejectedValue(new Error("Offline"));
    else mocks.reorder.mockResolvedValue([{ ...second, sortOrder: 0 }, { ...link, sortOrder: 1 }]);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const index = this.matches("article") ? Array.from(this.parentElement!.children).indexOf(this) : 0;
      return { x: index * 300, y: 0, left: index * 300, top: 0, right: index * 300 + 260, bottom: 200, width: 260, height: 200, toJSON: () => ({}) };
    });
    const user = userEvent.setup();
    renderPage();
    const handle = await screen.findByRole("article", { name: "Microsoft 365 verschieben" });
    expect(screen.queryByRole("button", { name: /verschieben/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Reihenfolge:/)).not.toBeInTheDocument();
    handle.focus();
    await user.keyboard(" {ArrowRight} ");
    expect(mocks.reorder).toHaveBeenCalledWith([second.id, link.id]);
    if (fails) {
      expect(await screen.findByText("Die Reihenfolge konnte nicht gespeichert werden. Bitte versuche es erneut.")).toBeInTheDocument();
      expect(screen.getAllByRole("link").map((tile) => tile.getAttribute("href"))).toEqual([link.url, second.url]);
    } else {
      expect(await screen.findByText("Reihenfolge wurde für alle Mitarbeitenden gespeichert.")).toBeInTheDocument();
      expect(screen.getAllByRole("link").map((tile) => tile.getAttribute("href"))).toEqual([second.url, link.url]);
    }
  });

  it("does not start keyboard dragging from edit controls", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    renderPage();
    const edit = await screen.findByRole("button", { name: "Microsoft 365 bearbeiten" });
    await waitFor(() => expect(screen.getByRole("article")).toHaveAttribute("tabindex", "0"));
    edit.focus();
    await user.keyboard(" ");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("shows loading and allows retry after a failed load", async () => {
    mocks.list.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue([link]);
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(await screen.findByText("Application Links konnten nicht geladen werden.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(await screen.findByRole("link", { name: /Microsoft 365/ })).toBeInTheDocument();
  });

  it("lets admins create links without an abbreviation field and displays them in order", async () => {
    mocks.role = "admin";
    const created = { ...link, id: "link-2", name: "Wiki", description: "Teamwissen", icon: "W", url: "https://wiki.example.test/", sortOrder: 2 };
    mocks.create.mockResolvedValue(created);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Link hinzufügen" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Name", { exact: false }), created.name);
    await user.type(dialog.getByLabelText("Kurzbeschreibung", { exact: false }), created.description);
    expect(dialog.queryByLabelText("Kürzel")).not.toBeInTheDocument();
    await user.type(dialog.getByLabelText("Ziel-URL", { exact: false }), created.url);
    await user.clear(dialog.getByLabelText("Reihenfolge", { exact: false }));
    await user.type(dialog.getByLabelText("Reihenfolge", { exact: false }), "2");
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("link", { name: /Wiki/ })).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith({ name: created.name, description: created.description, icon: "App", url: created.url, sortOrder: 2 });
    expect(screen.getAllByRole("link").map((tile) => tile.getAttribute("href"))).toEqual([link.url, created.url]);
  });

  it.each(["admin", "user"] as const)("lets %s accounts edit and reorder an existing link", async (role) => {
    mocks.role = role;
    const second = { ...link, id: "link-2", name: "Wiki", url: "https://wiki.example.test/", sortOrder: 5 };
    mocks.list.mockResolvedValue([link, second]);
    mocks.update.mockResolvedValue({ ...link, name: "Office", sortOrder: 8 });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Microsoft 365 bearbeiten" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.clear(dialog.getByLabelText("Name", { exact: false }));
    await user.type(dialog.getByLabelText("Name", { exact: false }), "Office");
    await user.clear(dialog.getByLabelText("Reihenfolge", { exact: false }));
    await user.type(dialog.getByLabelText("Reihenfolge", { exact: false }), "8");
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("link", { name: /Office/ })).toBeInTheDocument();
    expect(mocks.update).toHaveBeenCalledWith(link.id, { name: "Office", description: link.description, icon: link.icon, url: link.url, sortOrder: 8 });
    expect(screen.getAllByRole("link").map((tile) => tile.getAttribute("href"))).toEqual([second.url, link.url]);
  });

  it("lets admins replace a description at the 500-character limit", async () => {
    mocks.role = "admin";
    mocks.list.mockResolvedValue([{ ...link, description: "x".repeat(500) }]);
    const description = "Outlook, Teams und OneDrive an einem Ort.";
    mocks.update.mockResolvedValue({ ...link, description });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Microsoft 365 bearbeiten" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/500\/500 Zeichen/)).toBeInTheDocument();
    const field = dialog.getByLabelText("Kurzbeschreibung", { exact: false });
    await user.clear(field);
    await user.type(field, description);
    expect(dialog.getByText(new RegExp(`${description.length}/500 Zeichen`))).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(mocks.update).toHaveBeenCalledWith(link.id, expect.objectContaining({ description }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(await screen.findByRole("article"));
    expect(await screen.findByText(description)).toBeInTheDocument();
  });

  it.each([0, 1])("moves an edited tile to position %s even when stored orders collide", async (position) => {
    mocks.role = "admin";
    const second = { ...link, id: "link-2", name: "Wiki", url: "https://wiki.example.test/", sortOrder: 0 };
    mocks.list.mockResolvedValue([link, second]);
    const edited = position === 0 ? second : link;
    mocks.update.mockResolvedValue({ ...edited, sortOrder: position });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: `${edited.name} bearbeiten` }));
    const dialog = within(screen.getByRole("dialog"));
    const order = dialog.getByLabelText("Reihenfolge", { exact: false });
    expect(order).toHaveValue(position === 0 ? 1 : 0);
    await user.clear(order);
    await user.type(order, String(position));
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByRole("link").map((tile) => tile.getAttribute("href"))).toEqual([second.url, link.url]));
    expect(mocks.update).toHaveBeenCalledWith(edited.id, expect.objectContaining({ sortOrder: position }));
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("requires confirmation before deleting a link", async () => {
    mocks.role = "admin";
    mocks.delete.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Microsoft 365 löschen" }));
    expect(mocks.delete).not.toHaveBeenCalled();
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(await screen.findByRole("button", { name: "Microsoft 365 löschen" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Löschen" }));
    expect(await screen.findByText("Noch keine Application Links vorhanden.")).toBeInTheDocument();
    expect(mocks.delete).toHaveBeenCalledWith(link.id);
  });

  it("keeps the form open and displays failed saves explicitly", async () => {
    mocks.role = "admin";
    mocks.update.mockRejectedValue(new ApiError("Bitte prüfe deine Eingaben.", 400));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Microsoft 365 bearbeiten" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Bitte prüfe deine Eingaben.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Abbrechen" }));
    expect(await screen.findByRole("link", { name: /Microsoft 365/ })).toBeInTheDocument();
  });

  it("keeps the link visible when deletion fails", async () => {
    mocks.role = "admin";
    mocks.delete.mockRejectedValue(new Error("Offline"));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Microsoft 365 löschen" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Löschen" }));
    expect(await screen.findByText("Der Link konnte nicht gelöscht werden. Bitte versuche es erneut.")).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Abbrechen" }));
    expect(await screen.findByRole("link", { name: /Microsoft 365/ })).toBeInTheDocument();
  });

  it("rejects URLs with unsafe protocols before calling the API", async () => {
    mocks.role = "admin";
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Microsoft 365 bearbeiten" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.clear(dialog.getByLabelText("Ziel-URL", { exact: false }));
    await user.type(dialog.getByLabelText("Ziel-URL", { exact: false }), "javascript:alert(1)");
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Bitte gib eine HTTP-/HTTPS-URL ohne Zugangsdaten an.")).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([
    ["create", "www.happytesting.de", "https://www.happytesting.de"],
    ["edit", "www.happytesting.de", "https://www.happytesting.de"],
    ["create", "mailto:backoffice@testconsulting.de", "mailto:backoffice@testconsulting.de"],
    ["edit", "mailto:backoffice@testconsulting.de", "mailto:backoffice@testconsulting.de"],
  ])("accepts supported addresses when admins %s links: %s", async (mode, url, expectedUrl) => {
    mocks.role = "admin";
    const saved = { ...link, url: expectedUrl };
    mocks.create.mockResolvedValue(saved);
    mocks.update.mockResolvedValue(saved);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", {
      name: mode === "create" ? "Link hinzufügen" : "Microsoft 365 bearbeiten",
    }));
    const dialog = within(screen.getByRole("dialog"));
    if (mode === "create") {
      await user.type(dialog.getByLabelText("Name", { exact: false }), link.name);
      await user.type(dialog.getByLabelText("Kurzbeschreibung", { exact: false }), link.description);
      expect(dialog.queryByLabelText("Kürzel")).not.toBeInTheDocument();
    }
    await user.clear(dialog.getByLabelText("Ziel-URL", { exact: false }));
    await user.type(dialog.getByLabelText("Ziel-URL", { exact: false }), url);
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("link", { name: /Microsoft 365/ })).toHaveAttribute("href", saved.url);
    const { id, ...expectedInput } = saved;
    if (mode === "create") expect(mocks.create).toHaveBeenCalledWith({ ...expectedInput, icon: "App" });
    else expect(mocks.update).toHaveBeenCalledWith(id, expectedInput);
  });
});
