import { MockRepository } from './mock-repository.js';

export interface DataRecord {
  id: string;
  name: string;
  [field: string]: unknown;
}

export interface LessonState {
  percent: number;
  seconds: number;
  notes: string;
  bookmark: number | null;
  checkpointAnswered: boolean;
}

export interface Attempt {
  examId: string;
  status: 'active' | 'submitted';
  deadline: number;
  answers: Record<string, number>;
  review: string[];
  current: number;
  score?: number;
  total?: number;
  submittedAt?: number;
  reason?: 'manual' | 'timeout';
}

export type PreviewScope = 'student' | 'teacher' | 'admin';

/** Local synchronous contract. A future network adapter needs an async contract. */
export interface Repository {
  readonly storageWarning: string;
  list(kind: string): DataRecord[];
  get(kind: string, id: string): DataRecord | null;
  save(kind: string, record: Partial<DataRecord>): DataRecord;
  remove(kind: string, id: string): boolean;
  getSetting(key: string, fallback?: unknown): unknown;
  setSetting(key: string, value: unknown): unknown;
  getLessonState(lessonId: string, scope?: PreviewScope): LessonState;
  saveLessonState(lessonId: string, patch: Partial<LessonState>, scope?: PreviewScope): LessonState;
  getAttempt(examId: string): Attempt | null;
  startAttempt(examId: string, now?: number, retake?: boolean): Attempt;
  saveAttempt(examId: string, patch: Partial<Pick<Attempt, 'answers' | 'review' | 'current'>>): Attempt;
  submitAttempt(examId: string, now?: number, reason?: 'manual' | 'timeout'): Attempt;
}

export const repository: Repository = new MockRepository();
