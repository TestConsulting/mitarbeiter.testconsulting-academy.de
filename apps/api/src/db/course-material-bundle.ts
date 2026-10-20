import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { LearningMaterial } from "@portal/shared";
import type { Pool } from "pg";
import { z } from "zod";

const maxMaterialSize = 25 * 1024 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const supportedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp"]);

type MaterialBundleEntry = {
  id: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  assetFile: string;
  references: { courseSlug: string; material: LearningMaterial }[];
};

type MaterialBundle = { version: 1; files: MaterialBundleEntry[] };

const materialReferenceSchema = z.object({
  courseSlug: z.string().regex(/^[a-z0-9-]+$/),
  material: z.object({
    id: z.string(),
    title: z.string(),
    fileName: z.string(),
    fileSize: z.string().optional(),
    url: z.string(),
  }).strict(),
}).strict();

const materialBundleSchema = z.object({
  version: z.literal(1),
  files: z.array(z.object({
    id: z.string().regex(uuidPattern),
    fileName: z.string().min(1).max(255).refine((name) => !name.includes("/") && !name.includes("\\")),
    sizeBytes: z.number().int().min(1).max(maxMaterialSize),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    assetFile: z.string(),
    references: z.array(materialReferenceSchema),
  }).strict()),
}).strict();

function sha256(content: Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

function assetFileName(id: string, fileName: string) {
  const extension = extname(fileName).toLowerCase();
  if (!supportedExtensions.has(extension)) throw new Error(`Nicht unterstützter Materialdateityp: ${fileName}`);
  return `${id}${extension}`;
}

function parseBundle(value: unknown): MaterialBundle {
  const bundle = materialBundleSchema.parse(value);
  const ids = new Set<string>();
  for (const entry of bundle.files) {
    if (ids.has(entry.id)) throw new Error(`Doppelte Material-ID im Bundle: ${entry.id}`);
    ids.add(entry.id);
    if (entry.assetFile !== assetFileName(entry.id, entry.fileName)) {
      throw new Error(`Ungültiger Dateiname im Lernmaterial-Bundle: ${entry.assetFile}`);
    }
    for (const reference of entry.references) {
      if (reference.material.id !== entry.id ||
          reference.material.fileName !== entry.fileName ||
          reference.material.url !== `/api/courses/materials/${entry.id}/download`) {
        throw new Error(`Ungültige Kurszuordnung für Lernmaterial ${entry.id}.`);
      }
    }
  }
  return bundle;
}

export async function exportCourseMaterialBundle(
  database: Pick<Pool, "query">,
  bundleDirectory: string,
) {
  const [courses, files] = await Promise.all([
    database.query<{ slug: string; materials: LearningMaterial[] }>(
      "SELECT slug, course_data->'materials' AS materials FROM elearning_courses ORDER BY slug",
    ),
    database.query<{ id: string; file_name: string; content: Buffer; size_bytes: number }>(
      "SELECT id::text AS id, file_name, content, size_bytes FROM elearning_material_files ORDER BY id",
    ),
  ]);
  const references = new Map<string, MaterialBundleEntry["references"]>();
  for (const course of courses.rows) {
    for (const material of course.materials ?? []) {
      const matches = /^\/api\/courses\/materials\/([0-9a-f-]+)\/download$/i.exec(material.url);
      if (!matches) continue;
      const id = matches[1];
      const courseReferences = references.get(id) ?? [];
      courseReferences.push({ courseSlug: course.slug, material });
      references.set(id, courseReferences);
    }
  }

  await mkdir(bundleDirectory, { recursive: true });
  const entries: MaterialBundleEntry[] = [];
  for (const file of files.rows) {
    if (!uuidPattern.test(file.id) || file.file_name.length > 255 ||
        file.size_bytes !== file.content.byteLength || file.size_bytes > maxMaterialSize) {
      throw new Error(`Ungültige hochgeladene Materialdatei in der Datenbank: ${file.file_name}`);
    }
    const assetFile = assetFileName(file.id, file.file_name);
    await writeFile(join(bundleDirectory, assetFile), file.content);
    entries.push({
      id: file.id,
      fileName: file.file_name,
      sizeBytes: file.size_bytes,
      sha256: sha256(file.content),
      assetFile,
      references: references.get(file.id) ?? [],
    });
  }
  const manifest: MaterialBundle = { version: 1, files: entries };
  await writeFile(join(bundleDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { fileCount: entries.length, referenceCount: entries.reduce((count, entry) => count + entry.references.length, 0) };
}

export async function importCourseMaterialBundle(
  database: Pick<Pool, "connect">,
  bundleDirectory: string,
) {
  const rawManifest: unknown = JSON.parse(await readFile(join(bundleDirectory, "manifest.json"), "utf8"));
  const bundle = parseBundle(rawManifest);
  const materials = await Promise.all(bundle.files.map(async (entry) => {
    const content = await readFile(join(bundleDirectory, entry.assetFile));
    if (content.byteLength !== entry.sizeBytes || sha256(content) !== entry.sha256) {
      throw new Error(`Lernmaterial ${entry.fileName} stimmt nicht mit dem Manifest überein.`);
    }
    return { entry, content };
  }));

  const client = await database.connect();
  let importedFiles = 0;
  let linkedMaterials = 0;
  try {
    await client.query("BEGIN");
    for (const { entry, content } of materials) {
      const existing = await client.query<{ file_name: string; content: Buffer }>(
        "SELECT file_name, content FROM elearning_material_files WHERE id = $1 FOR UPDATE",
        [entry.id],
      );
      const file = existing.rows[0];
      if (file) {
        if (file.file_name !== entry.fileName || sha256(file.content) !== entry.sha256) {
          throw new Error(`Material-ID ${entry.id} existiert in Produktion mit anderem Inhalt.`);
        }
      } else {
        await client.query(
          `INSERT INTO elearning_material_files (id, file_name, content, size_bytes)
           VALUES ($1, $2, $3, $4)`,
          [entry.id, entry.fileName, content, entry.sizeBytes],
        );
        importedFiles++;
      }
    }

    const courseReferences = new Map<string, LearningMaterial[]>();
    for (const entry of bundle.files) {
      for (const reference of entry.references) {
        const courseMaterials = courseReferences.get(reference.courseSlug) ?? [];
        courseMaterials.push(reference.material);
        courseReferences.set(reference.courseSlug, courseMaterials);
      }
    }
    for (const [slug, materialsToAdd] of [...courseReferences].sort(([left], [right]) => left.localeCompare(right))) {
      const selected = await client.query<{ id: string; materials: LearningMaterial[] }>(
        "SELECT id, course_data->'materials' AS materials FROM elearning_courses WHERE slug = $1 FOR UPDATE",
        [slug],
      );
      const course = selected.rows[0];
      if (!course) throw new Error(`Kurs ${slug} wurde in Produktion nicht gefunden.`);
      const currentMaterials = course.materials ?? [];
      const additions: LearningMaterial[] = [];
      for (const material of materialsToAdd) {
        const existing = currentMaterials.find((item) => item.id === material.id) ??
          additions.find((item) => item.id === material.id);
        if (existing) {
          if (!isDeepStrictEqual(existing, material)) {
            throw new Error(`Material ${material.id} ist im Kurs ${slug} anders konfiguriert.`);
          }
        } else {
          additions.push(material);
        }
      }
      if (additions.length > 0) {
        await client.query(
          `UPDATE elearning_courses
           SET course_data = jsonb_set(course_data, '{materials}', $2::jsonb), updated_at = now()
           WHERE id = $1`,
          [course.id, JSON.stringify([...currentMaterials, ...additions])],
        );
        linkedMaterials += additions.length;
      }
    }
    await client.query("COMMIT");
    return { importedFiles, linkedMaterials };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
