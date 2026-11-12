INSERT INTO almas.exam_answers (school_id, exam_id, user_id, question_id, option_id)
SELECT school_id, exam_id, user_id,
       '00000000-0000-4000-8000-000000000051'::uuid,
       '00000000-0000-4000-8000-000000000052'::uuid
FROM almas.exam_attempts WHERE exam_id = '00000000-0000-4000-8000-000000000045';

UPDATE almas.exam_attempts SET revision = 1
WHERE exam_id = '00000000-0000-4000-8000-000000000045';

UPDATE almas.exam_options SET is_correct = true
WHERE exam_id = '00000000-0000-4000-8000-000000000021'
  AND id = '00000000-0000-4000-8000-000000000032';
UPDATE almas.exam_options SET is_correct = true
WHERE exam_id = '00000000-0000-4000-8000-000000000047'
  AND id = '00000000-0000-4000-8000-000000000052';

-- Simulate the exam author changing the correct option after attempt 48 began.
UPDATE almas.exam_questions SET question_text = 'Edited live question'
WHERE exam_id = '00000000-0000-4000-8000-000000000048';
UPDATE almas.exam_attempts SET grading_key =
    '{"00000000-0000-4000-8000-000000000051":"00000000-0000-4000-8000-000000000052"}'
WHERE exam_id = '00000000-0000-4000-8000-000000000048';
UPDATE almas.exam_options SET is_correct = true
WHERE exam_id = '00000000-0000-4000-8000-000000000048'
  AND id = '00000000-0000-4000-8000-000000000053';

INSERT INTO almas.exams (school_id, id, title, duration_seconds, published)
SELECT school_id, '00000000-0000-4000-8000-000000000049', 'Expired without answers', 600, true
FROM almas.exams WHERE id = '00000000-0000-4000-8000-000000000048';
INSERT INTO almas.exam_assignments (school_id, exam_id, user_id)
SELECT school_id, '00000000-0000-4000-8000-000000000049', user_id
FROM almas.exam_attempts WHERE exam_id = '00000000-0000-4000-8000-000000000048';
INSERT INTO almas.exam_attempts (school_id, exam_id, user_id, started_at, deadline, public_exam, grading_key)
SELECT school_id, '00000000-0000-4000-8000-000000000049', user_id,
       clock_timestamp() - interval '1 hour', clock_timestamp() - interval '50 minutes',
       jsonb_set(public_exam, '{id}', '"00000000-0000-4000-8000-000000000049"'), grading_key
FROM almas.exam_attempts WHERE exam_id = '00000000-0000-4000-8000-000000000048';
