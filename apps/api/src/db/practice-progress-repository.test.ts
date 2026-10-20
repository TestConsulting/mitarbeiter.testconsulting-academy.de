import { beforeEach, describe, expect, it, vi } from "vitest";
import { coursesData } from "@portal/shared";
import { createPracticeProgressRepository } from "./practice-progress-repository.js";

const database = { query: vi.fn() };
const repository = createPracticeProgressRepository(database);
const question = coursesData[0].questions[0];
beforeEach(() => { vi.resetAllMocks(); database.query.mockResolvedValue({ rows: [] }); });

describe("practice progress persistence", () => {
  it("upserts answers with a content fingerprint and scopes reads to the authenticated user and course", async () => {
    await expect(repository.record("employee", "course", question, false))
      .resolves.toEqual({ questionId: question.id, lastCorrect: false });
    const parameters = database.query.mock.calls[0][1];
    expect(parameters).toEqual(["employee", "course", question.id, expect.stringMatching(/^[a-f0-9]{64}$/), false]);
    expect(database.query.mock.calls[0][0]).toContain("ON CONFLICT (user_id, course_id, question_id)");
    database.query.mockResolvedValue({ rows: [
      { questionId: question.id, lastCorrect: false, fingerprint: parameters[3] },
      { questionId: "removed", lastCorrect: true, fingerprint: parameters[3] },
    ] });
    await expect(repository.list("employee", "course", [question]))
      .resolves.toEqual([{ questionId: question.id, lastCorrect: false }]);
    expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("user_id = $1 AND course_id = $2"),
      ["employee", "course"]);
    await expect(repository.list("employee", "course", [{ ...question, question: "Updated question" }]))
      .resolves.toEqual([]);
  });

  it("propagates read and write failures instead of pretending progress was saved", async () => {
    database.query.mockRejectedValue(new Error("Unavailable"));
    await expect(repository.record("employee", "course", question, true)).rejects.toThrow("Unavailable");
    await expect(repository.list("employee", "course", [question])).rejects.toThrow("Unavailable");
  });
});
