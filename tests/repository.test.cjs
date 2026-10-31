const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const key = 'almas-demo-v1';
function storage(seed) {
  const values = new Map(seed ? [[key, seed]] : []);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}
function boot(localStorage = storage(), now = 1700000000000) {
  const html = fs.readFileSync(path.join(root, 'prototype', 'index.html'), 'utf8');
  const match = html.match(/\/\/ REPOSITORY START\r?\n([\s\S]*?)\/\/ REPOSITORY END/);
  assert.ok(match, 'The shipped HTML must contain the repository source markers');
  const source = match[1];
  class Clock extends Date { static now() { return now; } }
  const context = vm.createContext({ localStorage, Date: Clock });
  vm.runInContext(source + '\n;globalThis.exportsForTest = { MockRepository: typeof MockRepository === "function" ? MockRepository : undefined, repository: typeof repository === "object" ? repository : undefined };', context);
  assert.equal(typeof context.exportsForTest.MockRepository, 'function', 'MockRepository must expose the local data API');
  return { ...context.exportsForTest, context, localStorage };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('seed provides all role collections with string ids and detached nested reads', () => {
  const { repository: repo } = boot();
  const kinds = ['subjects', 'lessons', 'exams', 'assignments', 'students', 'children', 'attendance', 'users', 'schools', 'classes', 'subscriptions', 'payments', 'providers', 'permissions', 'messages', 'notifications', 'audit'];
  for (const kind of kinds) {
    const items = repo.list(kind);
    assert.ok(items.length, kind);
    assert.ok(items.every(item => typeof item.id === 'string' && item.name), kind);
  }
  const lessons = repo.list('lessons');
  lessons[0].checkpoint.options[0] = 'changed outside repository';
  lessons.pop();
  assert.equal(repo.list('lessons').length, 4);
  assert.notEqual(repo.get('lessons', 'l1').checkpoint.options[0], 'changed outside repository');
  const exam = repo.get('exams', 'e1');
  exam.questions[0].correct = 2;
  assert.equal(repo.get('exams', 'e1').questions[0].correct, 0);
  assert.equal(repo.get('subjects', 'missing'), null);
});

test('CRUD persists and records each collection mutation without audit recursion', () => {
  const localStorage = storage();
  const { repository: repo, MockRepository } = boot(localStorage);
  const auditBefore = repo.list('audit').length;
  const saved = repo.save('subjects', { name: 'التاريخ', teacher: 'معلم تجريبي', detail: 'وحدة جديدة', status: 'نشط' });
  assert.equal(typeof saved.id, 'string');
  saved.name = 'external change';
  assert.equal(repo.get('subjects', saved.id).name, 'التاريخ');
  repo.save('subjects', { id: saved.id, name: 'التاريخ الحديث' });
  assert.equal(repo.get('subjects', saved.id).teacher, 'معلم تجريبي');
  assert.equal(new MockRepository().get('subjects', saved.id).name, 'التاريخ الحديث');
  assert.equal(repo.remove('subjects', saved.id), true);
  assert.equal(repo.remove('subjects', saved.id), false);
  assert.equal(new MockRepository().get('subjects', saved.id), null);
  assert.equal(repo.list('audit').length, auditBefore + 3);
  assert.equal(repo.list('audit').at(-1).detail.includes(saved.id), true);
});

test('referenced subjects cannot be deleted and invalid CRUD writes leave data intact', () => {
  const { repository: repo } = boot();
  assert.throws(() => repo.remove('subjects', 's1'), /مرتبط|دروس|اختبارات|واجبات/);
  assert.ok(repo.get('subjects', 's1'));
  assert.throws(() => repo.list('__proto__'), /مجموعة|نوع|غير/);
  assert.throws(() => repo.save('users', { name: '   ' }), /اسم|الاسم/);
  assert.throws(() => repo.save('users', { name: 'أ'.repeat(121) }), /120|طويل/);
  assert.throws(() => repo.save('users', { name: 'اسم', detail: 'أ'.repeat(2001) }), /2000|طويل/);
  assert.throws(() => repo.save('lessons', { name: 'درس', subjectId: 'absent', duration: '18 دقيقة', status: 'نشط', checkpoint: { text: 'سؤال', options: ['أ', 'ب'], correct: 0 } }), /مادة|مرتبط/);
  assert.throws(() => repo.save('students', { name: 'طالب', grade: 150, progress: 10 }), /درجة|نسبة|100/);
  assert.throws(() => repo.save('exams', { name: 'اختبار', subjectId: 's1', duration: -3, status: 'نشط', questions: [] }), /مدة|أسئلة|اختبار/);
});

test('settings persist detached JSON values and reject non-JSON or unsafe values', () => {
  const { repository: repo, MockRepository } = boot();
  assert.equal(repo.getSetting('selectedChild', 'c2'), 'c1');
  assert.equal(repo.getSetting('missing', 'fallback'), 'fallback');
  const settings = { theme: 'dark', nested: ['a'] };
  repo.setSetting('ui', settings);
  settings.nested.push('outside');
  const read = repo.getSetting('ui');
  read.nested.push('read mutation');
  assert.deepEqual(plain(new MockRepository().getSetting('ui')), { theme: 'dark', nested: ['a'] });
  assert.throws(() => repo.setSetting('__proto__', {}), /مفتاح|غير/);
  assert.throws(() => repo.setSetting('invalid', Infinity), /قيمة|بيانات|صالح/);
});

test('assignment and exam student allocations persist and reject duplicate or unknown students', () => {
  const { repository: repo, MockRepository } = boot();
  assert.ok(Array.isArray(repo.get('assignments', 'a1').studentIds), 'Seeded content must identify its allocated students');
  assert.deepEqual(plain(repo.get('assignments', 'a1').studentIds), ['u1']);
  assert.deepEqual(plain(repo.get('assignments', 'a2').studentIds), ['u4']);
  assert.deepEqual(plain(repo.get('exams', 'e1').studentIds), ['u1']);
  const assignment = repo.save('assignments', { name: 'واجب مخصص', subjectId: 's1', studentIds: ['u2', 'u3'] });
  assignment.studentIds.push('u4');
  assert.deepEqual(plain(new MockRepository().get('assignments', assignment.id).studentIds), ['u2', 'u3']);
  for (const kind of ['assignments', 'exams']) {
    const record = kind === 'exams' ? { ...repo.get('exams', 'e1'), id: 'new-exam' } : { name: 'واجب', subjectId: 's1' };
    for (const studentIds of [['absent'], ['u2', 'u2'], [1], 'u2']) {
      assert.throws(() => repo.save(kind, { ...record, studentIds }), /طلاب|طالب|معرّف|مكرر|قائمة/);
    }
    delete record.studentIds;
    assert.ok(repo.save(kind, record).id, 'studentIds remains optional');
  }
});

test('students referenced by assignment or exam allocations cannot be deleted', () => {
  const { repository: repo } = boot();
  const assignment = repo.save('assignments', { name: 'واجب طالب', subjectId: 's1', studentIds: ['u2'] });
  const exam = repo.save('exams', { ...repo.get('exams', 'e1'), id: 'allocated-exam', studentIds: ['u3'] });
  assert.throws(() => repo.remove('students', 'u2'), /مرتبط|واجب|طالب/);
  assert.throws(() => repo.remove('students', 'u3'), /مرتبط|اختبار|طالب/);
  assert.ok(repo.get('students', 'u2'));
  assert.ok(repo.get('students', 'u3'));
  repo.remove('assignments', assignment.id);
  repo.remove('exams', exam.id);
  assert.equal(repo.remove('students', 'u2'), true);
  assert.equal(repo.remove('students', 'u3'), true);
});

test('lesson progress, notes, checkpoints, and bookmarks persist independently', () => {
  const { repository: repo, MockRepository } = boot();
  assert.deepEqual(plain(repo.getLessonState('l1')), { percent: 0, seconds: 0, notes: '', bookmark: null, checkpointAnswered: false });
  repo.saveLessonState('l1', { percent: 60, seconds: 108, notes: 'ملاحظة أولى', bookmark: 90, checkpointAnswered: true });
  repo.saveLessonState('l2', { percent: 20, seconds: 22, notes: 'ملاحظة ثانية' });
  repo.saveLessonState('l1', { notes: 'تحديث الملاحظة' });
  const restored = new MockRepository();
  assert.deepEqual(plain(restored.getLessonState('l1')), { percent: 60, seconds: 108, notes: 'تحديث الملاحظة', bookmark: 90, checkpointAnswered: true });
  assert.equal(restored.getLessonState('l2').percent, 20);
  assert.equal(restored.getLessonState('l2').notes, 'ملاحظة ثانية');
  assert.equal(restored.getLessonState('l2').bookmark, null);
  assert.throws(() => repo.saveLessonState('l1', { percent: 101 }), /تقدم|نسبة|100/);
  assert.throws(() => repo.saveLessonState('l1', { seconds: -1 }), /وقت|ثوان|زمن/);
  assert.throws(() => repo.saveLessonState('l1', { bookmark: 'not a time' }), /علامة|وقت/);
});

test('an active exam deadline and answers survive reconstruction without extending time', () => {
  const { repository: repo, MockRepository } = boot();
  assert.equal(repo.getAttempt('e1'), null);
  const attempt = repo.startAttempt('e1', 1700000000000);
  assert.equal(attempt.status, 'active');
  assert.equal(attempt.deadline, 1700000300000);
  repo.saveAttempt('e1', { answers: { q1: 0, q2: 1 }, review: ['q3'], current: 2 });
  const restored = new MockRepository();
  const secondStart = restored.startAttempt('e1', 1700000020000);
  assert.equal(secondStart.deadline, 1700000300000);
  assert.deepEqual(plain(secondStart.answers), { q1: 0, q2: 1 });
  assert.deepEqual(plain(secondStart.review), ['q3']);
  assert.equal(secondStart.current, 2);
  secondStart.answers.q1 = 2;
  assert.equal(restored.getAttempt('e1').answers.q1, 0);
  assert.throws(() => repo.saveAttempt('e1', { deadline: 1700090000000 }), /محاولة|مسموح|وقت/);
  assert.throws(() => repo.saveAttempt('e1', { answers: { q1: 20 } }), /إجابة|خيار/);
});

test('teacher and admin video previews keep independent state without changing student progress', () => {
  const localStorage = storage();
  const { repository: repo, MockRepository } = boot(localStorage);
  repo.saveLessonState('l1', { percent: 25, seconds: 18, notes: 'ملاحظات الطالب', bookmark: 12 });
  repo.saveLessonState('l1', { percent: 75, seconds: 54, notes: 'معاينة المعلم', checkpointAnswered: true }, 'teacher');
  repo.saveLessonState('l1', { percent: 50, seconds: 36, notes: 'معاينة الإدارة', bookmark: 30 }, 'admin');
  const restored = new MockRepository();
  assert.deepEqual(plain(restored.getLessonState('l1')), { percent: 25, seconds: 18, notes: 'ملاحظات الطالب', bookmark: 12, checkpointAnswered: false });
  assert.deepEqual(plain(restored.getLessonState('l1', 'student')), plain(restored.getLessonState('l1')));
  assert.deepEqual(plain(restored.getLessonState('l1', 'teacher')), { percent: 75, seconds: 54, notes: 'معاينة المعلم', bookmark: null, checkpointAnswered: true });
  assert.deepEqual(plain(restored.getLessonState('l1', 'admin')), { percent: 50, seconds: 36, notes: 'معاينة الإدارة', bookmark: 30, checkpointAnswered: false });
  restored.saveLessonState('l2', { notes: 'معاينة درس ثان' }, 'teacher');
  assert.equal(restored.getLessonState('l2').notes, '');
  assert.equal(restored.getLessonState('l1', 'teacher').notes, 'معاينة المعلم');
  assert.throws(() => repo.getLessonState('l1', 'parent'), /نطاق|دور|غير/);
  assert.throws(() => repo.saveLessonState('l1', { percent: 100 }, '__proto__'), /نطاق|دور|غير/);
  const payload = JSON.parse(localStorage.getItem(key));
  assert.equal(payload.lessonStates.l1.notes, 'ملاحظات الطالب');
  assert.equal(payload.lessonStates['teacher:l1'].notes, 'معاينة المعلم');
  assert.equal(payload.lessonStates['admin:l1'].notes, 'معاينة الإدارة');
});

test('manual exam submission scores known answers and submitted attempts are immutable', () => {
  const { repository: repo, MockRepository } = boot();
  repo.startAttempt('e1', 1700000000000);
  repo.saveAttempt('e1', { answers: { q1: 0, q2: 0, q3: 0 } });
  const result = repo.submitAttempt('e1', 1700000010000);
  assert.equal(result.status, 'submitted');
  assert.equal(result.score, 2);
  assert.equal(result.total, 3);
  assert.equal(result.reason, 'manual');
  assert.equal(result.submittedAt, 1700000010000);
  repo.saveAttempt('e1', { answers: { q1: 1 } });
  repo.submitAttempt('e1', 1700000015000, 'timeout');
  repo.startAttempt('e1', 1700000020000);
  assert.deepEqual(plain(new MockRepository().getAttempt('e1')), plain(result));
});

test('expired attempts submit automatically on read and remain persisted', () => {
  const localStorage = storage();
  const { repository: repo } = boot(localStorage);
  repo.startAttempt('e1', 1700000000000);
  repo.saveAttempt('e1', { answers: { q1: 0, q2: 1 } });
  const expired = boot(localStorage, 1700000300001).repository.getAttempt('e1');
  assert.equal(expired.status, 'submitted');
  assert.equal(expired.reason, 'timeout');
  assert.equal(expired.score, 2);
  assert.equal(expired.total, 3);
  assert.equal(expired.deadline, 1700000300000);
  assert.equal(boot(localStorage, 1700000400000).repository.getAttempt('e1').submittedAt, expired.submittedAt);
});

test('only an explicit retake clears a submitted attempt and begins a fresh deadline', () => {
  const { repository: repo } = boot();
  repo.startAttempt('e1', 1700000000000);
  repo.saveAttempt('e1', { answers: { q1: 0 }, review: ['q2'], current: 1 });
  repo.submitAttempt('e1', 1700000001000);
  assert.equal(repo.startAttempt('e1', 1700000002000).status, 'submitted');
  const retake = repo.startAttempt('e1', 1700000003000, true);
  assert.equal(retake.status, 'active');
  assert.equal(retake.deadline, 1700000303000);
  assert.deepEqual(plain(retake.answers), {});
  assert.deepEqual(plain(retake.review), []);
  assert.equal(retake.current, 0);
});

test('an exam with active or submitted attempt cannot be edited and its score stays stable', () => {
  const { repository: repo } = boot();
  repo.startAttempt('e1', 1700000000000);
  repo.saveAttempt('e1', { answers: { q1: 0, q2: 1, q3: 0 } });
  const exam = repo.get('exams', 'e1');
  exam.questions[0].correct = 2;
  assert.throws(() => repo.save('exams', exam), /محاولة|نتائج|تعديل/);
  assert.equal(repo.get('exams', 'e1').questions[0].correct, 0);
  assert.equal(repo.submitAttempt('e1', 1700000010000).score, 3);
  assert.throws(() => repo.save('exams', { id: 'e1', name: 'عنوان معدل' }), /محاولة|نتائج|تعديل/);
  assert.equal(repo.get('exams', 'e1').name, 'اختبار الأحياء التجريبي');
});

test('an exam with active or submitted attempt cannot be removed', () => {
  const { repository: repo } = boot();
  repo.startAttempt('e1', 1700000000000);
  assert.throws(() => repo.remove('exams', 'e1'), /محاولة|نتائج|حذف/);
  repo.submitAttempt('e1', 1700000010000);
  assert.throws(() => repo.remove('exams', 'e1'), /محاولة|نتائج|حذف/);
  assert.ok(repo.get('exams', 'e1'));
  const newExam = repo.save('exams', { ...repo.get('exams', 'e1'), id: 'untouched', name: 'اختبار جديد' });
  assert.equal(repo.remove('exams', newExam.id), true);
});

test('corrupt local storage falls back to usable memory without trusting invalid shapes', () => {
  for (const value of ['{broken json', 'null', '{}', JSON.stringify({ version: 1, collections: { subjects: 'wrong' }, settings: {}, lessonStates: {}, attempts: {} })]) {
    const { repository: repo } = boot(storage(value));
    assert.equal(typeof repo.storageWarning, 'string');
    assert.ok(repo.storageWarning.length);
    assert.equal(repo.get('subjects', 's1').name, 'الأحياء');
    repo.setSetting('theme', 'dark');
    assert.equal(repo.getSetting('theme'), 'dark');
  }
});

test('unavailable and quota-limited local storage retain changes in memory with a warning', () => {
  const unavailable = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const quota = { getItem() { return null; }, setItem() { throw new Error('quota'); } };
  for (const localStorage of [unavailable, quota]) {
    const { repository: repo } = boot(localStorage);
    assert.ok(repo.storageWarning);
    repo.saveLessonState('l1', { notes: 'محفوظ لهذه الجلسة' });
    assert.equal(repo.getLessonState('l1').notes, 'محفوظ لهذه الجلسة');
    repo.save('users', { id: 'new', name: 'مستخدم جديد', detail: 'تجريبي', status: 'نشط' });
    assert.equal(repo.get('users', 'new').name, 'مستخدم جديد');
  }
});

test('malformed persisted exam or lesson state is rejected without stopping the app', () => {
  const localStorage = storage();
  boot(localStorage);
  const payload = JSON.parse(localStorage.getItem(key));
  payload.attempts.e1 = { examId: 'e1', status: 'active', deadline: 'tomorrow', answers: {}, review: [], current: 0 };
  const { repository: repo } = boot(storage(JSON.stringify(payload)));
  assert.ok(repo.storageWarning);
  assert.equal(repo.getAttempt('e1'), null);
  payload.attempts = {};
  payload.lessonStates.l1 = { percent: -1, seconds: 0, notes: '', bookmark: null, checkpointAnswered: false };
  assert.ok(boot(storage(JSON.stringify(payload))).repository.storageWarning);
});

test('demo seed contains no passwords, tokens, keys, card data, or real contact details', () => {
  const localStorage = storage();
  boot(localStorage);
  const payload = JSON.parse(localStorage.getItem(key));
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /password|api[_-]?key|secret|access[_-]?token|cardNumber|@[^\s"]+\.[a-z]{2,}/i);
});
