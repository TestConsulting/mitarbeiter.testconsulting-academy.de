import { Button, Field } from "@fluentui/react-components";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, type TicketAttachment } from "../api/client.js";

const MB = 1024 * 1024;
const MAX_FILE_SIZE = 20 * MB;
const MAX_TOTAL_SIZE = 100 * MB;
const MAX_FILES = 10;
const FILE_EXTENSION = /\.(png|jpe?g|gif|webp|pdf|xlsx|xls)$/i;

export function useTicketAttachments(ticketId?: string) {
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(ticketId));
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      setAttachments(await api.board.listAttachments(ticketId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Anhänge konnten nicht geladen werden.");
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { void load(); }, [load]);

  function add(files: File[]) {
    const active = attachments.filter((item) => !removed.includes(item.id));
    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setError(`Die Datei „${oversized.name}“ ist zu groß (${Math.ceil(oversized.size / MB)} MB). Erlaubt sind maximal 20 MB.`);
    } else if (files.some((file) => !FILE_EXTENSION.test(file.name) || file.size === 0)) {
      setError("Bitte wähle gültige Bild-, PDF- oder Excel-Dateien aus.");
    } else if (active.length + pending.length + files.length > MAX_FILES) {
      setError("Pro Ticket sind höchstens 10 Anhänge erlaubt.");
    } else if (active.reduce((sum, item) => sum + item.size, 0) + [...pending, ...files].reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_SIZE) {
      setError("Alle Anhänge zusammen dürfen höchstens 100 MB groß sein.");
    } else {
      setPending((current) => [...current, ...files]);
      setError(null);
    }
  }

  async function save(id: string) {
    if (loading || loadFailed) throw new Error("Anhänge konnten nicht geladen werden.");
    for (const attachmentId of removed) {
      await api.board.deleteAttachment(id, attachmentId);
      setRemoved((current) => current.filter((entry) => entry !== attachmentId));
      setAttachments((current) => current.filter((item) => item.id !== attachmentId));
    }
    for (const file of pending) {
      const attachment = await api.board.uploadAttachment(id, file);
      setPending((current) => {
        const index = current.indexOf(file);
        return index < 0 ? current : [...current.slice(0, index), ...current.slice(index + 1)];
      });
      setAttachments((current) => [...current, attachment]);
    }
  }

  function reset() {
    setAttachments([]);
    setPending([]);
    setRemoved([]);
    setError(null);
    setLoadFailed(false);
  }

  return { attachments, pending, removed, error, loading, loadFailed, add, save, reset, load,
    remove: (id: string) => setRemoved((current) => [...current, id]),
    removePending: (index: number) => setPending((current) => current.filter((_, i) => i !== index)),
  };
}

export function TicketAttachments({ manager, ticketId, disabled }: {
  manager: ReturnType<typeof useTicketAttachments>;
  ticketId?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Field label="Anhänge">
      <div
        className="ticket-attachments"
        onDragOver={(event) => { event.preventDefault(); }}
        onDrop={(event) => {
          event.preventDefault();
          if (!disabled && !manager.loading && !manager.loadFailed) manager.add(Array.from(event.dataTransfer.files));
        }}
      >
        <span>Dateien hier ablegen oder auswählen</span>
        <Button type="button" size="small" disabled={disabled || manager.loading || manager.loadFailed} onClick={() => inputRef.current?.click()}>
          Dateien auswählen
        </Button>
        <input
          ref={inputRef}
          hidden
          type="file"
          aria-label="Anhänge auswählen"
          accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.xlsx,.xls"
          multiple
          disabled={disabled || manager.loading || manager.loadFailed}
          onChange={(event) => {
            manager.add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <small>Bilder, PDF und Excel · max. 20 MB pro Datei</small>
        <small>Max. 10 Anhänge und 100 MB pro Ticket</small>
        {manager.loading && <span>Anhänge werden geladen …</span>}
        {manager.error && <span role="alert">{manager.error}</span>}
        {manager.loadFailed && <Button type="button" onClick={() => void manager.load()}>Erneut laden</Button>}
        {manager.attachments.filter((item) => !manager.removed.includes(item.id)).map((item) => (
          <div className="ticket-attachments__item" key={item.id}>
            <a href={`/api/tickets/${encodeURIComponent(ticketId ?? "")}/attachments/${encodeURIComponent(item.id)}/download`}>{item.fileName}</a>
            {item.contentType.startsWith("image/") && (
              <a href={`/api/tickets/${encodeURIComponent(ticketId ?? "")}/attachments/${encodeURIComponent(item.id)}/download?preview=1`} target="_blank" rel="noreferrer">Vorschau</a>
            )}
            <Button type="button" size="small" disabled={disabled} onClick={() => manager.remove(item.id)} aria-label={`${item.fileName} entfernen`}>Entfernen</Button>
          </div>
        ))}
        {manager.pending.map((file, index) => (
          <div className="ticket-attachments__item" key={`${file.name}-${index}`}>
            <span>{file.name}</span>
            <Button type="button" size="small" disabled={disabled} onClick={() => manager.removePending(index)} aria-label={`${file.name} entfernen`}>Entfernen</Button>
          </div>
        ))}
      </div>
    </Field>
  );
}
