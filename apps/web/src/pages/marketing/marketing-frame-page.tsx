import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { isMarketingPage, marketingPages, type MarketingPageSlug } from "@portal/shared";

function frameUrl(page: MarketingPageSlug, search: string) {
  return `/marketing/dashboard/${page}${search}`;
}

export function MarketingFramePage() {
  const { page } = useParams();
  if (page === undefined || !isMarketingPage(page)) return <Navigate to="/areas/marketing/ideas" replace />;
  return <MarketingFrame page={page} />;
}

function MarketingFrame({ page }: { page: MarketingPageSlug }) {
  const location = useLocation();
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const target = frameUrl(page, location.search);
  const [src, setSrc] = useState(target);
  // Remount-Zähler: erzwingt ein Neuladen, auch wenn der src-Wert gleich bleibt.
  const [reloadKey, setReloadKey] = useState(0);
  // URL, die der iframe tatsächlich zeigt (src plus Seitenwechsel per Nachricht).
  const shownUrl = useRef(target);
  // Ziel-URL, die eine iframe-Nachricht gerade selbst ausgelöst hat: dafür bleibt src unverändert.
  const fromMessage = useRef<string | null>(null);
  const currentRoute = useRef("");
  currentRoute.current = location.pathname + location.search;

  useEffect(() => {
    if (fromMessage.current === target) {
      fromMessage.current = null;
      return;
    }
    fromMessage.current = null;
    if (shownUrl.current === target) return;
    shownUrl.current = target;
    setSrc(target);
    setReloadKey((key) => key + 1);
  }, [target]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data as { source?: unknown; type?: unknown; page?: unknown; search?: unknown } | null;
      if (!data || data.source !== "tc-marketing" || data.type !== "navigate") return;
      if (typeof data.page !== "string" || !isMarketingPage(data.page)) return;
      const search = typeof data.search === "string" && (data.search === "" || data.search.startsWith("?")) ? data.search : "";
      const path = `/areas/marketing/${data.page}${search}`;
      const url = frameUrl(data.page, search);
      shownUrl.current = url;
      // Zeigt die Nachricht auf die aktuelle URL, ändert sich die Route nicht: kein Flag setzen.
      if (path === currentRoute.current) return;
      fromMessage.current = url;
      navigate(path, { replace: true });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  const label = marketingPages.find((entry) => entry.slug === page)?.label ?? page;
  return <iframe key={reloadKey} ref={frameRef} className="marketing-frame" title={`Marketing – ${label}`} src={src} />;
}
