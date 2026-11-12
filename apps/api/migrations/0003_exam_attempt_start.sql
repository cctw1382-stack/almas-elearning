BEGIN;

ALTER TABLE almas.exams
    ADD COLUMN opens_at timestamptz,
    ADD COLUMN closes_at timestamptz,
    ADD CHECK (opens_at IS NULL OR closes_at IS NULL OR opens_at < closes_at);

CREATE TABLE almas.exam_attempts (
    school_id uuid NOT NULL,
    exam_id uuid NOT NULL,
    user_id uuid NOT NULL,
    id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    started_at timestamptz NOT NULL,
    deadline timestamptz NOT NULL CHECK (deadline > started_at),
    public_exam jsonb NOT NULL CHECK (jsonb_typeof(public_exam) = 'object'),
    PRIMARY KEY (school_id, exam_id, user_id),
    FOREIGN KEY (school_id, exam_id, user_id)
        REFERENCES almas.exam_assignments(school_id, exam_id, user_id)
);

CREATE TABLE almas.exam_start_keys (
    user_id uuid NOT NULL,
    key uuid NOT NULL,
    school_id uuid NOT NULL,
    exam_id uuid NOT NULL,
    created boolean NOT NULL,
    server_time timestamptz NOT NULL,
    PRIMARY KEY (user_id, key),
    FOREIGN KEY (school_id, exam_id, user_id)
        REFERENCES almas.exam_attempts(school_id, exam_id, user_id)
);
CREATE INDEX exam_start_keys_attempt_idx ON almas.exam_start_keys (school_id, exam_id, user_id);

GRANT SELECT, INSERT ON almas.exam_attempts, almas.exam_start_keys TO almas_app;

ALTER TABLE almas.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.exam_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY own_attempt_read ON almas.exam_attempts FOR SELECT TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.exam_assignments AS a
        WHERE a.school_id = exam_attempts.school_id AND a.exam_id = exam_attempts.exam_id AND a.user_id = exam_attempts.user_id
    ));
CREATE POLICY own_attempt_start ON almas.exam_attempts FOR INSERT TO almas_app
    WITH CHECK (EXISTS (
        SELECT 1 FROM almas.exam_assignments AS a
        JOIN almas.exams AS e ON e.school_id = a.school_id AND e.id = a.exam_id
        WHERE a.school_id = exam_attempts.school_id AND a.exam_id = exam_attempts.exam_id AND a.user_id = exam_attempts.user_id
    ));

ALTER TABLE almas.exam_start_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.exam_start_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY own_start_key ON almas.exam_start_keys FOR ALL TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.exam_attempts AS a
        WHERE a.school_id = exam_start_keys.school_id AND a.exam_id = exam_start_keys.exam_id AND a.user_id = exam_start_keys.user_id
    ));

COMMIT;
