import { ArrowUpRight20Regular, Mail20Regular } from "@fluentui/react-icons";
import type { Benefit } from "@portal/shared";

export function BenefitLink({ benefit }: { benefit: Benefit }) {
  if (!benefit.url) return null;
  const isEmail = /^mailto:/i.test(benefit.url);
  return (
    <a className="benefit-card__open" href={benefit.url} target={isEmail ? undefined : "_blank"} rel="noopener noreferrer"
      draggable={false} aria-label={`${benefit.title}: ${isEmail ? "E-Mail schreiben" : "Angebot öffnen (neuer Tab)"}`}>
      {isEmail ? <>E-Mail schreiben <Mail20Regular aria-hidden="true" /></> : <>Angebot öffnen <ArrowUpRight20Regular aria-hidden="true" /></>}
    </a>
  );
}
