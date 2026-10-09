import type { AppLink, AppLinkInput, ArchivedTicket, Benefit, BenefitInput, BoardColumn, BoardState, PortalUser, Ticket } from "@portal/shared";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new ApiError(payload.error ?? "Die Anfrage ist fehlgeschlagen.", response.status);
  }
  return response.json() as Promise<T>;
}

export const api = {
  async me() {
    const result = await request<{ user: PortalUser }>("/api/auth/me");
    return result.user;
  },
  async login(email: string, password: string) {
    const result = await request<{ user: PortalUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return result.user;
  },
  logout() {
    return request<{ success: true }>("/api/auth/logout", { method: "POST" });
  },
  users: {
    async list() {
      const result = await request<{ users: PortalUser[] }>("/api/users");
      return result.users;
    },
  },
  links: {
    async reorder(ids: string[]) {
      const result = await request<{ links: AppLink[] }>("/api/links/order", {
        method: "PUT",
        body: JSON.stringify({ ids }),
      });
      return result.links;
    },
    async list() {
      const result = await request<{ links: AppLink[] }>("/api/links");
      return result.links;
    },
    async create(input: AppLinkInput) {
      const result = await request<{ link: AppLink }>("/api/links", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return result.link;
    },
    async update(id: string, input: AppLinkInput) {
      const result = await request<{ link: AppLink }>(`/api/links/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      return result.link;
    },
    delete(id: string) {
      return request<{ success: true }>(`/api/links/${id}`, { method: "DELETE" });
    },
  },
  benefits: {
    async reorder(ids: string[]) {
      const result = await request<{ benefits: Benefit[] }>("/api/benefits/order", {
        method: "PUT", body: JSON.stringify({ ids }),
      });
      return result.benefits;
    },
    async list() {
      const result = await request<{ benefits: Benefit[] }>("/api/benefits");
      return result.benefits;
    },
    async get(id: string) {
      const result = await request<{ benefit: Benefit }>(`/api/benefits/${encodeURIComponent(id)}`);
      return result.benefit;
    },
    async create(input: BenefitInput) {
      const result = await request<{ benefit: Benefit }>("/api/benefits", {
        method: "POST", body: JSON.stringify(input),
      });
      return result.benefit;
    },
    async update(id: string, input: BenefitInput) {
      const result = await request<{ benefit: Benefit }>(`/api/benefits/${encodeURIComponent(id)}`, {
        method: "PUT", body: JSON.stringify(input),
      });
      return result.benefit;
    },
    delete(id: string) {
      return request<{ success: true }>(`/api/benefits/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  },
  board: {
    get() {
      return request<BoardState>("/api/board");
    },
    async createColumn(title: string) {
      const result = await request<{ columns: BoardColumn[] }>("/api/board/columns", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      return result.columns;
    },
    async updateColumn(id: string, patch: { title?: string; position?: number }) {
      const result = await request<{ columns: BoardColumn[] }>(`/api/board/columns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return result.columns;
    },
    async renameColumn(id: string, title: string) {
      const result = await request<{ columns: BoardColumn[] }>(`/api/board/columns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      return result.columns;
    },
    async deleteColumn(id: string) {
      const result = await request<{ columns: BoardColumn[] }>(`/api/board/columns/${id}`, { method: "DELETE" });
      return result.columns;
    },
    async createTicket(input: { columnId: string; title: string; description?: string | null; assigneeId?: string | null }) {
      const result = await request<{ tickets: Ticket[] }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return result.tickets;
    },
    async archiveTickets(columnId: string) {
      const result = await request<{ tickets: Ticket[] }>("/api/tickets/archive", {
        method: "POST",
        body: JSON.stringify({ columnId }),
      });
      return result.tickets;
    },
    async archiveTicket(id: string) {
      const result = await request<{ tickets: Ticket[] }>(`/api/tickets/${id}/archive`, {
        method: "POST",
      });
      return result.tickets;
    },
    async listArchivedTickets() {
      const result = await request<{ tickets: ArchivedTicket[] }>("/api/tickets/archived");
      return result.tickets;
    },
    async restoreTicket(id: string, columnId?: string) {
      const result = await request<{ tickets: Ticket[] }>(`/api/tickets/${id}/restore`, {
        method: "POST",
        body: JSON.stringify(columnId ? { columnId } : {}),
      });
      return result.tickets;
    },
    async updateTicket(id: string, patch: {
      title?: string;
      description?: string | null;
      assigneeId?: string | null;
      columnId?: string;
      position?: number;
    }) {
      const result = await request<{ tickets: Ticket[] }>(`/api/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return result.tickets;
    },
    async deleteTicket(id: string) {
      const result = await request<{ tickets: Ticket[] }>(`/api/tickets/${id}`, { method: "DELETE" });
      return result.tickets;
    },
  },
};