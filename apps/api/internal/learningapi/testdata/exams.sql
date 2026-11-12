INSERT INTO almas.exams (school_id, id, title, duration_seconds, published) VALUES
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', 'Assigned exam', 600, true),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000022', 'Draft exam', 600, false),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000023', 'Unassigned exam', 600, true),
    ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000024', 'Foreign exam', 600, true);

INSERT INTO almas.exam_assignments (school_id, exam_id, user_id) VALUES
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000002');

INSERT INTO almas.exam_assignments (school_id, exam_id, user_id)
SELECT '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000021', id
FROM almas.users WHERE id = '00000000-0000-4000-8000-000000000004';

INSERT INTO almas.exam_questions (school_id, exam_id, id, position, question_text)
SELECT school_id, id, '00000000-0000-4000-8000-000000000031', 1, 'Synthetic question'
FROM almas.exams;

INSERT INTO almas.exam_options (school_id, exam_id, question_id, id, position, option_text)
SELECT school_id, exam_id, id, '00000000-0000-4000-8000-000000000032'::uuid, 1, 'First option'
FROM almas.exam_questions
UNION ALL
SELECT school_id, exam_id, id, '00000000-0000-4000-8000-000000000033'::uuid, 2, 'Second option'
FROM almas.exam_questions;
