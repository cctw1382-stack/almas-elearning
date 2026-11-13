BEGIN;

CREATE TABLE almas.lessons (
    school_id uuid NOT NULL REFERENCES almas.schools (id),
    id uuid NOT NULL,
    PRIMARY KEY (school_id, id)
);

CREATE TABLE almas.lesson_enrollments (
    school_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    user_id uuid NOT NULL,
    student_role text GENERATED ALWAYS AS ('student'::text) STORED,
    PRIMARY KEY (school_id, lesson_id, user_id),
    FOREIGN KEY (school_id, lesson_id) REFERENCES almas.lessons (school_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, school_id, student_role)
        REFERENCES almas.school_memberships (user_id, school_id, role) ON DELETE CASCADE
);

CREATE TABLE almas.media_assets (
    school_id uuid NOT NULL,
    id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    object_key text NOT NULL CHECK (object_key <> ''),
    content_type text NOT NULL CHECK (content_type IN (
        'video/mp4', 'video/mp2t', 'application/vnd.apple.mpegurl'
    )),
    PRIMARY KEY (school_id, id),
    FOREIGN KEY (school_id, lesson_id) REFERENCES almas.lessons (school_id, id) ON DELETE CASCADE
);

GRANT SELECT ON almas.lesson_enrollments, almas.media_assets TO almas_app;
ALTER TABLE almas.lesson_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.lesson_enrollments FORCE ROW LEVEL SECURITY;
CREATE POLICY own_lesson_enrollments ON almas.lesson_enrollments FOR SELECT TO almas_app
    USING (EXISTS (SELECT 1 FROM almas.users AS u WHERE u.id = lesson_enrollments.user_id));

ALTER TABLE almas.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.media_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY enrolled_media ON almas.media_assets FOR SELECT TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.lesson_enrollments AS e
        WHERE e.school_id = media_assets.school_id AND e.lesson_id = media_assets.lesson_id
    ));

COMMIT;
