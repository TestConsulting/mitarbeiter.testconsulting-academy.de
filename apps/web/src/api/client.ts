import type {
  AppLink,
  AppLinkInput,
  ArchivedTicket,
  Benefit,
  BenefitInput,
  BoardColumn,
  BoardState,
  Course,
  CourseInput,
  CourseSummary,
  ExamAnswer,
  ExamAttempt,
  ExamCourse,
  ExamSubmissionResult,
  LearningMaterial,
  PortalUser,
  PracticeProgress,
  Ticket,
  TicketPriority,
} from "@portal/shared";

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
  auth: {
    changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
      return request<{ success: true }>("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
    },
  },
  users: {
    async list() {
      const result = await request<{ users: PortalUser[] }>("/api/users");
      return result.users;
    },
    async create(input: { email: string; name: string; role: "employee" | "admin"; password: string }) {
      const result = await request<{ user: PortalUser }>("/api/users", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return result.user;
    },
    async update(id: string, input: {
      email?: string;
      name?: string;
      role?: "employee" | "admin";
      password?: string;
    }) {
      const result = await request<{ user: PortalUser }>(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      return result.user;
    },
    delete(id: string) {
      return request<{ success: true }>(`/api/users/${id}`, { method: "DELETE" });
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
  courses: {
    async list() {
      const result = await request<{ courses: CourseSummary[] }>("/api/courses");
      return result.courses;
    },
    async get(slug: string) {
      const result = await request<{ course: CourseSummary }>(`/api/courses/${encodeURIComponent(slug)}`);
      return result.course;
    },
    async getAdmin(slug: string) {
      const result = await request<{ course: Course }>(`/api/courses/admin/${encodeURIComponent(slug)}`);
      return result.course;
    },
    async getPractice(slug: string) {
      const result = await request<{ course: Course }>(`/api/courses/${encodeURIComponent(slug)}/practice`);
      return result.course;
    },
    async getPracticeProgress(slug: string) {
      const result = await request<{ progress: PracticeProgress[] }>(
        `/api/courses/${encodeURIComponent(slug)}/practice/progress`,
      );
      return result.progress;
    },
    async checkPracticeAnswer(slug: string, questionId: string, selectedOptionIds: string[]) {
      const result = await request<{ progress: PracticeProgress }>(
        `/api/courses/${encodeURIComponent(slug)}/practice/answer`,
        { method: "POST", body: JSON.stringify({ questionId, selectedOptionIds }) },
      );
      return result.progress;
    },
    async getExam(slug: string) {
      const result = await request<{ course: ExamCourse }>(`/api/courses/${encodeURIComponent(slug)}/exam`);
      return result.course;
    },
    async currentExamSession() {
      return (await request<{ session: import("@portal/shared").ExamSession | null }>("/api/exam-sessions/current")).session;
    },
    async startExamSession(extended: boolean) {
      return (await request<{ session: import("@portal/shared").ExamSession }>("/api/exam-sessions/start", {
        method: "POST", body: JSON.stringify({ slug: "istqb-foundation", extended }),
      })).session;
    },
    async changeExamSession(id: string, action: "save" | "submit" | "abort", answers?: ExamAnswer[]) {
      return (await request<{ session: import("@portal/shared").ExamSession }>(
        `/api/exam-sessions/${encodeURIComponent(id)}/${action}`,
        { method: "POST", body: JSON.stringify({ answers }) },
      )).session;
    },
    async abortedExamSessions() {
      return (await request<{ attempts: import("@portal/shared").AbortedExamSession[] }>("/api/exam-sessions/aborted")).attempts;
    },
    async submitExam(slug: string, answers: ExamAnswer[]) {
      const result = await request<{ result: ExamSubmissionResult }>(
        `/api/courses/${encodeURIComponent(slug)}/exam/submit`,
        { method: "POST", body: JSON.stringify({ answers }) },
      );
      return result.result;
    },
    async examResults() {
      await this.currentExamSession();
      const result = await request<{ attempts: ExamAttempt[] }>("/api/courses/results");
      return result.attempts;
    },
    async create(input: CourseInput) {
      const result = await request<{ course: Course }>("/api/courses", {
        method: "POST", body: JSON.stringify(input),
      });
      return result.course;
    },
    async update(id: string, input: CourseInput) {
      const result = await request<{ course: Course }>(`/api/courses/${encodeURIComponent(id)}`, {
        method: "PUT", body: JSON.stringify(input),
      });
      return result.course;
    },
    delete(id: string) {
      return request<{ success: true }>(`/api/courses/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async uploadMaterial(file: File) {
      const response = await fetch("/api/courses/materials", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": file.type,
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new ApiError(payload.error ?? "Das Lernmaterial konnte nicht hochgeladen werden.", response.status);
      }
      const result = await response.json() as { material: LearningMaterial };
      return result.material;
    },
    deleteMaterial(id: string) {
      return request<{ success: true }>(`/api/courses/materials/${encodeURIComponent(id)}`, { method: "DELETE" });
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
    async createTicket(input: {
      columnId: string;
      title: string;
      description?: string | null;
      assigneeId?: string | null;
      priority?: TicketPriority;
    }) {
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
      priority?: TicketPriority;
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