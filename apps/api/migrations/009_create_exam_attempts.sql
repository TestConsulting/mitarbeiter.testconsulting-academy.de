CREATE TABLE IF NOT EXISTS elearning_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id text NOT NULL,
  course_slug text NOT NULL,
  course_title text NOT NULL,
  percentage integer NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  passed boolean NOT NULL,
  correct_count integer NOT NULL CHECK (correct_count >= 0),
  total_questions integer NOT NULL CHECK (total_questions > 0),
  result_data jsonb NOT NULL CHECK (jsonb_typeof(result_data) = 'object'),
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS elearning_exam_attempts_user_submitted_idx
  ON elearning_exam_attempts (user_id, submitted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS elearning_exam_attempts_user_course_idx
  ON elearning_exam_attempts (user_id, course_id, percentage DESC);
