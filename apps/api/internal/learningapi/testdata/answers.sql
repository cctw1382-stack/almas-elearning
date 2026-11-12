INSERT INTO almas.exam_answers (school_id, exam_id, user_id, question_id, option_id)
SELECT school_id, exam_id, user_id,
       '00000000-0000-4000-8000-000000000051'::uuid,
       '00000000-0000-4000-8000-000000000052'::uuid
FROM almas.exam_attempts WHERE exam_id = '00000000-0000-4000-8000-000000000045';

UPDATE almas.exam_attempts SET revision = 1
WHERE exam_id = '00000000-0000-4000-8000-000000000045';
