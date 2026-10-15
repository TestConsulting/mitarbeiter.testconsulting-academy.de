import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  Select,
} from "@fluentui/react-components";
import { PeopleTeam24Regular } from "@fluentui/react-icons";
import type { PortalUser } from "@portal/shared";
import { ApiError, api } from "../api/client.js";
import { useAuth } from "../app/auth-context.js";

type Role = "employee" | "admin";

type UserFormState = {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  password: string;
};

const emptyForm: UserFormState = {
  email: "",
  firstName: "",
  lastName: "",
  role: "employee",
  password: "",
};

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const [firstName = "", ...lastNameParts] = fullName.trim().split(/\s+/);
  return {
    firstName,
    lastName: lastNameParts.join(" "),
  };
}

function combineFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim();
}

export function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");
  const [createForm, setCreateForm] = useState<UserFormState>(emptyForm);
  const [editingUser, setEditingUser] = useState<PortalUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<PortalUser | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.users.list()
      .then((list) => {
        if (!active) return;
        setUsers(list);
        setStatus("ready");
      })
      .catch(() => {
        if (active) {
          setError("Benutzer konnten nicht geladen werden.");
          setStatus("error");
        }
      });
    return () => { active = false; };
  }, []);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.name.localeCompare(b.name, "de")), [users]);

  function getApiErrorMessage(failure: unknown, fallback: string): string {
    if (failure instanceof ApiError) return failure.message;
    return fallback;
  }

  if (user?.role !== "admin") {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <h1><PeopleTeam24Regular aria-hidden="true" /> Benutzerverwaltung</h1>
        </div>
        <section className="empty-state">
          <h2>Keine Berechtigung</h2>
          <p>Dieser Bereich ist nur für Administratoren verfügbar.</p>
        </section>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <h1><PeopleTeam24Regular aria-hidden="true" /> Benutzerverwaltung</h1>
        </div>
        <p>Benutzer werden geladen …</p>
      </div>
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const created = await api.users.create({
        email: createForm.email.trim(),
        name: combineFullName(createForm.firstName, createForm.lastName),
        role: createForm.role,
        password: createForm.password,
      });
      setUsers((current) => [...current, created]);
      setCreateForm(emptyForm);
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Benutzer konnte nicht angelegt werden."));
    } finally {
      setBusy(false);
    }
  }

  function openEditForm(target: PortalUser) {
    const splitName = splitFullName(target.name);
    setError("");
    setEditingUser(target);
    setEditForm({
      email: target.email,
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      role: target.role === "admin" ? "admin" : "employee",
      password: "",
    });
  }

  async function handleUpdate(event: FormEvent) {
    event.preventDefault();
    if (!editingUser) return;
    setError("");
    setBusy(true);
    try {
      const updated = await api.users.update(editingUser.id, {
        email: editForm.email.trim(),
        name: combineFullName(editForm.firstName, editForm.lastName),
        role: editForm.role,
        password: editForm.password.trim() ? editForm.password : undefined,
      });
      setUsers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setEditingUser(null);
      setEditForm(emptyForm);
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Benutzer konnte nicht gespeichert werden."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setError("");
    setBusy(true);
    try {
      await api.users.delete(id);
      setUsers((current) => current.filter((entry) => entry.id !== id));
      if (editingUser?.id === id) {
        setEditingUser(null);
        setEditForm(emptyForm);
      }
      return true;
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Benutzer konnte nicht gelöscht werden."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack admin-users-page">
      <div className="page-heading">
        <h1><PeopleTeam24Regular aria-hidden="true" /> Benutzerverwaltung</h1>
      </div>

      {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}

      <section className="panel admin-users-panel">
        <h2>Benutzer anlegen</h2>
        <form className="admin-users-form" onSubmit={handleCreate}>
          <Field label="Vorname" required>
            <Input value={createForm.firstName} onChange={(_event, data) => setCreateForm((current) => ({ ...current, firstName: data.value }))} />
          </Field>
          <Field label="Nachname" required>
            <Input value={createForm.lastName} onChange={(_event, data) => setCreateForm((current) => ({ ...current, lastName: data.value }))} />
          </Field>
          <Field label="E-Mail" required>
            <Input
              type="email"
              value={createForm.email}
              onChange={(_event, data) => setCreateForm((current) => ({ ...current, email: data.value }))}
            />
          </Field>
          <Field label="Rolle" required>
            <Select
              value={createForm.role}
              onChange={(_event, data) => setCreateForm((current) => ({ ...current, role: data.value as Role }))}
            >
              <option value="employee">Mitarbeiter</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label="Startpasswort (mind. 12 Zeichen)" required>
            <Input
              type="password"
              value={createForm.password}
              onChange={(_event, data) => setCreateForm((current) => ({ ...current, password: data.value }))}
            />
          </Field>
          <Button appearance="primary" type="submit" disabled={busy}>Benutzer anlegen</Button>
        </form>
      </section>

      <section className="panel admin-users-panel">
        <h2>Bestehende Benutzer</h2>
        <ul className="admin-users-list">
          {sortedUsers.map((entry) => (
            <li key={entry.id} className="admin-users-list__item">
              <div>
                <strong>{entry.name}</strong>
                <p>{entry.email}</p>
                <p>{entry.role === "admin" ? "Admin" : "Mitarbeiter"}</p>
              </div>
              <div className="admin-users-list__actions">
                <Button appearance="secondary" size="small" onClick={() => openEditForm(entry)} disabled={busy}>Bearbeiten</Button>
                <Button
                  appearance="subtle"
                  size="small"
                  onClick={() => { setError(""); setDeletingUser(entry); }}
                  disabled={busy || entry.id === user.id}
                >
                  Löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={editingUser !== null} onOpenChange={(_event, data) => { if (!data.open) setEditingUser(null); }}>
        <DialogSurface>
          <form
            onSubmit={async (event) => {
              await handleUpdate(event);
            }}
          >
            <DialogBody>
              <DialogTitle>Benutzer bearbeiten</DialogTitle>
              <DialogContent className="admin-users-form admin-users-form--edit">
                <Field label="Vorname" required>
                  <Input value={editForm.firstName} onChange={(_event, data) => setEditForm((current) => ({ ...current, firstName: data.value }))} autoFocus />
                </Field>
                <Field label="Nachname" required>
                  <Input value={editForm.lastName} onChange={(_event, data) => setEditForm((current) => ({ ...current, lastName: data.value }))} />
                </Field>
                <Field label="E-Mail" required>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(_event, data) => setEditForm((current) => ({ ...current, email: data.value }))}
                  />
                </Field>
                <Field label="Rolle" required>
                  <Select
                    value={editForm.role}
                    onChange={(_event, data) => setEditForm((current) => ({ ...current, role: data.value as Role }))}
                  >
                    <option value="employee">Mitarbeiter</option>
                    <option value="admin">Admin</option>
                  </Select>
                </Field>
                <Field label="Neues Passwort (optional)">
                  <Input
                    type="password"
                    value={editForm.password}
                    onChange={(_event, data) => setEditForm((current) => ({ ...current, password: data.value }))}
                  />
                </Field>
              </DialogContent>
              <DialogActions>
                <Button appearance="secondary" type="button" onClick={() => setEditingUser(null)} disabled={busy}>Abbrechen</Button>
                <Button appearance="primary" type="submit" disabled={busy}>Speichern</Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>

      <Dialog open={deletingUser !== null} onOpenChange={(_event, data) => { if (!data.open) setDeletingUser(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Benutzer löschen?</DialogTitle>
            <DialogContent>
              {deletingUser ? `Möchtest du das Konto ${deletingUser.email} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.` : "Diese Aktion kann nicht rückgängig gemacht werden."}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" type="button" onClick={() => setDeletingUser(null)} disabled={busy}>Abbrechen</Button>
              <Button
                className="admin-users-delete-button"
                appearance="primary"
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!deletingUser) return;
                  const success = await handleDelete(deletingUser.id);
                  if (success) setDeletingUser(null);
                }}
              >
                Löschen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
