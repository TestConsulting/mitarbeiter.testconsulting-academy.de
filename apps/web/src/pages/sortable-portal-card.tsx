import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, type ReactNode } from "react";

export function SortablePortalCard({ id, label, className, isAdmin, disabled, onOpen, children }: {
  id: string; label: string; className: string; isAdmin: boolean; disabled: boolean; onOpen?: () => void; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const dragged = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (isDragging) dragged.current = true;
  }, [isDragging]);
  return (
    <article ref={setNodeRef}
      {...(isAdmin ? attributes : {})} role="article"
      tabIndex={onOpen || (isAdmin && !disabled) ? 0 : undefined}
      aria-label={isAdmin ? `${label} verschieben` : label}
      aria-keyshortcuts={onOpen ? "Enter" : undefined}
      title={onOpen ? `${label}: Details ansehen (Enter)` : undefined}
      className={`${className}${isAdmin && !disabled ? ` ${className}--sortable` : ""}${isDragging ? ` ${className}--dragging` : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onPointerDown={(event) => {
        dragged.current = false;
        pointerStart.current = { x: event.clientX, y: event.clientY };
        if (disabled || !(event.target instanceof Element) || event.target.closest("a, button, input, textarea, select")) return;
        listeners?.onPointerDown?.(event);
      }}
      onPointerMove={(event) => {
        const start = pointerStart.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) dragged.current = true;
      }}
      onClick={(event) => {
        if (!onOpen || isDragging || dragged.current || !(event.target instanceof Element) || event.target.closest("a, button, input, textarea, select")) return;
        onOpen();
      }}
      onKeyDown={(event) => {
        if (onOpen && event.target === event.currentTarget && !isDragging && (event.key === "Enter" || (!isAdmin && event.key === " "))) {
          event.preventDefault();
          onOpen();
          return;
        }
        if (!disabled && event.target === event.currentTarget) listeners?.onKeyDown?.(event);
      }}>
      {children}
    </article>
  );
}
