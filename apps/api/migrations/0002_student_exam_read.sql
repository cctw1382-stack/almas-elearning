BEGIN;

CREATE TABLE almas.exams (
    school_id uuid NOT NULL REFERENCES almas.schools(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 21600),
    published boolean NOT NULL DEFAULT false,
    PRIMARY KEY (school_id, id)
);

CREATE TABLE almas.exam_assignments (
    school_id uuid NOT NULL,
    exam_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES almas.users(id),
    PRIMARY KEY (school_id, exam_id, user_id),
    FOREIGN KEY (school_id, exam_id) REFERENCES almas.exams(school_id, id)
);
CREATE INDEX exam_assignments_user_idx ON almas.exam_assignments (user_id, school_id, exam_id);

CREATE TABLE almas.exam_questions (
    school_id uuid NOT NULL,
    exam_id uuid NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    position integer NOT NULL CHECK (position BETWEEN 1 AND 100),
    question_text text NOT NULL CHECK (char_length(question_text) BETWEEN 1 AND 2000),
    PRIMARY KEY (school_id, exam_id, id),
    UNIQUE (school_id, exam_id, position),
    FOREIGN KEY (school_id, exam_id) REFERENCES almas.exams(school_id, id)
);

CREATE TABLE almas.exam_options (
    school_id uuid NOT NULL,
    exam_id uuid NOT NULL,
    question_id uuid NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    position integer NOT NULL CHECK (position BETWEEN 1 AND 10),
    option_text text NOT NULL CHECK (char_length(option_text) BETWEEN 1 AND 500),
    PRIMARY KEY (school_id, exam_id, question_id, id),
    UNIQUE (school_id, exam_id, question_id, position),
    FOREIGN KEY (school_id, exam_id, question_id) REFERENCES almas.exam_questions(school_id, exam_id, id)
);

GRANT SELECT ON almas.exams, almas.exam_assignments, almas.exam_questions, almas.exam_options TO almas_app;
ALTER TABLE almas.exam_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.exam_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY assigned_student ON almas.exam_assignments FOR SELECT TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.school_memberships AS m
        WHERE m.user_id = exam_assignments.user_id
          AND m.school_id = exam_assignments.school_id AND m.role = 'student'
    ));

ALTER TABLE almas.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.exams FORCE ROW LEVEL SECURITY;
CREATE POLICY published_assigned_exam ON almas.exams FOR SELECT TO almas_app
    USING (published AND EXISTS (
        SELECT 1 FROM almas.exam_assignments AS a
        WHERE a.school_id = exams.school_id AND a.exam_id = exams.id
    ));

ALTER TABLE almas.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.exam_questions FORCE ROW LEVEL SECURITY;
CREATE POLICY visible_exam_questions ON almas.exam_questions FOR SELECT TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.exams AS e
        WHERE e.school_id = exam_questions.school_id AND e.id = exam_questions.exam_id
    ));

ALTER TABLE almas.exam_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.exam_options FORCE ROW LEVEL SECURITY;
CREATE POLICY visible_question_options ON almas.exam_options FOR SELECT TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.exam_questions AS q
        WHERE q.school_id = exam_options.school_id AND q.exam_id = exam_options.exam_id AND q.id = exam_options.question_id
    ));

COMMIT;
