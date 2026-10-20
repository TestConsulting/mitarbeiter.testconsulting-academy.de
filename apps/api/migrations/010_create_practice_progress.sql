CREATE TABLE IF NOT EXISTS elearning_practice_progress (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES elearning_courses (id) ON DELETE CASCADE,
  question_id text NOT NULL,
  question_fingerprint text NOT NULL,
  last_correct boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id, question_id)
);
