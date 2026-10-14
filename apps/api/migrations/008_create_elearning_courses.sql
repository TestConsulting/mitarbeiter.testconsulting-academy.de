CREATE TABLE IF NOT EXISTS elearning_courses (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  course_data jsonb NOT NULL CHECK (jsonb_typeof(course_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elearning_material_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  content bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elearning_catalog_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  defaults_imported boolean NOT NULL DEFAULT false
);

INSERT INTO elearning_catalog_state (singleton, defaults_imported)
VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;

CREATE INDEX IF NOT EXISTS elearning_courses_sort_order_idx
  ON elearning_courses (sort_order, id);
