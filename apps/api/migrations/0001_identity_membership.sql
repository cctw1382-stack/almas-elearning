BEGIN;

-- The deployment owner provisions the restricted almas_app role separately.
CREATE SCHEMA almas;

CREATE TABLE almas.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer text NOT NULL CHECK (issuer <> ''),
    subject text NOT NULL CHECK (subject <> ''),
    UNIQUE (issuer, subject)
);

CREATE TABLE almas.schools (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (name <> '')
);

CREATE TABLE almas.school_memberships (
    user_id uuid NOT NULL REFERENCES almas.users(id),
    school_id uuid NOT NULL REFERENCES almas.schools(id),
    role text NOT NULL CHECK (role IN ('student', 'teacher', 'guardian', 'school-admin')),
    PRIMARY KEY (user_id, school_id, role)
);
CREATE INDEX school_memberships_school_idx ON almas.school_memberships (school_id, user_id);

REVOKE ALL ON SCHEMA almas FROM PUBLIC;
GRANT USAGE ON SCHEMA almas TO almas_app;
GRANT SELECT ON almas.users, almas.school_memberships TO almas_app;

ALTER TABLE almas.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_self_read ON almas.users FOR SELECT TO almas_app
    USING (
        issuer = nullif(current_setting('almas.issuer', true), '')
        AND subject = nullif(current_setting('almas.subject', true), '')
    );

ALTER TABLE almas.school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE almas.school_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY memberships_self_read ON almas.school_memberships FOR SELECT TO almas_app
    USING (EXISTS (
        SELECT 1 FROM almas.users AS account
        WHERE account.id = school_memberships.user_id
    ));

COMMIT;
