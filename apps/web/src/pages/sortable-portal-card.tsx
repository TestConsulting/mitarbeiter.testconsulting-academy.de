import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

export function SortablePortalCard({ id, label, className, isAdmin, disabled, children }: {
  id: string; label: string; className: string; isAdmin: boolean; disabled: boolean; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <article ref={setNodeRef}
      {...(isAdmin ? attributes : {})} role="article"
      tabIndex={isAdmin && !disabled ? 0 : undefined}
      aria-label={isAdmin ? `${label} verschieben` : label}
      className={`${className}${isAdmin && !disabled ? ` ${className}--sortable` : ""}${isDragging ? ` ${className}--dragging` : ""}`}
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
