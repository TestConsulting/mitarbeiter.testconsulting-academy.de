import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import { ProfilePage } from "./profile-page.js";

const mocks = vi.hoisted(() => ({
  user: {
    id: "user-1",
    email: "max.mustermann@example.test",
    name: "Max Mustermann",
    role: "employee" as const,
  },
  changePassword: vi.fn(),
}));

vi.mock("../app/auth-context.js", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("../api/client.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/client.js")>();
  return {
    ...original,
    api: {
      auth: {
        changePassword: mocks.changePassword,
      },
    },
  };
});

function renderPage(initialEntries = ["/profile"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <FluentProvider theme={webLightTheme}>
        <ProfilePage />
      </FluentProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.changePassword.mockResolvedValue({ success: true });
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

describe("ProfilePage - password change section", () => {
  it("renders the 'Persönliche Daten' section heading with personal details", () => {
    renderPage();

    const personalHeading = screen.getByRole("heading", { name: "Persönliche Daten" });
    const personalSection = personalHeading.closest("section");
    expect(personalSection).not.toBeNull();
    expect(within(personalSection!).getByText("Vorname")).toBeInTheDocument();
    expect(within(personalSection!).getByText("Max")).toBeInTheDocument();
    expect(within(personalSection!).getByText("Nachname")).toBeInTheDocument();
    expect(within(personalSection!).getByText("Mustermann")).toBeInTheDocument();
  });

  it("renders a row with 'Passwort' label, static bullet placeholder '••••••••' without input frame, and 'Passwort ändern' button under the 'Sicherheit' section heading", () => {
    renderPage();

    const securityHeading = screen.getByRole("heading", { name: "Sicherheit" });
    const securitySection = securityHeading.closest("section");
    expect(securitySection).not.toBeNull();

    expect(within(securitySection!).getByText("Passwort")).toBeInTheDocument();
    expect(within(securitySection!).getByText("••••••••")).toBeInTheDocument();
    expect(within(securitySection!).queryByRole("textbox", { name: "Passwort" })).not.toBeInTheDocument();

    const changeButton = within(securitySection!).getByRole("button", { name: "Passwort ändern" });
    expect(changeButton).toBeInTheDocument();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the modal with the required fields, close icon, and cancel button", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Passwort ändern" })).toBeInTheDocument();

    expect(within(dialog).getByLabelText("Aktuelles Passwort")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Neues Passwort")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Neues Passwort bestätigen")).toBeInTheDocument();

    expect(within(dialog).getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Schließen" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Passwort ändern" })).toBeInTheDocument();
  });

  it("closes the modal and empties inputs when clicking 'Abbrechen'", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Aktuelles Passwort"), { target: { value: "old-pw-123" } });
    fireEvent.change(within(dialog).getByLabelText("Neues Passwort"), { target: { value: "new-pw-123456" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Reopen to verify fields were cleared
    const changeButton = await screen.findByRole("button", { name: "Passwort ändern" });
    fireEvent.click(changeButton);
    const reopenedDialog = await screen.findByRole("dialog");
    expect(within(reopenedDialog).getByLabelText("Aktuelles Passwort")).toHaveValue("");
    expect(within(reopenedDialog).getByLabelText("Neues Passwort")).toHaveValue("");
    expect(within(reopenedDialog).getByLabelText("Neues Passwort bestätigen")).toHaveValue("");
  });

  it("closes the modal and empties inputs when clicking the close button", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Aktuelles Passwort"), { target: { value: "old-pw-123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Schließen" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const changeButton = await screen.findByRole("button", { name: "Passwort ändern" });
    fireEvent.click(changeButton);
    const reopenedDialog = await screen.findByRole("dialog");
    expect(within(reopenedDialog).getByLabelText("Aktuelles Passwort")).toHaveValue("");
  });

  it("closes the modal and empties inputs when pressing Escape", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Aktuelles Passwort"), { target: { value: "old-pw-123" } });
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const changeButton = await screen.findByRole("button", { name: "Passwort ändern" });
    fireEvent.click(changeButton);
    const reopenedDialog = await screen.findByRole("dialog");
    expect(within(reopenedDialog).getByLabelText("Aktuelles Passwort")).toHaveValue("");
  });

  it("displays validation error directly inside the popup when passwords do not match", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Aktuelles Passwort"), { target: { value: "old-pw-123456" } });
    fireEvent.change(within(dialog).getByLabelText("Neues Passwort"), { target: { value: "new-pw-123456" } });
    fireEvent.change(within(dialog).getByLabelText("Neues Passwort bestätigen"), { target: { value: "different-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Passwort ändern" }));

    expect(within(dialog).getByText("Die neuen Passwörter stimmen nicht überein.")).toBeInTheDocument();
    expect(mocks.changePassword).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("displays API error directly inside the popup", async () => {
    mocks.changePassword.mockRejectedValue(new ApiError("Das aktuelle Passwort ist falsch.", 400));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Aktuelles Passwort"), { target: { value: "wrong-password" } });
    fireEvent.change(within(dialog).getByLabelText("Neues Passwort"), { target: { value: "new-pw-123456" } });
    fireEvent.change(within(dialog).getByLabelText("Neues Passwort bestätigen"), { target: { value: "new-pw-123456" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Passwort ändern" }));

    expect(await within(dialog).findByText("Das aktuelle Passwort ist falsch.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the modal and displays success notice after successful password change", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Aktuelles Passwort"), { target: { value: "valid-current-pw" } });
    fireEvent.change(within(dialog).getByLabelText("Neues Passwort"), { target: { value: "new-valid-pw-123" } });
    fireEvent.change(within(dialog).getByLabelText("Neues Passwort bestätigen"), { target: { value: "new-valid-pw-123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Passwort ändern" }));

    await waitFor(() => {
      expect(mocks.changePassword).toHaveBeenCalledWith("valid-current-pw", "new-valid-pw-123", "new-valid-pw-123");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Dein Passwort wurde geändert.");
  });

  it("filters to only personal details when section=personal is set", () => {
    renderPage(["/profile?section=personal"]);

    expect(screen.getByRole("heading", { name: /Persönliche Daten/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Sicherheit/i })).not.toBeInTheDocument();
    expect(screen.getByText("Bereich:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alle Bereiche anzeigen" })).toBeInTheDocument();
  });

  it("filters to only security section when section=security is set", () => {
    renderPage(["/profile?section=security"]);

    expect(screen.queryByRole("heading", { name: /Persönliche Daten/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sicherheit/i })).toBeInTheDocument();
    expect(screen.getByText("Bereich:")).toBeInTheDocument();
  });
});
