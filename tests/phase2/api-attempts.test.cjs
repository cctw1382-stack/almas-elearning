const test = require('node:test');
const assert = require('node:assert/strict');
const { ApiAttempts } = require('../../apps/web/src/api-attempts.ts');

const ids = ['011', '021', '031', '041', '051', '061', '062', '063'].map(
  suffix => '00000000-0000-4000-8000-000000000' + suffix,
);
const [schoolId, examId, attemptId, questionId, optionId, saveKey, submitKey, startKey] = ids;

test('attempt provider resumes saved answers and obtains the timeout result from the server', async () => {
  const base = new URL('https://almas.example/api/v1/');
  let state = { id: attemptId, examId, status: 'active', revision: 0, deadline: 2000, serverTime: 1000, answers: [] };
  let now = 1000;
  const calls = [];
  const fetch = async (url, init) => {
    const headers = new Headers(init.headers);
    assert.equal(headers.get('Authorization'), 'Bearer fixture-token');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    calls.push([init.method, url.pathname, headers.get('Idempotency-Key'), init.body && JSON.parse(init.body)]);
    if (init.method === 'PUT') state = { ...state, revision: 1, answers: [{ questionId, optionId }] };
    if (now >= state.deadline) state = { ...state, status: 'submitted', submittedAt: now, reason: 'timeout', total: 2, score: 1 };
    return Response.json({ ...state, serverTime: now });
  };
  const provider = () => new ApiAttempts(base, schoolId, () => 'fixture-token', fetch);
  const first = provider();
  await first.start(examId, startKey);
  await first.save(attemptId, questionId, { optionId, expectedRevision: 0 }, saveKey);
  const refreshed = provider();
  assert.deepEqual((await refreshed.get(attemptId)).answers, [{ questionId, optionId }]);
  now = 2000;
  assert.equal((await refreshed.get(attemptId)).reason, 'timeout');
  assert.equal((await refreshed.submit(attemptId, { expectedRevision: 1 }, submitKey)).score, 1);
  const scope = '/api/v1/schools/' + schoolId;
  const attempt = scope + '/attempts/' + attemptId;
  assert.deepEqual(calls, [
    ['POST', scope + '/exams/' + examId + '/attempts', startKey, undefined],
    ['PUT', attempt + '/answers/' + questionId, saveKey, { optionId, expectedRevision: 0 }],
    ['GET', attempt, null, undefined],
    ['GET', attempt, null, undefined],
    ['POST', attempt + '/submit', submitKey, { expectedRevision: 1 }],
  ]);
});
