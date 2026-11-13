BEGIN;
CREATE TABLE almas.lesson_owners (
    school_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    teacher_role text GENERATED ALWAYS AS ('teacher'::text) STORED,
    PRIMARY KEY (school_id, lesson_id),
    FOREIGN KEY (school_id, lesson_id) REFERENCES almas.lessons (school_id, id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id, school_id, teacher_role)
        REFERENCES almas.school_memberships (user_id, school_id, role) ON DELETE CASCADE
);
GRANT SELECT ON almas.lesson_owners TO almas_app;
ALTER TABLE almas.lesson_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.lesson_owners FORCE ROW LEVEL SECURITY;
CREATE POLICY own_lessons ON almas.lesson_owners FOR SELECT TO almas_app
    USING (EXISTS (SELECT 1 FROM almas.users AS u WHERE u.id = teacher_id));
COMMIT;
