BEGIN;

ALTER TABLE almas.exam_options ADD COLUMN is_correct boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX exam_one_correct_option
    ON almas.exam_options (school_id, exam_id, question_id) WHERE is_correct;

ALTER TABLE almas.exam_attempts
    ADD COLUMN grading_key jsonb CHECK (jsonb_typeof(grading_key) = 'object'),
    ADD COLUMN submission jsonb CHECK (jsonb_typeof(submission) = 'object');
GRANT UPDATE (submission) ON almas.exam_attempts TO almas_app;

ALTER TABLE almas.exam_write_keys
    DROP CONSTRAINT exam_write_keys_operation_check,
    DROP CONSTRAINT exam_write_keys_check,
    ADD CHECK (operation IN ('start', 'save_answer', 'submit')),
    ADD CHECK (
        (operation = 'start' AND fingerprint = '')
        OR (operation IN ('save_answer', 'submit') AND fingerprint ~ '^[0-9a-f]{64}$' AND response IS NOT NULL AND NOT created)
    );

COMMIT;
