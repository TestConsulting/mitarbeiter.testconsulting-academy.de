import { Button } from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Benefit } from "@portal/shared";
import { canManagePortal, isValidPortalUrl } from "@portal/shared";
import { ApiError, api } from "../api/client.js";
import { useAuth } from "../app/auth-context.js";
import { BenefitActions } from "./benefit-actions.js";
import { BenefitLink } from "./benefit-link.js";
import { BenefitIcon } from "./benefit-icon.js";

function LinkedDescription({ text }: { text: string }) {
  return text.split(/(https?:\/\/[^\s<>"]+)/gi).map((part, index) => {
    const url = part.replace(/[.,;:!?]+$/, "");
    if (!/^https?:\/\//i.test(url) || !isValidPortalUrl(url)) return part;
    return <span key={index}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a>{part.slice(url.length)}</span>;
  });
}

export function BenefitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [benefit, setBenefit] = useState<Benefit | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setBenefit(null);
    setNotice("");
    setStatus("loading");
    if (!id) {
      setStatus("missing");
      return;
    }
    api.benefits.get(id).then((data) => {
      if (!active) return;
      setBenefit(data);
      setStatus("ready");
    }).catch((error: unknown) => {
      if (active) setStatus(error instanceof ApiError && (error.status === 404 || error.status === 400) ? "missing" : "error");
    });
    return () => { active = false; };
  }, [id, loadAttempt]);

  return (
    <div className="page-stack benefits-page">
      <Link className="benefit-back" to="/areas/benefits"><ArrowLeft20Regular aria-hidden="true" /> Alle Benefits</Link>
      {notice && <p role="status">{notice}</p>}
      {status === "loading" && <p role="status">Benefit wird geladen …</p>}
      {status === "missing" && (
        <section className="empty-state">
          <h1>Benefit wurde nicht gefunden.</h1>
          <p>Der Benefit ist nicht mehr verfügbar oder die Adresse ist ungültig.</p>
        </section>
      )}
      {status === "error" && (
        <section className="empty-state" role="alert">
          <h1>Benefit konnte nicht geladen werden.</h1>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
        </section>
      )}
      {status === "ready" && benefit && (
        <article className="benefit-card benefit-detail" aria-labelledby="benefit-title">
          <div className="benefit-card__content">
            <BenefitIcon title={benefit.title} />
            <h1 id="benefit-title">{benefit.title}</h1>
            <p className="benefit-detail__summary">{benefit.description}</p>
            <section className="benefit-detail__body" aria-labelledby="benefit-details-title">
              <h2 id="benefit-details-title">Details</h2>
              <p><LinkedDescription text={benefit.details} /></p>
            </section>
            <BenefitLink benefit={benefit} />
          </div>
          {canManagePortal(user) && (
            <div className="benefit-card__actions">
              <BenefitActions benefit={benefit}
                onSaved={(saved) => { setBenefit(saved); setNotice("Benefit wurde gespeichert."); }}
                onDeleted={() => navigate("/areas/benefits", { replace: true, state: { benefitDeleted: true } })} />
            </div>
          )}
        </article>
      )}
    </div>
  );
}
