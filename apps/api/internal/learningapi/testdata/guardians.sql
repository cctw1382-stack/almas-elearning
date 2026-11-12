INSERT INTO almas.users (id, issuer, subject) VALUES
    ('00000000-0000-4000-8000-000000000061', 'https://issuer-a.example.invalid', 'linked-guardian'),
    ('00000000-0000-4000-8000-000000000062', 'https://issuer-a.example.invalid', 'unlinked-guardian');
INSERT INTO almas.school_memberships (user_id, school_id, role) VALUES
    ('00000000-0000-4000-8000-000000000061', '00000000-0000-4000-8000-000000000011', 'guardian'),
    ('00000000-0000-4000-8000-000000000061', '00000000-0000-4000-8000-000000000012', 'guardian'),
    ('00000000-0000-4000-8000-000000000062', '00000000-0000-4000-8000-000000000011', 'guardian');
INSERT INTO almas.guardian_links (school_id, guardian_id, child_id) VALUES
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000061', '00000000-0000-4000-8000-000000000005');
