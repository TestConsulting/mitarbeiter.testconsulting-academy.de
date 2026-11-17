import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { isMarketingPage, marketingPages } from "@portal/shared";

export function MarketingFramePage() {
  const { page } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const known = page !== undefined && isMarketingPage(page);
  const target = known ? `/marketing/dashboard/${page}${location.search}` : "";
  const [src, setSrc] = useState(target);
  // Ziel-URL, die eine iframe-Nachricht gerade selbst ausgelöst hat: dafür bleibt src unverändert.
  const fromMessage = useRef<string | null>(null);
  const currentRef = useRef(location.pathname + location.search);
  currentRef.current = location.pathname + location.search;

  useEffect(() => {
    if (!target) return;
    if (fromMessage.current === target) {
      fromMessage.current = null;
      return;
    }
    fromMessage.current = null;
    setSrc(target);
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
      // Zeigt die Nachricht auf die aktuelle URL, ändert sich die Route nicht: kein Flag setzen.
      if (path === currentRef.current) return;
      fromMessage.current = `/marketing/dashboard/${data.page}${search}`;
      navigate(path, { replace: true });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate]);

  if (!known) return <Navigate to="/areas/marketing/ideas" replace />;
  const label = marketingPages.find((entry) => entry.slug === page)?.label ?? page;
  return <iframe ref={frameRef} className="marketing-frame" title={`Marketing – ${label}`} src={src || target} />;
}
