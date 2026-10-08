import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Textarea,
} from "@fluentui/react-components";
import { Add20Regular, Delete16Regular, Edit16Regular } from "@fluentui/react-icons";
import { useEffect, useState, type FormEvent } from "react";
import type { Benefit, BenefitInput } from "@portal/shared";
import { canManagePortal, isValidAppLinkUrl, normalizeAppLinkUrl } from "@portal/shared";
import { ApiError, api } from "../api/client.js";
import { useAuth } from "../app/auth-context.js";

type Props = {
  benefit?: Benefit;
  onSaved: (benefit: Benefit) => void;
  onDeleted?: (id: string) => void;
  disabled?: boolean;
  onInteractionChange?: (active: boolean) => void;
};
const emptyDraft: BenefitInput = { title: "", description: "", details: "", url: "" };

export function BenefitActions({ benefit, onSaved, onDeleted, disabled = false, onInteractionChange }: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<BenefitInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (draft !== null || confirmDelete || busy) {
      onInteractionChange?.(true);
      return () => onInteractionChange?.(false);
    }
  }, [draft, confirmDelete, busy, onInteractionChange]);
  if (!canManagePortal(user)) return null;

  function openEditor() {
    setError("");
    setDraft(benefit ? { title: benefit.title, description: benefit.description, details: benefit.details, url: benefit.url ?? "" } : { ...emptyDraft });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || busy || disabled) return;
    const input = {
      title: draft.title.trim(), description: draft.description.trim(), details: draft.details.trim(),
      url: draft.url?.trim() ? normalizeAppLinkUrl(draft.url) : null,
    };
    if (!input.title || !input.description || !input.details ||
        input.title.length > 120 || input.description.length > 500 || input.details.length > 5000) {
      setError("Bitte fülle Titel, Kurzbeschreibung und Details aus (maximal 120, 500 und 5000 Zeichen).");
      return;
    }
    if (input.url && !isValidAppLinkUrl(input.url)) {
      setError("Bitte gib eine HTTP-/HTTPS-URL ohne Zugangsdaten oder mailto: mit einer einzelnen E-Mail-Adresse ohne Zusatzparameter an (maximal 2048 Zeichen).");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const saved = benefit ? await api.benefits.update(benefit.id, input) : await api.benefits.create(input);
      setDraft(null);
      onSaved(saved);
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "Der Benefit konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!benefit || busy || disabled) return;
    setError("");
    setBusy(true);
    try {
      await api.benefits.delete(benefit.id);
      setConfirmDelete(false);
      onDeleted?.(benefit.id);
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "Der Benefit konnte nicht gelöscht werden. Bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {benefit ? (
        <>
          <Button icon={<Edit16Regular />} aria-label={`${benefit.title} bearbeiten`} disabled={busy || disabled} onClick={openEditor} />
          {onDeleted && <Button icon={<Delete16Regular />} aria-label={`${benefit.title} löschen`} disabled={busy || disabled}
            onClick={() => { setError(""); setConfirmDelete(true); }} />}
        </>
      ) : (
        <Button appearance="primary" icon={<Add20Regular />} disabled={busy || disabled} onClick={openEditor}>Benefit hinzufügen</Button>
      )}
      <Dialog open={draft !== null} onOpenChange={(_event, data) => { if (!data.open && !busy) setDraft(null); }}>
        <DialogSurface>
          <form onSubmit={save}>
            <DialogBody>
              <DialogTitle>{benefit ? "Benefit bearbeiten" : "Benefit hinzufügen"}</DialogTitle>
              <DialogContent className="benefit-form">
                {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
                <Field label="Titel" required>
                  <Input value={draft?.title ?? ""} required maxLength={120} disabled={busy}
                    onChange={(_event, data) => setDraft((current) => current && { ...current, title: data.value })} />
                </Field>
                <Field label="Kurzbeschreibung" hint="Wird auf der Karte angezeigt. Maximal 500 Zeichen." required>
                  <Textarea value={draft?.description ?? ""} required maxLength={500} disabled={busy}
                    onChange={(_event, data) => setDraft((current) => current && { ...current, description: data.value })} />
                </Field>
                <Field label="Details" hint="Informationen, Bedingungen und Kontakt für die Detailseite. Text, kein HTML. Maximal 5000 Zeichen." required>
                  <Textarea value={draft?.details ?? ""} required maxLength={5000} rows={8} disabled={busy}
                    onChange={(_event, data) => setDraft((current) => current && { ...current, details: data.value })} />
                </Field>
                <Field label="Ziel-URL" hint="Optional. HTTP, HTTPS, www. oder mailto:name@firma.de ohne Zusatzparameter, maximal 2048 Zeichen.">
                  <Input value={draft?.url ?? ""} maxLength={2048} disabled={busy}
                    onChange={(_event, data) => setDraft((current) => current && { ...current, url: data.value })} />
                </Field>
              </DialogContent>
              <DialogActions>
                <Button disabled={busy} onClick={() => setDraft(null)}>Abbrechen</Button>
                <Button type="submit" appearance="primary" disabled={busy}>{busy ? "Speichert …" : "Speichern"}</Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
      <Dialog open={confirmDelete} onOpenChange={(_event, data) => { if (!data.open && !busy) setConfirmDelete(false); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Benefit löschen?</DialogTitle>
            <DialogContent>
              {error && <MessageBar intent="error"><MessageBarBody>{error}</MessageBarBody></MessageBar>}
              <p>„{benefit?.title}“ wird für alle Mitarbeitenden entfernt. Diese Aktion kann nicht rückgängig gemacht werden.</p>
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={() => setConfirmDelete(false)}>Abbrechen</Button>
              <Button appearance="primary" disabled={busy} onClick={remove}>{busy ? "Löscht …" : "Löschen"}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
