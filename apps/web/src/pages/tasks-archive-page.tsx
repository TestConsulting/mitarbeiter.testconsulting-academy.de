import { Button, Input } from "@fluentui/react-components";
import { ArrowLeft20Regular, Archive16Regular } from "@fluentui/react-icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ArchivedTicket, BoardColumn } from "@portal/shared";
import { api } from "../api/client.js";

export function TasksArchivePage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [archivedTickets, setArchivedTickets] = useState<ArchivedTicket[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.board.listArchivedTickets(), api.board.get()])
      .then(([archived, board]) => {
        if (!active) return;
        setArchivedTickets(archived);
        setColumns(board.columns);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => { active = false; };
  }, []);

  const columnsById = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredArchived = useMemo(() => {
    if (!normalizedQuery) return archivedTickets;
    return archivedTickets.filter((ticket) => {
      const columnTitle = columnsById.get(ticket.columnId)?.title ?? "";
      const archivedDate = new Date(ticket.archivedAt).toLocaleDateString("de-DE");
      const haystack = [ticket.title, ticket.description ?? "", columnTitle, archivedDate]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [archivedTickets, columnsById, normalizedQuery]);

  async function handleRestore(id: string) {
    const tickets = await api.board.restoreTicket(id);
    // Keep board state in backend up-to-date and refresh archive list locally.
    if (tickets) {
      const archived = await api.board.listArchivedTickets();
      setArchivedTickets(archived);
    }
  }

  if (status === "loading") {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <h1><Archive16Regular aria-hidden="true" /> Archiv</h1>
        </div>
        <p>Archiv wird geladen …</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="page-stack">
        <div className="page-heading">
          <h1><Archive16Regular aria-hidden="true" /> Archiv</h1>
        </div>
        <section className="empty-state">
          <h2>Archiv konnte nicht geladen werden.</h2>
          <p>Bitte lade die Seite neu oder versuche es später erneut.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1><Archive16Regular aria-hidden="true" /> Archiv</h1>
        <div className="page-heading__actions">
          <Button appearance="secondary" icon={<ArrowLeft20Regular />} onClick={() => navigate("/areas/tasks")}>Zurück zum Board</Button>
        </div>
      </div>

      <section className="archive-panel">
        <div className="archive-panel__header">
          <h2>Archivierte Tickets</h2>
          <span>{filteredArchived.length} von {archivedTickets.length} archiviert</span>
        </div>
        <Input
          className="archive-search"
          placeholder="Archiv durchsuchen"
          value={query}
          onChange={(_event, data) => setQuery(data.value)}
        />
        {filteredArchived.length === 0 ? (
          <p className="archive-panel__empty">Keine archivierten Tickets vorhanden.</p>
        ) : (
          <ul className="archive-list">
            {filteredArchived.map((ticket) => (
              <li key={ticket.id} className="archive-list__item">
                <div className="archive-list__meta">
                  <strong>{ticket.title}</strong>
                  <span>
                    {columnsById.get(ticket.columnId)?.title ?? "Unbekannte Spalte"} • {new Date(ticket.archivedAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
                <Button appearance="secondary" size="small" onClick={() => handleRestore(ticket.id)}>
                  Wiederherstellen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
