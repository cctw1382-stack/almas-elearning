import type { Attempt } from './repository.ts';

type SubmissionReason = 'manual' | 'timeout';
type GradedQuestion = { id: string; correct: number };

export function createAttempt(examId: string, durationSeconds: number, now: number): Attempt {
  return {
    examId,
    status: 'active',
    deadline: now + durationSeconds * 1000,
    answers: {},
    review: [],
    current: 0,
  };
}

export function gradeAttempt(
  current: Attempt,
  questions: readonly GradedQuestion[],
  now: number,
  reason: SubmissionReason,
): Attempt {
  let score = 0;
  for (const question of questions) {
    if (current.answers[question.id] === question.correct) score++;
  }
  return {
    ...current,
    status: 'submitted',
    score,
    total: questions.length,
    submittedAt: now,
    reason: now >= current.deadline ? 'timeout' : reason,
  };
}
