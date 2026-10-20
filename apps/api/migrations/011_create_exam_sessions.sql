CREATE TABLE IF NOT EXISTS elearning_exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_snapshot jsonb NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'expired', 'aborted')),
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (60, 75)),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  finished_at timestamptz,
  result_data jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS elearning_exam_sessions_one_active_user
  ON elearning_exam_sessions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS elearning_exam_sessions_user_history
  ON elearning_exam_sessions(user_id, started_at DESC);
