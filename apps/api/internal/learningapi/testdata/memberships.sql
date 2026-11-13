INSERT INTO almas.schools (id, name) VALUES
    ('00000000-0000-4000-8000-000000000011', 'Synthetic school A'),
    ('00000000-0000-4000-8000-000000000012', 'Synthetic school B');

INSERT INTO almas.users (id, issuer, subject) VALUES
    ('00000000-0000-4000-8000-000000000001', 'https://issuer-a.example.invalid', 'shared-subject'),
    ('00000000-0000-4000-8000-000000000002', 'https://issuer-b.example.invalid', 'shared-subject'),
    ('00000000-0000-4000-8000-000000000003', 'https://issuer-a.example.invalid', 'no-school');

INSERT INTO almas.school_memberships (user_id, school_id, role) VALUES
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'student'),
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'teacher'),
    ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', 'guardian');

\if :{?oidc_issuer}
INSERT INTO almas.users (id, issuer, subject) VALUES
    ('00000000-0000-4000-8000-000000000004', :'oidc_issuer', '00000000-0000-4000-8000-000000000014');
INSERT INTO almas.school_memberships (user_id, school_id, role) VALUES
    ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000011', 'student');
\endif
