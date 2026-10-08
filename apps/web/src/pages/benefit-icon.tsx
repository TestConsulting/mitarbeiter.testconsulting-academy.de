import { Gift24Filled } from "@fluentui/react-icons";
import { AreaIcon } from "../app/area-icon.js";

export function BenefitIcon({ title }: { title: string }) {
  const isUrbanSports = /^(?:sachbezug\s*[-–]\s*)?urban\s*sports(?:\s*club)?$/i.test(title.trim());
  const isSachbezug = /^dein sachbezug(?:\s*[-–]\s*informationen)?$/i.test(title.trim());
  const isSachbezugskarte = /^(?:sachbezug\s*[-–]\s*)?sachbezugskarte$/i.test(title.trim());
  const image = isUrbanSports ? "/images/urban-sports.webp"
    : isSachbezugskarte ? "/images/sachbezugskarte.png"
    : title.trim().toLowerCase() === "firmenhandy" ? "/images/firmenhandy.jpg"
    : null;
  return (
    <span className={`benefit-card__icon${image ? " benefit-card__icon--image" : isSachbezug ? " benefit-card__icon--gift" : ""}`} aria-hidden="true">
      {image ? <img src={image} alt="" draggable={false} /> : isSachbezug ? <Gift24Filled /> : <AreaIcon slug="benefits" large />}
    </span>
  );
}
