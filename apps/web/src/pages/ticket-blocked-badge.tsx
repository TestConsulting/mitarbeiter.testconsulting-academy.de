import { Flag16Filled } from "@fluentui/react-icons";
import { useState } from "react";
import { ApiError } from "../api/client.js";

export function TicketBlockButton({
  blocked,
  onToggle,
  onError,
  className = "",
}: {
  blocked?: boolean;
  onToggle: () => Promise<void>;
  onError: (message: string | null) => void;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);

  async function toggleBlocked() {
    if (saving) return;
    setSaving(true);
    onError(null);
    try {
      await onToggle();
    } catch (error) {
      onError(error instanceof ApiError ? error.message : "Die Blockierung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      className={`ticket-card__action ticket-card__block ${className}`.trim()}
      aria-label={blocked ? "Blockierung aufheben" : "Ticket blockieren"}
      title={blocked ? "Blockierung aufheben" : "Ticket blockieren"}
      aria-pressed={blocked ?? false}
      disabled={saving}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); void toggleBlocked(); }}
    >
      <Flag16Filled aria-hidden="true" />
    </button>
  );
}

export function TicketBlockedBadge({ blocked }: { blocked?: boolean }) {
  return blocked ? (
    <span className="ticket-blocked-badge">
      <Flag16Filled aria-hidden="true" />
      Blockiert
    </span>
  ) : null;
}
