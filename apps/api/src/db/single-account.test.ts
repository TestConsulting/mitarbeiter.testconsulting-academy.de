import { describe, expect, it, vi } from "vitest";
import { provisionSingleAccount } from "./single-account.js";

const account = { email: "account@example.test", name: "Portal", passwordHash: "test-hash" };

describe("single account provisioning", () => {
  it.each([true, false])("preserves tickets and enforces one administrator (existing: %s)", async (existing) => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT id")) return { rows: existing ? [{ id: "account-id" }] : [] };
      if (sql.includes("INSERT INTO users")) return { rows: [{ id: "account-id" }] };
      return { rows: [] };
    });
    const release = vi.fn();
    const database = { connect: vi.fn().mockResolvedValue({ query, release }) };
    expect(await provisionSingleAccount(database, account)).toBe("account-id");
    const statements = query.mock.calls.map(([sql]) => sql as string);
    expect(statements.indexOf("UPDATE tickets SET created_by = $1 WHERE created_by <> $1"))
      .toBeLessThan(statements.indexOf("DELETE FROM users WHERE id <> $1"));
    expect(query).toHaveBeenCalledWith(
      "UPDATE tickets SET assignee_id = $1 WHERE assignee_id IS NOT NULL AND assignee_id <> $1", ["account-id"],
    );
    expect(query).toHaveBeenCalledWith(
      "UPDATE users SET email = $2, name = $3, password_hash = $4, role = 'admin' WHERE id = $1",
      ["account-id", account.email, account.name, account.passwordHash],
    );
    expect(query).toHaveBeenCalledWith("CREATE UNIQUE INDEX IF NOT EXISTS users_single_account ON users ((true))");
    expect(statements.some((sql) => sql.includes("CHECK (role = 'admin')") && sql.includes("DELETE FROM portal_sessions"))).toBe(true);
    expect(query).toHaveBeenLastCalledWith("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases the connection on failure", async () => {
    const query = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Lock failed")).mockResolvedValue({});
    const release = vi.fn();
    await expect(provisionSingleAccount(
      { connect: vi.fn().mockResolvedValue({ query, release }) }, account,
    )).rejects.toThrow("Lock failed");
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });
});
