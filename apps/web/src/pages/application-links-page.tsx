import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle,
  Field, Input, MessageBar, MessageBarBody, Textarea,
} from "@fluentui/react-components";
import { Add20Regular, ArrowUpRight20Regular, Delete16Regular, Dismiss20Regular, Edit16Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { AppLink, AppLinkInput } from "@portal/shared";
import { canManagePortal, normalizeAppLinkUrl } from "@portal/shared";
import { ApiError, api } from "../api/client.js";
import { AreaIcon } from "../app/area-icon.js";
import { useAuth } from "../app/auth-context.js";

type LinkDraft = Omit<AppLinkInput, "sortOrder"> & { id?: string; sortOrder: string };
const emptyDraft: LinkDraft = { name: "", description: "", icon: "", url: "", sortOrder: "0" };

function LinkDescription({ link, onMore }: { link: AppLink; onMore: () => void }) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const element = paragraph.current;
    if (!element) return;
    const measure = () => setTruncated(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    let active = true;
    void document.fonts?.ready.then(() => { if (active) measure(); });
    return () => { active = false; observer.disconnect(); };
  }, [link.description]);
  return (
    <div className="application-link-card__description">
      <p ref={paragraph} className="application-link-card__summary">{link.description}</p>
      {truncated && <button type="button" className="application-link-card__more"
        aria-label={`${link.name}: mehr anzeigen`} onClick={onMore}>…mehr</button>}
    </div>
  );
}

function SortableLinkCard({ link, isAdmin, disabled, children }: { link: AppLink; isAdmin: boolean; disabled: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id, disabled,
  });
  return (
    <article ref={setNodeRef}
      {...(isAdmin ? attributes : {})} role="article"
      tabIndex={isAdmin && !disabled ? 0 : undefined}
      aria-label={isAdmin ? `${link.name} verschieben` : link.name}
      className={`application-link-card${isAdmin && !disabled ? " application-link-card--sortable" : ""}${isDragging ? " application-link-card--dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onPointerDown={(event) => {
        if (disabled || !(event.target instanceof Element) || event.target.closest("a, button, input, textarea, select")) return;
        listeners?.onPointerDown?.(event);
      }}
      onKeyDown={(event) => {
        if (!disabled && event.target === event.currentTarget) listeners?.onKeyDown?.(event);
      }}>
      {children}
    </article>
  );
}

export function ApplicationLinksPage() {
  const { user } = useAuth();
  const isAdmin = canManagePortal(user);
  const [links, setLinks] = useState<AppLink[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [draft, setDraft] = useState<LinkDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppLink | null>(null);
  const [detailTarget, setDetailTarget] = useState<AppLink | null>(null);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reorderError, setReorderError] = useState("");
  const reorderPending = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let active = true;
    setStatus("loading");
    api.links.list().then((data) => {
      if (!active) return;
      setLinks(data);
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, [loadAttempt]);

  const sortedLinks = useMemo(
    () => [...links].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    [links],
  );

  function openEditor(link?: AppLink) {
    setActionError("");
    setNotice("");
    setDraft(link ? { ...link, sortOrder: String(sortedLinks.findIndex((current) => current.id === link.id)) } : { ...emptyDraft });
  }

  async function reorderLinks({ active, over }: DragEndEvent) {
    if (!isAdmin || busy || reorderPending.current || !over || active.id === over.id) return;
    const from = sortedLinks.findIndex((link) => link.id === active.id);
    const to = sortedLinks.findIndex((link) => link.id === over.id);
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(sortedLinks, from, to).map((link, sortOrder) => ({ ...link, sortOrder }));
    reorderPending.current = true;
    setBusy(true);
    setReorderError("");
    setNotice("");
    setLinks(reordered);
    try {
      setLinks(await api.links.reorder(reordered.map((link) => link.id)));
      setNotice("Reihenfolge wurde für alle Mitarbeitenden gespeichert.");
    } catch (error) {
      setLinks(sortedLinks);
      setReorderError(error instanceof ApiError ? error.message : "Die Reihenfolge konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      reorderPending.current = false;
      setBusy(false);
    }
  }

  async function saveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || busy) return;
    setActionError("");
    const sortOrder = Number(draft.sortOrder);
    const normalizedUrl = normalizeAppLinkUrl(draft.url);
    let url: URL;
    try {
      url = new URL(normalizedUrl);
    } catch {
      setActionError("Bitte gib eine gültige HTTP-/HTTPS-URL an.");
      return;
    }
    if (/^www\.?$/i.test(url.hostname)) {
      setActionError("Bitte gib eine vollständige Zieladresse an, zum Beispiel www.happytesting.de.");
      return;
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      setActionError("Bitte gib eine HTTP-/HTTPS-URL ohne Zugangsdaten an.");
      return;
    }
    if (normalizedUrl.length > 2048) {
      setActionError("Die Ziel-URL darf inklusive https:// maximal 2048 Zeichen lang sein.");
      return;
    }
    if (!draft.name.trim() || !draft.description.trim() || !draft.icon.trim() || !draft.sortOrder.trim() ||
        !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 2147483647) {
      setActionError("Bitte fülle alle Felder aus und gib eine nicht negative ganzzahlige Reihenfolge an.");
      return;
    }
    const input: AppLinkInput = {
      name: draft.name.trim(), description: draft.description.trim(), icon: draft.icon.trim(),
      url: normalizedUrl, sortOrder,
    };
    setBusy(true);
    try {
      const saved = draft.id ? await api.links.update(draft.id, input) : await api.links.create(input);
      setLinks((current) => {
        const ordered = [...current].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
        const remaining = ordered.filter((link) => link.id !== saved.id);
        remaining.splice(Math.min(saved.sortOrder, remaining.length), 0, saved);
        return remaining.map((link, sortOrder) => ({ ...link, sortOrder }));
      });
      setDraft(null);
      setNotice("Link wurde gespeichert.");
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Der Link konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLink() {
    if (!deleteTarget || busy) return;
    setActionError("");
    setBusy(true);
    try {
      await api.links.delete(deleteTarget.id);
      setLinks((current) => current.filter((link) => link.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice("Link wurde gelöscht.");
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Der Link konnte nicht gelöscht werden. Bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack application-links-page">
      <div className="page-heading">
        <h1><AreaIcon slug="applications" /> Application Links</h1>
        {isAdmin && status === "ready" && (
          <Button appearance="primary" icon={<Add20Regular />} disabled={busy} onClick={() => openEditor()}>Link hinzufügen</Button>
        )}
      </div>
      <p className="application-links-intro">Deine Unternehmenswerkzeuge auf einen Blick. Alle Links öffnen in einem neuen Tab.</p>
      {reorderError && <MessageBar intent="error"><MessageBarBody>{reorderError}</MessageBarBody></MessageBar>}
      {notice && <p role="status">{notice}</p>}
      {status === "loading" && <p role="status">Application Links werden geladen …</p>}
      {status === "error" && (
        <section className="empty-state" role="alert">
          <h2>Application Links konnten nicht geladen werden.</h2>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
        </section>
      )}
      {status === "ready" && sortedLinks.length === 0 && (
        <section className="empty-state">
          <span className="empty-state__icon"><AreaIcon slug="applications" large /></span>
          <h2>Noch keine Application Links vorhanden.</h2>
          <p>{isAdmin ? "Füge den ersten Link zu einem Unternehmenswerkzeug hinzu." : "Die Links werden von der Administration bereitgestellt."}</p>
        </section>
      )}
      {status === "ready" && sortedLinks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderLinks}>
        <SortableContext items={sortedLinks.map((link) => link.id)} strategy={rectSortingStrategy}>
        <div className="application-links-grid" aria-busy={busy}>
          {sortedLinks.map((link) => (
            <SortableLinkCard link={link} isAdmin={isAdmin} disabled={!isAdmin || busy || draft !== null || deleteTarget !== null || detailTarget !== null} key={link.id}>
              <div className="application-link-card__content">
                <span className="application-link-card__icon" aria-hidden="true">{link.icon}</span>
                <h2 title={link.name}>{link.name}</h2>
                <LinkDescription link={link} onMore={() => setDetailTarget(link)} />
                <a className="application-link-card__open" href={link.url} target="_blank" rel="noopener noreferrer"
                  draggable={false} aria-label={`${link.name} öffnen (neuer Tab)`}>
                  Öffnen <ArrowUpRight20Regular aria-hidden="true" /><span className="application-link-card__sr"> (neuer Tab)</span>
                </a>
              </div>
              {isAdmin && (
                <div className="application-link-card__actions">
                  <Button icon={<Edit16Regular />} disabled={busy} aria-label={`${link.name} bearbeiten`} onClick={() => openEditor(link)} />
                  <Button icon={<Delete16Regular />} disabled={busy} aria-label={`${link.name} löschen`} onClick={() => {
                    setActionError("");
                    setNotice("");
                    setDeleteTarget(link);
                  }} />
                </div>
              )}
            </SortableLinkCard>
          ))}
        </div>
        </SortableContext>
        </DndContext>
      )}
      <Dialog open={detailTarget !== null} onOpenChange={(_event, data) => { if (!data.open) setDetailTarget(null); }}>
        <DialogSurface className="application-link-detail" data-tone={sortedLinks.findIndex((link) => link.id === detailTarget?.id) % 4}>
          <DialogBody className="application-link-detail__body">
            <DialogTitle className="application-link-detail__heading" action={
              <Button className="application-link-detail__close" appearance="subtle" icon={<Dismiss20Regular />} aria-label="Popup schließen" onClick={() => setDetailTarget(null)} />
            }>
              <span className="application-link-detail__icon" aria-hidden="true">{detailTarget?.icon}</span>
              <span className="application-link-detail__title">{detailTarget?.name}</span>
            </DialogTitle>
            <DialogContent className="application-link-detail__content">
              <div className="application-link-detail__description-box">
                <h3 className="application-link-detail__label">Beschreibung</h3>
                <p className="application-link-detail__description">{detailTarget?.description}</p>
              </div>
              <div className="application-link-detail__destination">
                <span className="application-link-detail__label">Zieladresse</span>
                <a className="application-link-detail__url" href={detailTarget?.url} target="_blank" rel="noopener noreferrer">
                  {detailTarget?.url}
                </a>
              </div>
            </DialogContent>
            <DialogActions className="application-link-detail__actions">
              <span className="application-link-detail__hint">Öffnet in einem neuen Tab</span>
              <Button onClick={() => setDetailTarget(null)}>Schließen</Button>
              <Button as="a" href={detailTarget?.url} target="_blank" rel="noopener noreferrer" appearance="primary" icon={<ArrowUpRight20Regular />}>
                Öffnen
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Dialog open={draft !== null} onOpenChange={(_event, data) => { if (!data.open && !busy) setDraft(null); }}>
        <DialogSurface>
          <form onSubmit={saveLink}>
            <DialogBody>
              <DialogTitle>{draft?.id ? "Link bearbeiten" : "Link hinzufügen"}</DialogTitle>
              <DialogContent className="application-link-form">
                {actionError && <MessageBar intent="error"><MessageBarBody>{actionError}</MessageBarBody></MessageBar>}
                <Field label="Name" required>
                  <Input value={draft?.name ?? ""} required maxLength={120} disabled={busy}
                    onChange={(_event, data) => setDraft((current) => current && { ...current, name: data.value })} />
                </Field>
                <Field label="Kurzbeschreibung" required>
                  <Textarea value={draft?.description ?? ""} required maxLength={500} disabled={busy}
                    onChange={(_event, data) => setDraft((current) => current && { ...current, description: data.value })} />
                </Field>
                <Field label="Kürzel" hint="Zum Beispiel M365. Maximal 12 Zeichen." required>
                  <Input value={draft?.icon ?? ""} required maxLength={12} disabled={busy}
                    onChange={(_event, data) => setDraft((current) => current && { ...current, icon: data.value })} />
                </Field>
                <Field label="Ziel-URL" hint="HTTP, HTTPS oder www. – bei www. wird https:// ergänzt. Ohne eingebettete Zugangsdaten." required>
                  <Input type="text" inputMode="url" value={draft?.url ?? ""} required maxLength={2048} disabled={busy}
                    onChange={(_event, data) => setDraft((current) => current && { ...current, url: data.value })} />
                </Field>
                <Field label="Reihenfolge" hint="Position ab 0 (erste Kachel). Andere Kacheln rücken nach; größere Werte setzen den Link ans Ende." required>
                  <Input type="number" min={0} max={2147483647} step={1} value={draft?.sortOrder ?? "0"} required disabled={busy}
                    onChange={(_event, data) => setDraft((current) => current && { ...current, sortOrder: data.value })} />
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
      <Dialog open={deleteTarget !== null} onOpenChange={(_event, data) => { if (!data.open && !busy) setDeleteTarget(null); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Link löschen?</DialogTitle>
            <DialogContent>
              {actionError && <MessageBar intent="error"><MessageBarBody>{actionError}</MessageBarBody></MessageBar>}
              <p>„{deleteTarget?.name}“ wird für alle Mitarbeitenden entfernt. Diese Aktion kann nicht rückgängig gemacht werden.</p>
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
              <Button appearance="primary" disabled={busy} onClick={deleteLink}>{busy ? "Löscht …" : "Löschen"}</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
