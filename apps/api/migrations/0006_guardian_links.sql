BEGIN;

CREATE TABLE almas.guardian_links (
    school_id uuid NOT NULL,
    guardian_id uuid NOT NULL,
    child_id uuid NOT NULL,
    guardian_role text GENERATED ALWAYS AS ('guardian'::text) STORED,
    child_role text GENERATED ALWAYS AS ('student'::text) STORED,
    PRIMARY KEY (school_id, guardian_id, child_id),
    CHECK (guardian_id <> child_id),
    FOREIGN KEY (guardian_id, school_id, guardian_role)
        REFERENCES almas.school_memberships (user_id, school_id, role) ON DELETE CASCADE,
    FOREIGN KEY (child_id, school_id, child_role)
        REFERENCES almas.school_memberships (user_id, school_id, role) ON DELETE CASCADE
);

GRANT SELECT (school_id, guardian_id, child_id) ON almas.guardian_links TO almas_app;
ALTER TABLE almas.guardian_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.guardian_links FORCE ROW LEVEL SECURITY;
CREATE POLICY own_guardian_links ON almas.guardian_links FOR SELECT TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.school_memberships AS m
        WHERE m.user_id = guardian_links.guardian_id
          AND m.school_id = guardian_links.school_id AND m.role = 'guardian'
    ));

COMMIT;
