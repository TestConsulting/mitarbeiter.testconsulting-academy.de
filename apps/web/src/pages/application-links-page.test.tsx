import { render, screen, waitFor, within } from "@testing-library/react";
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
  it.each(["employee", "admin"] as const)("opens full overflowing descriptions for %s without editing or dragging", async (role) => {
    mocks.role = role;
    const description = "Vollständige Beschreibung. ".repeat(15);
    mocks.list.mockResolvedValue([{ ...link, description }]);
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("application-link-card__summary") ? 200 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("application-link-card__summary") ? 44 : 0;
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Microsoft 365: mehr anzeigen" }));
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

  it("does not display more for a description that fits", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(22);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(22);
    renderPage();
    await screen.findByRole("link", { name: /Microsoft 365/ });
    expect(screen.queryByRole("button", { name: /mehr anzeigen/ })).not.toBeInTheDocument();
  });

  it("renders external link tiles without management controls for employees", async () => {
    renderPage();
    const tile = await screen.findByRole("link", { name: /Microsoft 365/ });
    expect(tile).toHaveAttribute("href", link.url);
    expect(tile).toHaveAttribute("target", "_blank");
    expect(tile).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText(link.description)).toBeInTheDocument();
    expect(screen.getByText("M365")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link hinzufügen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bearbeiten|löschen/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /verschieben/i })).not.toBeInTheDocument();
    expect(screen.getByRole("article")).not.toHaveAttribute("tabindex");
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

  it("lets admins create links with all fields and displays them in order", async () => {
    mocks.role = "admin";
    const created = { ...link, id: "link-2", name: "Wiki", description: "Teamwissen", icon: "W", url: "https://wiki.example.test/", sortOrder: 2 };
    mocks.create.mockResolvedValue(created);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Link hinzufügen" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Name", { exact: false }), created.name);
    await user.type(dialog.getByLabelText("Kurzbeschreibung", { exact: false }), created.description);
    await user.type(dialog.getByLabelText("Kürzel", { exact: false }), created.icon);
    await user.type(dialog.getByLabelText("Ziel-URL", { exact: false }), created.url);
    await user.clear(dialog.getByLabelText("Reihenfolge", { exact: false }));
    await user.type(dialog.getByLabelText("Reihenfolge", { exact: false }), "2");
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("link", { name: /Wiki/ })).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith({ name: created.name, description: created.description, icon: created.icon, url: created.url, sortOrder: 2 });
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

  it.each(["create", "edit"])("accepts www addresses when admins %s links", async (mode) => {
    mocks.role = "admin";
    const saved = { ...link, url: "https://www.happytesting.de" };
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
      await user.type(dialog.getByLabelText("Kürzel", { exact: false }), link.icon);
    }
    await user.clear(dialog.getByLabelText("Ziel-URL", { exact: false }));
    await user.type(dialog.getByLabelText("Ziel-URL", { exact: false }), "www.happytesting.de");
    await user.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("link", { name: /Microsoft 365/ })).toHaveAttribute("href", saved.url);
    const { id, ...expectedInput } = saved;
    if (mode === "create") expect(mocks.create).toHaveBeenCalledWith(expectedInput);
    else expect(mocks.update).toHaveBeenCalledWith(id, expectedInput);
  });
});
