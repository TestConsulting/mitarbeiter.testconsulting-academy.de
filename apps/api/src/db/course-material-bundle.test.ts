import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importCourseMaterialBundle } from "./course-material-bundle.js";

const id = "becac59e-b2a9-43fc-9551-66076ababd84";
const content = Buffer.from("material-content");
const material = {
  id,
  title: "CTFL",
  fileName: "CTFL.jpg",
  fileSize: "44 KB",
  url: `/api/courses/materials/${id}/download`,
};
let directory = "";

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

async function createBundle() {
  directory = await mkdtemp(join(tmpdir(), "course-material-bundle-"));
  await writeFile(join(directory, `${id}.jpg`), content);
  await writeFile(join(directory, "manifest.json"), JSON.stringify({
    version: 1,
    files: [{
      id,
      fileName: "CTFL.jpg",
      sizeBytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex"),
      assetFile: `${id}.jpg`,
      references: [{ courseSlug: "istqb-foundation", material }],
    }],
  }));
}

function createDatabase(existingFile: { file_name: string; content: Buffer } | null = null) {
  const client = { query: vi.fn(), release: vi.fn() };
  client.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith("SELECT file_name")) return { rows: existingFile ? [existingFile] : [] };
    if (sql.startsWith("SELECT id, course_data")) {
      return { rows: [{ id: "course-id", materials: [] }] };
    }
    return { rows: [] };
  });
  return { database: { connect: vi.fn(async () => client) }, client };
}

describe("course material bundle import", () => {
  it("imports files and adds references to their course without replacing other course data", async () => {
    await createBundle();
    const { database, client } = createDatabase();
    await expect(importCourseMaterialBundle(database, directory)).resolves.toEqual({
      importedFiles: 1,
      linkedMaterials: 1,
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO elearning_material_files"),
      [id, "CTFL.jpg", content, content.byteLength],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("jsonb_set(course_data, '{materials}'"),
      ["course-id", JSON.stringify([material])],
    );
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("is idempotent when files and course references already exist", async () => {
    await createBundle();
    const { database, client } = createDatabase({ file_name: "CTFL.jpg", content });
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT file_name")) return { rows: [{ file_name: "CTFL.jpg", content }] };
      if (sql.startsWith("SELECT id, course_data")) return { rows: [{ id: "course-id", materials: [material] }] };
      return { rows: [] };
    });
    await expect(importCourseMaterialBundle(database, directory)).resolves.toEqual({
      importedFiles: 0,
      linkedMaterials: 0,
    });
    expect(client.query.mock.calls.some(([sql]) => String(sql).startsWith("INSERT") || String(sql).startsWith("UPDATE")))
      .toBe(false);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rolls back on a conflicting production file ID", async () => {
    await createBundle();
    const { database, client } = createDatabase({ file_name: "different.jpg", content });
    await expect(importCourseMaterialBundle(database, directory)).rejects.toThrow(/anderem Inhalt/);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rejects an altered asset before connecting to the database", async () => {
    await createBundle();
    await writeFile(join(directory, `${id}.jpg`), "tampered");
    const { database } = createDatabase();
    await expect(importCourseMaterialBundle(database, directory)).rejects.toThrow(/Manifest/);
    expect(database.connect).not.toHaveBeenCalled();
  });

  it("does not accept asset path traversal", async () => {
    await createBundle();
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
    manifest.files[0].assetFile = "../outside.jpg";
    await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
    const { database } = createDatabase();
    await expect(importCourseMaterialBundle(database, directory)).rejects.toThrow(/Dateiname/);
    expect(database.connect).not.toHaveBeenCalled();
  });
});
