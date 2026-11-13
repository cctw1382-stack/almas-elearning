INSERT INTO almas.users (id, issuer, subject) VALUES
    ('00000000-0000-4000-8000-000000000005', 'https://issuer-a.example.invalid', 'attempt-subject');
INSERT INTO almas.school_memberships (user_id, school_id, role) VALUES
    ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000011', 'student');

INSERT INTO almas.exams (school_id, id, title, duration_seconds, published, opens_at, closes_at) VALUES
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000041', 'Concurrent start', 600, true, NULL, NULL),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000042', 'Other assignment', 600, true, NULL, NULL),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000043', 'Closed window', 600, true, NULL, clock_timestamp() - interval '1 minute'),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000044', 'Future window', 600, true, clock_timestamp() + interval '1 hour', NULL),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000045', 'Expired attempt', 600, true, NULL, NULL),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000046', 'Short window', 21600, true, NULL, clock_timestamp() + interval '1 hour'),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000047', 'Answer writes', 600, true, NULL, NULL),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000048', 'Legacy receipt', 600, true, NULL, NULL);

INSERT INTO almas.exam_assignments (school_id, exam_id, user_id)
SELECT school_id, id, '00000000-0000-4000-8000-000000000005'::uuid
FROM almas.exams WHERE id BETWEEN '00000000-0000-4000-8000-000000000041'::uuid AND '00000000-0000-4000-8000-000000000048'::uuid;

INSERT INTO almas.exam_questions (school_id, exam_id, id, position, question_text)
SELECT school_id, exam_id, '00000000-0000-4000-8000-000000000051'::uuid, 1, 'Synthetic attempt question'
FROM almas.exam_assignments WHERE user_id = '00000000-0000-4000-8000-000000000005';

INSERT INTO almas.exam_options (school_id, exam_id, question_id, id, position, option_text)
SELECT school_id, exam_id, id, '00000000-0000-4000-8000-000000000052'::uuid, 1, 'First option'
FROM almas.exam_questions WHERE id = '00000000-0000-4000-8000-000000000051'
UNION ALL
SELECT school_id, exam_id, id, '00000000-0000-4000-8000-000000000053'::uuid, 2, 'Second option'
FROM almas.exam_questions WHERE id = '00000000-0000-4000-8000-000000000051';

INSERT INTO almas.exam_attempts (school_id, exam_id, user_id, started_at, deadline, public_exam)
SELECT school_id, exam_id, user_id, clock_timestamp() - interval '26 hours',
       clock_timestamp() - interval '25 hours', '{"questions":[]}'::jsonb
FROM almas.exam_assignments WHERE exam_id = '00000000-0000-4000-8000-000000000045';

INSERT INTO almas.exam_start_keys (user_id, key, school_id, exam_id, created, server_time)
SELECT user_id, '00000000-0000-4000-8000-000000000206'::uuid, school_id, exam_id, true, started_at
FROM almas.exam_attempts WHERE exam_id = '00000000-0000-4000-8000-000000000045';

WITH fixture_time AS (SELECT date_trunc('milliseconds', clock_timestamp()) - interval '30 seconds' AS started)
INSERT INTO almas.exam_attempts (school_id, exam_id, user_id, started_at, deadline, public_exam)
SELECT school_id, exam_id, user_id, started, started + interval '600 seconds',
       '{"id":"00000000-0000-4000-8000-000000000048","title":"Legacy receipt","durationSeconds":600,"questions":[{"id":"00000000-0000-4000-8000-000000000051","text":"Synthetic attempt question","options":[{"id":"00000000-0000-4000-8000-000000000052","text":"First option"},{"id":"00000000-0000-4000-8000-000000000053","text":"Second option"}]}]}'::jsonb
FROM almas.exam_assignments CROSS JOIN fixture_time
WHERE exam_id = '00000000-0000-4000-8000-000000000048';

INSERT INTO almas.exam_start_keys (user_id, key, school_id, exam_id, created, server_time)
SELECT user_id, '00000000-0000-4000-8000-000000000408'::uuid, school_id, exam_id, true, started_at
FROM almas.exam_attempts WHERE exam_id = '00000000-0000-4000-8000-000000000048';
