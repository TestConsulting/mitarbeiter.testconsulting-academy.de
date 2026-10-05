import type { BoardColumn, BoardState, PortalUser, Ticket } from "@portal/shared";

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
    async createTicket(input: { columnId: string; title: string; description?: string | null; assigneeId?: string | null }) {
      const result = await request<{ tickets: Ticket[] }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(input),
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