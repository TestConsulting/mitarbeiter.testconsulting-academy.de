import { Button } from "@fluentui/react-components";
import { ArrowRight20Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Benefit } from "@portal/shared";
import { canManagePortal } from "@portal/shared";
import { api } from "../api/client.js";
import { AreaIcon } from "../app/area-icon.js";
import { useAuth } from "../app/auth-context.js";
import { BenefitActions } from "./benefit-actions.js";

export function BenefitsPage() {
  const { user } = useAuth();
  const isAdmin = canManagePortal(user);
  const location = useLocation();
  const navigationState: unknown = location.state;
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [notice, setNotice] = useState(
    navigationState !== null && typeof navigationState === "object" && "benefitDeleted" in navigationState &&
    navigationState.benefitDeleted === true ? "Benefit wurde gelöscht." : "",
  );

  useEffect(() => {
    let active = true;
    setStatus("loading");
    api.benefits.list().then((data) => {
      if (!active) return;
      setBenefits(data);
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, [loadAttempt]);

  function saved(benefit: Benefit) {
    setBenefits((current) => [...current.filter((entry) => entry.id !== benefit.id), benefit]);
    setNotice("Benefit wurde gespeichert.");
  }

  function deleted(id: string) {
    setBenefits((current) => current.filter((entry) => entry.id !== id));
    setNotice("Benefit wurde gelöscht.");
  }

  const sorted = [...benefits].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));

  return (
    <div className="page-stack benefits-page">
      <div className="page-heading">
        <h1><AreaIcon slug="benefits" /> Benefits</h1>
        {status === "ready" && <BenefitActions onSaved={saved} />}
      </div>
      <p className="benefits-intro">Deine Vorteile auf einen Blick. Entdecke alle Informationen auf der jeweiligen Detailseite.</p>
      {notice && <p role="status">{notice}</p>}
      {status === "loading" && <p role="status">Benefits werden geladen …</p>}
      {status === "error" && (
        <section className="empty-state" role="alert">
          <h2>Benefits konnten nicht geladen werden.</h2>
          <p>Bitte prüfe deine Verbindung und versuche es erneut.</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Erneut versuchen</Button>
        </section>
      )}
      {status === "ready" && sorted.length === 0 && (
        <section className="empty-state">
          <span className="empty-state__icon"><AreaIcon slug="benefits" large /></span>
          <h2>Noch keine Benefits vorhanden.</h2>
          <p>{isAdmin ? "Füge den ersten Benefit für deine Mitarbeitenden hinzu." : "Die Benefits werden von der Administration bereitgestellt."}</p>
        </section>
      )}
      {status === "ready" && sorted.length > 0 && (
        <div className="benefits-grid">
          {sorted.map((benefit) => (
            <article className="benefit-card" key={benefit.id} aria-label={benefit.title}>
              <div className="benefit-card__content">
                <span className="benefit-card__icon" aria-hidden="true"><AreaIcon slug="benefits" large /></span>
                <h2>{benefit.title}</h2>
                <p>{benefit.description}</p>
                <Link className="benefit-card__open" to={`/areas/benefits/${benefit.id}`} aria-label={`${benefit.title}: Details ansehen`}>
                  Details ansehen <ArrowRight20Regular aria-hidden="true" />
                </Link>
              </div>
              {isAdmin && (
                <div className="benefit-card__actions">
                  <BenefitActions benefit={benefit} onSaved={saved} onDeleted={deleted} />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
