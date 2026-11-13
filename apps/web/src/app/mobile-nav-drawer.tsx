import { type ReactNode, useEffect, useRef } from "react";
import { Button } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { Link } from "react-router-dom";

type MobileNavDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  children: ReactNode;
};

export function MobileNavDrawer({ isOpen, onClose, triggerRef, children }: MobileNavDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const mediaQuery = typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 1024px)")
      : null;

    if (!mediaQuery || typeof mediaQuery.addEventListener !== "function") {
      return;
    }

    const handleDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        onClose();
      }
    };

    mediaQuery.addEventListener("change", handleDesktop);
    return () => {
      mediaQuery.removeEventListener("change", handleDesktop);
    };
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const isDesktop = typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false;
    if (!isOpen || isDesktop) {
      return;
    }

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;
    const previousBodyOverflow = body.style.overflow;
    const previousDocumentOverflow = documentElement.style.overflow;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
    };
  }, [isOpen]);

  useEffect(() => {
    const isDesktop = typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false;
    if (isDesktop) {
      return;
    }

    if (isOpen) {
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
      return;
    }

    triggerRef?.current?.focus();
  }, [isOpen, triggerRef]);

  return (
    <div className={`mobile-nav-drawer${isOpen ? " mobile-nav-drawer--open" : ""}`}>
      <button
        type="button"
        className="mobile-nav-drawer__backdrop"
        aria-label="Navigation schließen"
        onClick={onClose}
      />
      <aside
        id="portal-navigation"
        className="mobile-nav-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Portalnavigation"
      >
        <div className="mobile-nav-drawer__header">
          <Link className="mobile-nav-drawer__brand" to="/" aria-label="TestConsulting Übersicht" onClick={onClose}>
            <img className="brand-logo brand-logo--header" src="/images/testconsulting-logo.png" alt="TestConsulting Logo" />
          </Link>
          <Button
            ref={closeButtonRef}
            appearance="subtle"
            className="mobile-nav-drawer__close"
            icon={<Dismiss20Regular />}
            aria-label="Navigation schließen"
            title="Navigation schließen"
            onClick={onClose}
          />
        </div>
        {children}
      </aside>
    </div>
  );
}
