import { Badge, Button } from "@fluentui/react-components";
import { ArrowLeft20Regular } from "@fluentui/react-icons";
import { Link, useParams } from "react-router-dom";
import { portalAreas } from "@portal/shared";
import { AreaIcon } from "../app/area-icon.js";

export function AreaPage() {
  const { area: slug } = useParams();
  const area = portalAreas.find((item) => item.slug === slug);

  if (!area) {
    return <section className="empty-state"><h1>Bereich nicht gefunden</h1><Link to="/">Zur Übersicht</Link></section>;
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1><AreaIcon slug={area.slug} /> {area.label}</h1>
        <Badge appearance="tint" color="informative">In Vorbereitung</Badge>
      </div>
      <section className="empty-state">
        <span className="empty-state__icon"><AreaIcon slug={area.slug} large /></span>
        <h2>Dieser Bereich wird in einer späteren Phase eingerichtet.</h2>
        <p>Die Anmeldung und Navigation sind bereits Teil des Grundgerüsts. Inhalte und Anbindungen kommen erst mit dem jeweiligen Fachbereich.</p>
        <Button as="a" href="/" appearance="primary" icon={<ArrowLeft20Regular />}>Zur Übersicht</Button>
      </section>
    </div>
  );
}