import { coursesData } from "@portal/shared";
import type { Course, CourseInput, LearningMaterial } from "@portal/shared";
import type { Pool } from "pg";

export type CourseRepository = {
  list(): Promise<Course[]>;
  findById(id: string): Promise<Course | null>;
  findBySlug(slug: string): Promise<Course | null>;
  create(course: Course): Promise<Course>;
  update(id: string, course: Course): Promise<Course | null>;
  delete(id: string): Promise<boolean>;
  importDefaults(): Promise<number>;
  createMaterialFile(fileName: string, content: Buffer): Promise<{ id: string; fileName: string; sizeBytes: number }>;
  readMaterialFile(id: string): Promise<{ fileName: string; content: Buffer } | null>;
  deleteMaterialFile(id: string): Promise<boolean>;
};

export function createCourseRepository(database: Pick<Pool, "query" | "connect">): CourseRepository {
  return {
    async list() {
      const result = await database.query<{ course: Course }>(
        "SELECT course_data AS course FROM elearning_courses ORDER BY sort_order, id",
      );
      return result.rows.map((row) => row.course);
    },
    async findById(id) {
      const result = await database.query<{ course: Course }>(
        "SELECT course_data AS course FROM elearning_courses WHERE id = $1",
        [id],
      );
      return result.rows[0]?.course ?? null;
    },
    async findBySlug(slug) {
      const result = await database.query<{ course: Course }>(
        "SELECT course_data AS course FROM elearning_courses WHERE slug = $1",
        [slug],
      );
      return result.rows[0]?.course ?? null;
    },
    async create(course) {
      const result = await database.query<{ course: Course }>(
        `INSERT INTO elearning_courses (id, slug, sort_order, course_data)
         VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) + 1 FROM elearning_courses), 0), $3)
         RETURNING course_data AS course`,
        [course.id, course.slug, course],
      );
      return result.rows[0].course;
    },
    async update(id, course) {
      const result = await database.query<{ course: Course }>(
        `UPDATE elearning_courses
         SET slug = $2, course_data = $3, updated_at = now()
         WHERE id = $1
         RETURNING course_data AS course`,
        [id, course.slug, course],
      );
      return result.rows[0]?.course ?? null;
    },
    async delete(id) {
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const selected = await client.query<{ course: Course }>(
          "SELECT course_data AS course FROM elearning_courses WHERE id = $1 FOR UPDATE",
          [id],
        );
        const course = selected.rows[0]?.course;
        if (!course) {
          await client.query("COMMIT");
          return false;
        }
        await client.query("DELETE FROM elearning_courses WHERE id = $1", [id]);
        const fileIds = course.materials
          .filter((material) => material.url.startsWith("/api/courses/materials/"))
          .map((material) => material.id);
        if (fileIds.length > 0) {
          await client.query(
            `DELETE FROM elearning_material_files
             WHERE id::text = ANY($1::text[])
               AND NOT EXISTS (
                 SELECT 1 FROM elearning_courses
                 WHERE course_data->'materials' @> jsonb_build_array(
                   jsonb_build_object('id', elearning_material_files.id::text)
                 )
               )`,
            [fileIds],
          );
        }
        await client.query("COMMIT");
        return true;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async importDefaults() {
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const state = await client.query<{ defaults_imported: boolean }>(
          "SELECT defaults_imported FROM elearning_catalog_state WHERE singleton = true FOR UPDATE",
        );
        if (state.rows[0]?.defaults_imported) {
          await client.query("COMMIT");
          return 0;
        }

        for (const [sortOrder, course] of coursesData.entries()) {
          await client.query(
            `INSERT INTO elearning_courses (id, slug, sort_order, course_data)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO NOTHING`,
            [course.id, course.slug, sortOrder, course],
          );
        }
        await client.query(
          "UPDATE elearning_catalog_state SET defaults_imported = true WHERE singleton = true",
        );
        await client.query("COMMIT");
        return coursesData.length;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async createMaterialFile(fileName, content) {
      const result = await database.query<{ id: string; file_name: string; size_bytes: number }>(
        `INSERT INTO elearning_material_files (file_name, content, size_bytes)
         VALUES ($1, $2, $3)
         RETURNING id, file_name, size_bytes`,
        [fileName, content, content.byteLength],
      );
      return {
        id: result.rows[0].id,
        fileName: result.rows[0].file_name,
        sizeBytes: result.rows[0].size_bytes,
      };
    },
    async readMaterialFile(id) {
      const result = await database.query<{ file_name: string; content: Buffer }>(
        "SELECT file_name, content FROM elearning_material_files WHERE id = $1",
        [id],
      );
      const file = result.rows[0];
      return file ? { fileName: file.file_name, content: file.content } : null;
    },
    async deleteMaterialFile(id) {
      const result = await database.query(
        `DELETE FROM elearning_material_files
         WHERE id = $1
           AND NOT EXISTS (
             SELECT 1 FROM elearning_courses
             WHERE course_data->'materials' @> jsonb_build_array(
               jsonb_build_object('id', $1::text)
             )
           )`,
        [id],
      );
      return result.rowCount === 1;
    },
  };
}

export type { CourseInput, LearningMaterial };
