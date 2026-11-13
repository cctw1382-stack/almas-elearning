BEGIN;

ALTER TABLE almas.exam_attempts
    ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
    ADD COLUMN closed_at timestamptz CHECK (closed_at >= deadline);

ALTER TABLE almas.exam_start_keys RENAME TO exam_write_keys;
ALTER TABLE almas.exam_write_keys
    ADD COLUMN operation text NOT NULL DEFAULT 'start' CHECK (operation IN ('start', 'save_answer')),
    ADD COLUMN fingerprint text NOT NULL DEFAULT '',
    ADD COLUMN response jsonb CHECK (response IS NULL OR jsonb_typeof(response) = 'object'),
    ADD CHECK (
        (operation = 'start' AND fingerprint = '')
        OR (operation = 'save_answer' AND fingerprint ~ '^[0-9a-f]{64}$' AND response IS NOT NULL AND NOT created)
    );

CREATE TABLE almas.exam_answers (
    school_id uuid NOT NULL,
    exam_id uuid NOT NULL,
    user_id uuid NOT NULL,
    question_id uuid NOT NULL,
    option_id uuid NOT NULL,
    PRIMARY KEY (school_id, exam_id, user_id, question_id),
    FOREIGN KEY (school_id, exam_id, user_id)
        REFERENCES almas.exam_attempts(school_id, exam_id, user_id)
);

GRANT UPDATE (revision, closed_at) ON almas.exam_attempts TO almas_app;
CREATE POLICY own_attempt_update ON almas.exam_attempts FOR UPDATE TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.exam_assignments AS a
        JOIN almas.exams AS e ON e.school_id = a.school_id AND e.id = a.exam_id
        WHERE a.school_id = exam_attempts.school_id AND a.exam_id = exam_attempts.exam_id AND a.user_id = exam_attempts.user_id
    ));

GRANT SELECT, INSERT ON almas.exam_answers TO almas_app;
GRANT UPDATE (option_id) ON almas.exam_answers TO almas_app;
ALTER TABLE almas.exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.exam_answers FORCE ROW LEVEL SECURITY;
CREATE POLICY own_attempt_answer ON almas.exam_answers FOR ALL TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.exam_attempts AS a
        WHERE a.school_id = exam_answers.school_id AND a.exam_id = exam_answers.exam_id AND a.user_id = exam_answers.user_id
    ));

COMMIT;
