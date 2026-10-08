export type PortalUser = {
  id: string;
  email: string;
  name: string;
  role: "employee" | "admin" | "user";
};

export function canManagePortal(user: PortalUser | null | undefined): boolean {
  return user?.role === "user" || user?.role === "admin";
}

export type AppLinkInput = {
  name: string;
  description: string;
  url: string;
  icon: string;
  sortOrder: number;
};

export type AppLink = AppLinkInput & { id: string };

export type BenefitInput = {
  title: string;
  description: string;
  details: string;
};

export type Benefit = BenefitInput & { id: string };

export function isValidPortalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return value.length <= 2048 && ["http:", "https:"].includes(url.protocol) &&
      !url.username && !url.password && !/^www\.?$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function isValidAppLinkUrl(value: string): boolean {
  if (/^mailto:/i.test(value)) {
    return value.length <= 2048 && /^mailto:[a-z0-9.!$'*+_~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
  }
  return isValidPortalUrl(value);
}

export function normalizeAppLinkUrl(value: string): string {
  const trimmed = value.trim();
  return /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
}

export type BoardColumn = {
  id: string;
  title: string;
  position: number;
};

export type Ticket = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type BoardState = {
  columns: BoardColumn[];
  tickets: Ticket[];
};

export const portalAreas = [
  { slug: "elearning", label: "eLearning", description: "Lernen und Zertifikate" },
  { slug: "applications", label: "Application Links", description: "Unternehmenswerkzeuge" },
  { slug: "benefits", label: "Benefits", description: "Mitarbeiterangebote" },
  { slug: "marketing", label: "Marketing", description: "Vorlagen und Markenmaterial" },
  { slug: "sales", label: "Vertrieb", description: "Vertriebsunterstützung" },
  { slug: "tasks", label: "Tasks", description: "Gemeinsame Aufgaben" },
] as const;

export type PortalArea = (typeof portalAreas)[number];