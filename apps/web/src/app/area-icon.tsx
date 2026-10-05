import {
  AppsListDetail24Regular,
  BookOpen24Regular,
  Briefcase24Regular,
  CheckmarkCircle24Regular,
  Gift24Regular,
  Megaphone24Regular,
} from "@fluentui/react-icons";

export function AreaIcon({ slug, large = false }: { slug: string; large?: boolean }) {
  const size = large ? "area-icon area-icon--large" : "area-icon";
  switch (slug) {
    case "elearning": return <BookOpen24Regular className={size} aria-hidden="true" />;
    case "applications": return <AppsListDetail24Regular className={size} aria-hidden="true" />;
    case "benefits": return <Gift24Regular className={size} aria-hidden="true" />;
    case "marketing": return <Megaphone24Regular className={size} aria-hidden="true" />;
    case "sales": return <Briefcase24Regular className={size} aria-hidden="true" />;
    default: return <CheckmarkCircle24Regular className={size} aria-hidden="true" />;
  }
}