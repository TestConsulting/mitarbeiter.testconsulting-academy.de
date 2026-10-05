export type PortalUser = {
  id: string;
  email: string;
  name: string;
  role: "employee" | "admin";
};

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