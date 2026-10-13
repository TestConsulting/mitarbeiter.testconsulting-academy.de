import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
} from "@fluentui/react-components";
import { Dismiss20Regular, LockClosed20Regular, ContactCard24Regular, Shield24Regular } from "@fluentui/react-icons";
import { ApiError, api } from "../api/client.js";
import { useAuth } from "../app/auth-context.js";

export function ProfilePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeSection = searchParams.get("section");
  const showPersonal = !activeSection || activeSection === "personal";
  const showSecurity = !activeSection || activeSection === "security";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [firstName = "", ...lastNameParts] = (user?.name ?? "").trim().split(/\s+/);
  const lastName = lastNameParts.join(" ");

  function openPasswordDialog() {
    setNotice("");
    setError("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    if (submitting) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setIsDialogOpen(false);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }

    setSubmitting(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setIsDialogOpen(false);
      setNotice("Dein Passwort wurde geändert.");
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="profile-page">
      <div className="page-heading">
        <h1>Mein Profil</h1>
      </div>
      <p className="profile-intro">Persönliche Kontodaten und Sicherheitseinstellungen.</p>

      {activeSection && (
        <div className="profile-section-hint">
          <span>
            Bereich: <strong>{activeSection === "personal" ? "Persönliche Daten" : "Sicherheit"}</strong>
          </span>
          <Link to="/profile" className="profile-section-hint__all">
            Alle Bereiche anzeigen
          </Link>
        </div>
      )}

      {showPersonal && (
        <section className="profile-card" aria-labelledby="profile-personal-heading">
          <div className="profile-card__heading">
            <h2 id="profile-personal-heading">
              <ContactCard24Regular aria-hidden="true" />
              Persönliche Daten
            </h2>
          </div>
          <dl className="profile-details">
            <div>
              <dt>Vorname</dt>
              <dd>{firstName || "—"}</dd>
            </div>
            <div>
              <dt>Nachname</dt>
              <dd>{lastName || "—"}</dd>
            </div>
            <div>
              <dt>E-Mail-Adresse</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Rolle</dt>
              <dd>
                <span className={`role-badge${user?.role === "employee" ? " role-badge--employee" : ""}`}>
                  {user?.role === "employee" ? "Mitarbeiter" : "Admin"}
                </span>
              </dd>
            </div>
          </dl>
        </section>
      )}

      {showSecurity && (
        <section className="profile-card" aria-labelledby="profile-security-heading">
          <div className="profile-card__heading">
            <div>
              <h2 id="profile-security-heading">
                <Shield24Regular aria-hidden="true" />
                Sicherheit
              </h2>
              <p>Wähle ein neues Passwort mit mindestens 12 Zeichen.</p>
            </div>
          </div>
          {notice && <p className="profile-notice" role="status">{notice}</p>}
          <div className="profile-password-row">
            <div className="profile-password-display">
              <span className="profile-password-display__label">Passwort</span>
              <span className="profile-password-display__dots">••••••••</span>
            </div>
            <Button
              appearance="primary"
              onClick={openPasswordDialog}
            >
              Passwort ändern
            </Button>
          </div>
        </section>
      )}

      <Dialog
        modalType="modal"
        open={isDialogOpen}
        onOpenChange={(_event, data) => {
          if (!data.open && !submitting) {
            handleCloseDialog();
          }
        }}
      >
        <DialogSurface>
          <form onSubmit={changePassword}>
            <DialogBody>
              <DialogTitle
                action={
                  <Button
                    appearance="subtle"
                    aria-label="Schließen"
                    icon={<Dismiss20Regular />}
                    onClick={handleCloseDialog}
                    disabled={submitting}
                  />
                }
              >
                Passwort ändern
              </DialogTitle>
              <DialogContent className="password-dialog-content">
                {error && (
                  <MessageBar intent="error">
                    <MessageBarBody>{error}</MessageBarBody>
                  </MessageBar>
                )}
                <Field label="Aktuelles Passwort" required>
                  <Input
                    type="password"
                    name="currentPassword"
                    aria-label="Aktuelles Passwort"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(_event, data) => setCurrentPassword(data.value)}
                    required
                    disabled={submitting}
                    autoFocus
                  />
                </Field>
                <Field label="Neues Passwort" required>
                  <Input
                    type="password"
                    name="newPassword"
                    aria-label="Neues Passwort"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={1024}
                    value={newPassword}
                    onChange={(_event, data) => setNewPassword(data.value)}
                    required
                    disabled={submitting}
                  />
                </Field>
                <Field label="Neues Passwort bestätigen" required>
                  <Input
                    type="password"
                    name="confirmPassword"
                    aria-label="Neues Passwort bestätigen"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={1024}
                    value={confirmPassword}
                    onChange={(_event, data) => setConfirmPassword(data.value)}
                    required
                    disabled={submitting}
                  />
                </Field>
              </DialogContent>
              <DialogActions>
                <Button
                  appearance="secondary"
                  type="button"
                  onClick={handleCloseDialog}
                  disabled={submitting}
                >
                  Abbrechen
                </Button>
                <Button
                  appearance="primary"
                  type="submit"
                  icon={<LockClosed20Regular />}
                  disabled={submitting}
                >
                  {submitting ? "Passwort wird geändert …" : "Passwort ändern"}
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
