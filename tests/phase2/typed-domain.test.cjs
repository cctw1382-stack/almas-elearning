const test = require('node:test');
const assert = require('node:assert/strict');
const { assertJson, isSafeKey } = require('../../apps/web/src/data-validation.ts');
const { validateLessonState, mergeLessonState } = require('../../apps/web/src/lesson-state.ts');
const { validateRecord } = require('../../apps/web/src/record-validation.ts');

test('record validation enforces question choices and references to existing students and subjects', () => {
  const data = { collections: { subjects: [{ id: 's1', name: 'علوم' }], students: [{ id: 'u1', name: 'طالب' }], children: [] } };
  const exam = { id: 'e1', name: 'اختبار', subjectId: 's1', studentIds: ['u1'], duration: 300,
    questions: [{ id: 'q1', text: 'سؤال', options: ['أ', 'ب'], correct: 0 }] };
  assert.doesNotThrow(() => validateRecord('exams', exam, data));
  for (const patch of [{ subjectId: 'missing' }, { studentIds: ['missing'] }, { studentIds: ['u1', 'u1'] },
    { duration: '300' }, { questions: [{ ...exam.questions[0], correct: 2 }] },
    { questions: [exam.questions[0], exam.questions[0]] }]) {
    assert.throws(() => validateRecord('exams', { ...exam, ...patch }, data));
  }
  assert.throws(() => validateRecord('assignments', { id: 'a1', name: 'واجب', subjectId: 's1', submissions: { missing: 'إجابتي' } }, data));
});

test('JSON boundary rejects unsafe keys, cycles, nonfinite values and excessive nesting', () => {
  for (const value of [JSON.parse('{"__proto__":{}}'), NaN, Infinity, undefined, () => {}, new Date()]) {
    assert.throws(() => assertJson(value));
  }
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => assertJson(cyclic));
  let deep = {}; for (let i = 0; i < 31; i++) deep = { child: deep };
  assert.throws(() => assertJson(deep));
  const shared = { value: 'عربي' };
  assert.doesNotThrow(() => assertJson({ first: shared, second: shared, list: [null, true, 3] }));
  assert.equal(isSafeKey('constructor'), false);
  assert.equal(isSafeKey('lesson-1'), true);
});

test('lesson updates preserve earlier fields and detach the resulting state', () => {
  const current = { percent: 50, seconds: 12, notes: 'ملاحظاتي', bookmark: 5, checkpointAnswered: true };
  const updated = mergeLessonState(current, { notes: 'ملاحظة جديدة' });
  assert.deepEqual(updated, { ...current, notes: 'ملاحظة جديدة' });
  updated.percent = 100;
  assert.equal(current.percent, 50);
  assert.equal(current.notes, 'ملاحظاتي');
});

test('lesson boundary refuses invalid patches and never changes the original state', () => {
  const current = { percent: 0, seconds: 0, notes: '', bookmark: null, checkpointAnswered: false };
  for (const patch of [{ percent: 101 }, { seconds: -1 }, { notes: 'x'.repeat(10001) },
    { bookmark: Infinity }, { checkpointAnswered: 1 }, { role: 'admin' }, null, []]) {
    assert.throws(() => mergeLessonState(current, patch));
  }
  assert.deepEqual(current, { percent: 0, seconds: 0, notes: '', bookmark: null, checkpointAnswered: false });
  assert.doesNotThrow(() => validateLessonState({ ...current, percent: 100, seconds: 8640000, bookmark: 8640000 }));
});
