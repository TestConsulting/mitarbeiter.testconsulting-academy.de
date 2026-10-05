import { Badge, Button } from "@fluentui/react-components";
import { ArrowRight20Regular, Grid24Regular } from "@fluentui/react-icons";
import { Link } from "react-router-dom";
import { portalAreas } from "@portal/shared";
import { useAuth } from "../app/auth-context.js";
import { AreaIcon } from "../app/area-icon.js";

export function OverviewPage() {
  const { user } = useAuth();
  const firstName = user?.name.trim().split(/\s+/)[0] || "Mitarbeiter";

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1><Grid24Regular aria-hidden="true" /> Übersicht</h1>
        <span>Mitarbeiterportal</span>
      </div>
      <section className="welcome-panel">
        <span className="welcome-panel__eyebrow">TestConsulting · Arbeitsbereich</span>
        <h2>Willkommen, {firstName}</h2>
        <p>Deine Lernangebote, Werkzeuge und internen Bereiche an einem Ort.</p>
        <Button as="a" href="#bereiche" appearance="secondary" icon={<ArrowRight20Regular />}>
          Bereiche ansehen
        </Button>
      </section>
      <section aria-labelledby="areas-title" id="bereiche" className="areas-section">
        <div className="section-heading">
          <h2 id="areas-title">Deine Bereiche</h2>
          <span>6 Bereiche</span>
        </div>
        <div className="area-grid">
          {portalAreas.map((area) => (
            <Link className="area-card" to={`/areas/${area.slug}`} key={area.slug}>
              <span className="area-card__icon"><AreaIcon slug={area.slug} large /></span>
              <span className="area-card__title">{area.label}</span>
              <span className="area-card__description">{area.description}</span>
              {area.slug !== "tasks" && <Badge appearance="tint" color="informative">In Vorbereitung</Badge>}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}