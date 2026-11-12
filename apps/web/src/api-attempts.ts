import type { components } from '../../../contracts/generated/learning';
import { assert, isObject } from './data-validation.ts';

type Schemas = components['schemas'];
type ActiveAttempt = Schemas['ActiveAttempt'];
type SubmittedAttempt = Schemas['SubmittedAttempt'];
type AttemptState = ActiveAttempt | SubmittedAttempt;

export interface AsyncAttempts {
  start(examId: string, key: string): Promise<ActiveAttempt>;
  get(attemptId: string): Promise<AttemptState>;
  save(attemptId: string, questionId: string, answer: Schemas['AnswerWrite'], key: string): Promise<ActiveAttempt>;
  submit(attemptId: string, submission: Schemas['SubmitWrite'], key: string): Promise<SubmittedAttempt>;
}

function identifier(value: string): string {
  assert(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value), 'معرّف الاختبار غير صالح.');
  return value;
}

function attempt(value: unknown): AttemptState {
  assert(isObject(value) && typeof value.id === 'string' && typeof value.examId === 'string' &&
    (value.status === 'active' || value.status === 'submitted') && Number.isSafeInteger(value.deadline) &&
    Number.isSafeInteger(value.serverTime) && Number.isSafeInteger(value.revision) && Array.isArray(value.answers),
  'حالة المحاولة غير صالحة.');
  assert(value.answers.every(answer => isObject(answer) && typeof answer.questionId === 'string' &&
    typeof answer.optionId === 'string'), 'إجابات المحاولة غير صالحة.');
  if (value.status === 'submitted') {
    assert(Number.isSafeInteger(value.submittedAt) && Number.isSafeInteger(value.score) &&
      Number.isSafeInteger(value.total) && (value.reason === 'manual' || value.reason === 'timeout'),
    'نتيجة المحاولة غير صالحة.');
  }
  return value as AttemptState;
}

export class ApiAttempts implements AsyncAttempts {
  private scope: URL;
  private accessToken: () => string | Promise<string>;
  private transport: typeof fetch;

  constructor(base: URL, schoolId: string, accessToken: () => string | Promise<string>, transport: typeof fetch) {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    assert((base.protocol === 'https:' || (base.protocol === 'http:' && local)) &&
      !base.username && !base.password && !base.search && !base.hash, 'عنوان خدمة الاختبارات غير صالح.');
    const root = new URL(base.href.endsWith('/') ? base.href : base.href + '/');
    this.scope = new URL('schools/' + identifier(schoolId) + '/', root);
    this.accessToken = accessToken;
    this.transport = transport;
  }

  private async request(path: string, method: string, body?: Schemas['AnswerWrite'] | Schemas['SubmitWrite'], key?: string): Promise<AttemptState> {
    const token = await this.accessToken();
    assert(token && !/\s/.test(token), 'جلسة الطالب غير متاحة.');
    const headers = new Headers({ Accept: 'application/json', Authorization: 'Bearer ' + token });
    if (key !== undefined) headers.set('Idempotency-Key', identifier(key));
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    const response = await this.transport(new URL(path, this.scope), {
      method, headers, credentials: 'omit', cache: 'no-store', redirect: 'error',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    assert(response.ok, 'تعذر إتمام طلب المحاولة (' + response.status + ').');
    return attempt(await response.json());
  }

  async start(examId: string, key: string): Promise<ActiveAttempt> {
    const state = await this.request('exams/' + identifier(examId) + '/attempts', 'POST', undefined, key);
    assert(state.status === 'active', 'المحاولة غير نشطة.');
    return state;
  }

  get(attemptId: string): Promise<AttemptState> {
    return this.request('attempts/' + identifier(attemptId), 'GET');
  }

  async save(attemptId: string, questionId: string, answer: Schemas['AnswerWrite'], key: string): Promise<ActiveAttempt> {
    const state = await this.request('attempts/' + identifier(attemptId) + '/answers/' + identifier(questionId), 'PUT', answer, key);
    assert(state.status === 'active', 'المحاولة غير نشطة.');
    return state;
  }

  async submit(attemptId: string, submission: Schemas['SubmitWrite'], key: string): Promise<SubmittedAttempt> {
    const state = await this.request('attempts/' + identifier(attemptId) + '/submit', 'POST', submission, key);
    assert(state.status === 'submitted', 'النتيجة غير متاحة.');
    return state;
  }
}
