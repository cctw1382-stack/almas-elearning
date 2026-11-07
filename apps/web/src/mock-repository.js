
"use strict";
import { LocalPersistence } from './local-persistence';
import { createAttempt, gradeAttempt } from './exam-attempt';
import { assert, isObject, isSafeKey, assertJson, validateTimestamp } from './data-validation';
import { validateLessonState, mergeLessonState } from './lesson-state';
import { validateRecord } from './record-validation';
// REPOSITORY START
export class MockRepository {
  #data;
  #persistence = new LocalPersistence();
  #sequence = 0;
  get storageWarning() { return this.#persistence.warning; }

  constructor() {
    this.#data = this.#seed();
    const saved = this.#persistence.load(() => globalThis.localStorage, value => this.#validateState(value));
    if (saved === undefined) this.#persist();
    else this.#data = saved;
  }

  #seed() {
    const checkpoint = () => ({ text: 'ما الغاز الذي يمتصه النبات في البناء الضوئي؟', options: ['ثاني أكسيد الكربون', 'الأكسجين', 'النيتروجين'], correct: 0 });
    const generic = (id, name, detail, status = 'نشط') => ({ id, name, detail, status });
    return {
      version: 1,
      collections: {
        subjects: [
          { ...generic('s1', 'الأحياء', 'الخلية والبناء الضوئي'), teacher: 'الأستاذ زيد' },
          { ...generic('s2', 'الكيمياء', 'العناصر والروابط الكيميائية'), teacher: 'الأستاذة مريم' },
          { ...generic('s3', 'الفيزياء', 'الحركة والطاقة'), teacher: 'الأستاذ أحمد' },
          { ...generic('s4', 'الرياضيات', 'المعادلات والدوال'), teacher: 'الأستاذة نور' }
        ],
        lessons: [
          { ...generic('l1', 'الأوراق والبناء الضوئي', 'تعرف إلى دور الأوراق في صنع الغذاء'), subjectId: 's1', duration: '18 دقيقة', checkpoint: checkpoint() },
          { ...generic('l2', 'البناء الكيميائي', 'مصادر الطاقة في الكائنات الحية'), subjectId: 's1', duration: '14 دقيقة', checkpoint: { text: 'ما مصدر الطاقة في البناء الكيميائي؟', options: ['تفاعلات كيميائية', 'الضوء', 'الرياح'], correct: 0 } },
          { ...generic('l3', 'الروابط الكيميائية', 'مقدمة عن ترابط الذرات'), subjectId: 's2', duration: '22 دقيقة', checkpoint: { text: 'ما الذي يربط الذرات؟', options: ['روابط كيميائية', 'الجاذبية فقط', 'الضوء'], correct: 0 } },
          { ...generic('l4', 'قوانين الحركة', 'القوة والكتلة والتسارع'), subjectId: 's3', duration: '19 دقيقة', checkpoint: { text: 'بماذا يقاس مقدار القوة؟', options: ['نيوتن', 'متر', 'ثانية'], correct: 0 } }
        ],
        exams: [{ ...generic('e1', 'اختبار الأحياء التجريبي', 'ثلاثة أسئلة عن البناء الضوئي'), subjectId: 's1', studentIds: ['u1'], duration: 300, questions: [
          { id: 'q1', text: 'أين تحدث عملية البناء الضوئي؟', options: ['البلاستيدة الخضراء', 'النواة', 'الميتوكوندريا'], correct: 0 },
          { id: 'q2', text: 'ما الغاز الذي يمتصه النبات؟', options: ['الأكسجين', 'ثاني أكسيد الكربون', 'النيتروجين'], correct: 1 },
          { id: 'q3', text: 'ما مصدر الطاقة في البناء الضوئي؟', options: ['الشمس', 'الرياح', 'التربة'], correct: 0 }
        ] }],
        assignments: [
          { ...generic('a1', 'واجب الأحياء', 'اشرح دور الأوراق في البناء الضوئي في فقرة قصيرة.', 'مطلوب'), subjectId: 's1', studentIds: ['u1'] },
          { ...generic('a2', 'واجب الكيمياء', 'اكتب ملخصاً عن الروابط الكيميائية.', 'قيد المراجعة'), subjectId: 's2', studentIds: ['u4'] }
        ],
        students: [
          { id: 'u1', name: 'علي حسن', grade: 91, progress: 88 },
          { id: 'u2', name: 'فاطمة كريم', grade: 86, progress: 79 },
          { id: 'u3', name: 'محمد أحمد', grade: 74, progress: 62 },
          { id: 'u4', name: 'سارة حسن', grade: 83, progress: 72 }
        ],
        children: [
          { id: 'c1', name: 'علي حسن', grade: 'الخامس العلمي', progress: 88, studentId: 'u1' },
          { id: 'c2', name: 'سارة حسن', grade: 'الثالث المتوسط', progress: 72, studentId: 'u4' }
        ],
        attendance: [
          { id: 'at1', name: 'حصة الأحياء', childId: 'c1', status: 'حاضر' },
          { id: 'at2', name: 'حصة الكيمياء', childId: 'c1', status: 'حاضر' },
          { id: 'at3', name: 'حصة الرياضيات', childId: 'c2', status: 'غائب' },
          { id: 'at4', name: 'حصة العلوم', childId: 'c2', status: 'حاضر' }
        ],
        users: [generic('user1', 'مستخدم طالب تجريبي', 'دور الطالب'), generic('user2', 'مستخدم معلم تجريبي', 'دور المعلم')],
        schools: [generic('school1', 'مدرسة الماس التجريبية', 'مدرسة افتراضية لعرض الواجهة')],
        classes: [generic('class1', 'الخامس العلمي', 'شعبة تعليمية تجريبية'), generic('class2', 'الثالث المتوسط', 'شعبة تعليمية تجريبية')],
        subscriptions: [generic('sub1', 'الخطة التعليمية الشهرية', 'اشتراك محلي توضيحي دون فوترة', 'فعال')],
        payments: [generic('pay1', 'سجل دفع تجريبي', 'محاكاة دون عملية مالية أو بيانات بطاقة', 'مكتمل')],
        providers: [generic('provider1', 'مزود تعليمي تجريبي', 'توصيات محلية دون اتصال بخدمة خارجية')],
        permissions: [generic('permission1', 'صلاحيات الطالب', 'عرض المواد والدروس'), generic('permission2', 'صلاحيات المعلم', 'إدارة المحتوى التجريبي')],
        messages: [
          { ...generic('m1', 'إدارة المنصة', 'مرحباً بكم في النسخة التجريبية.', 'مقروء'), role: 'all' },
          { ...generic('m2', 'معلم الأحياء', 'يرجى مراجعة الدرس قبل الاختبار.', 'جديد'), role: 'student' }
        ],
        notifications: [
          { ...generic('n1', 'درس جديد', 'تمت إضافة درس البناء الضوئي.', 'جديد'), role: 'all' },
          { ...generic('n2', 'اختبار متاح', 'اختبار الأحياء التجريبي متاح الآن.', 'جديد'), role: 'all' }
        ],
        audit: [generic('audit1', 'تهيئة العرض التجريبي', 'بيانات افتراضية توضيحية دون حسابات حقيقية.', 'مكتمل')]
      },
      settings: { selectedChild: 'c1' },
      lessonStates: {},
      attempts: {}
    };
  }

  #clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  #object(value) { return isObject(value); }
  #safeKey(key) { return isSafeKey(key); }
  #assert(condition, message) { assert(condition, message); }
  #json(value) { assertJson(value); }
  #timestamp(value) { validateTimestamp(value); }
  #collection(kind) { this.#assert(Object.hasOwn(this.#data.collections, kind), 'نوع المجموعة غير معروف.'); return this.#data.collections[kind]; }
  #exists(kind, id) { this.#assert(this.#safeKey(id), 'معرّف غير صالح.'); const record = this.#collection(kind).find(item => item.id === id); this.#assert(record, 'العنصر المطلوب غير موجود.'); return record; }
  #record(kind, record, data = this.#data) { validateRecord(kind, record, data); }
  #lessonState(value) { validateLessonState(value); }
  #attempt(examId, value, data = this.#data) {
    this.#assert(this.#object(value) && value.examId === examId && ['active', 'submitted'].includes(value.status), 'بيانات محاولة الاختبار غير صالحة.');
    this.#timestamp(value.deadline);
    this.#assert(this.#object(value.answers) && Array.isArray(value.review) && Number.isInteger(value.current) && value.current >= 0, 'بيانات إجابات المحاولة غير صالحة.');
    const exam = data.collections.exams.find(item => item.id === examId);
    for (const [id, answer] of Object.entries(value.answers)) {
      const question = exam && exam.questions.find(item => item.id === id);
      this.#assert(this.#safeKey(id) && Number.isInteger(answer) && answer >= 0 && (!exam || (question && answer < question.options.length)), 'إجابة السؤال أو خيارها غير صالح.');
    }
    this.#assert(value.review.every(id => this.#safeKey(id) && (!exam || exam.questions.some(question => question.id === id))) && new Set(value.review).size === value.review.length, 'أسئلة المراجعة غير صالحة.');
    if (exam) this.#assert(value.current < exam.questions.length, 'رقم السؤال الحالي غير صالح.');
    if (value.status === 'submitted') {
      this.#timestamp(value.submittedAt);
      this.#assert(Number.isInteger(value.score) && Number.isInteger(value.total) && value.total > 0 && value.score >= 0 && value.score <= value.total && ['manual', 'timeout'].includes(value.reason), 'نتيجة المحاولة غير صالحة.');
    }
  }
  #validateState(data) {
    this.#json(data);
    this.#assert(this.#object(data) && data.version === 1 && this.#object(data.collections), 'إصدار التخزين غير صالح.');
    const known = Object.keys(this.#data.collections);
    this.#assert(Object.keys(data.collections).length === known.length && known.every(kind => Array.isArray(data.collections[kind])), 'مجموعات التخزين غير صالحة.');
    for (const kind of known) {
      this.#assert(data.collections[kind].length <= 10000, 'حجم المجموعة غير صالح.');
      const ids = new Set();
      for (const record of data.collections[kind]) { this.#record(kind, record, data); this.#assert(!ids.has(record.id), 'معرّف سجل مكرر.'); ids.add(record.id); }
    }
    for (const section of ['settings', 'lessonStates', 'attempts']) this.#assert(this.#object(data[section]), 'صيغة التخزين غير صالحة.');
    for (const value of Object.values(data.lessonStates)) this.#lessonState(value);
    for (const [id, value] of Object.entries(data.attempts)) this.#attempt(id, value, data);
  }
  #persist() {
    this.#persistence.save(this.#data);
  }
  #id(kind) { let id; do { id = kind + '-' + Date.now() + '-' + (++this.#sequence); } while (this.#data.collections[kind].some(record => record.id === id)); return id; }
  #audit(action, kind, record) {
    this.#data.collections.audit.push({ id: this.#id('audit'), name: action, detail: kind + ' / ' + record.name + ' / ' + record.id, status: 'مكتمل', at: Date.now() });
  }
  #readAttempt(examId, now) {
    const attempt = this.#data.attempts[examId];
    if (attempt && attempt.status === 'active' && attempt.deadline <= now) return this.submitAttempt(examId, now, 'timeout');
    return attempt ? this.#clone(attempt) : null;
  }

  list(kind) { return this.#clone(this.#collection(kind)); }
  get(kind, id) { return this.#clone(this.#collection(kind).find(record => record.id === id) || null); }
  save(kind, record) {
    const collection = this.#collection(kind);
    this.#assert(this.#object(record), 'بيانات السجل غير صالحة.');
    this.#json(record);
    const index = record.id === undefined ? -1 : collection.findIndex(item => item.id === record.id);
    if (kind === 'exams' && index >= 0) this.#assert(!Object.hasOwn(this.#data.attempts, record.id), 'لا يمكن تعديل اختبار له محاولة محفوظة. أنشئ اختباراً جديداً للحفاظ على النتائج.');
    const saved = { ...(index < 0 ? { detail: '', status: 'نشط' } : collection[index]), ...this.#clone(record), id: record.id === undefined ? this.#id(kind) : record.id };
    this.#record(kind, saved);
    if (index < 0) collection.push(saved); else collection[index] = saved;
    this.#audit(index < 0 ? 'إضافة سجل' : 'تعديل سجل', kind, saved);
    this.#persist();
    return this.#clone(saved);
  }
  remove(kind, id) {
    const collection = this.#collection(kind);
    const index = collection.findIndex(item => item.id === id);
    if (index < 0) return false;
    if (kind === 'exams') this.#assert(!Object.hasOwn(this.#data.attempts, id), 'لا يمكن حذف اختبار له محاولة محفوظة حفاظاً على النتائج.');
    if (kind === 'subjects') this.#assert(!['lessons', 'exams', 'assignments'].some(type => this.#data.collections[type].some(item => item.subjectId === id)), 'لا يمكن حذف مادة مرتبطة بدروس أو اختبارات أو واجبات. احذف الارتباطات أولاً.');
    if (kind === 'students') this.#assert(!this.#data.collections.children.some(child => child.studentId === id), 'لا يمكن حذف طالب مرتبط بملف ابن.');
    if (kind === 'students') this.#assert(!['exams', 'assignments'].some(type => this.#data.collections[type].some(item => item.studentIds?.includes(id))), 'لا يمكن حذف طالب مرتبط باختبارات أو واجبات. أزل الارتباطات أولاً.');
    if (kind === 'students') this.#assert(!this.#data.collections.assignments.some(item => item.submissions && Object.hasOwn(item.submissions, id)), 'لا يمكن حذف طالب مرتبط بتسليم واجب. أزل التسليم أولاً.');
    if (kind === 'children') this.#assert(!this.#data.collections.attendance.some(item => item.childId === id), 'لا يمكن حذف ابن مرتبط بسجلات حضور.');
    const [record] = collection.splice(index, 1);
    this.#audit('حذف سجل', kind, record);
    this.#persist();
    return true;
  }
  getSetting(key, fallback) { this.#assert(this.#safeKey(key), 'مفتاح الإعداد غير صالح.'); return this.#clone(Object.hasOwn(this.#data.settings, key) ? this.#data.settings[key] : fallback); }
  setSetting(key, value) { this.#assert(this.#safeKey(key), 'مفتاح الإعداد غير صالح.'); this.#json(value); this.#data.settings[key] = this.#clone(value); this.#persist(); return this.#clone(value); }
  #lessonKey(lessonId, scope) { this.#exists('lessons', lessonId); this.#assert(['student', 'teacher', 'admin'].includes(scope), 'نطاق معاينة الدرس غير صالح.'); return scope === 'student' ? lessonId : scope + ':' + lessonId; }
  getLessonState(lessonId, scope = 'student') { const key = this.#lessonKey(lessonId, scope); return this.#clone(this.#data.lessonStates[key] || { percent: 0, seconds: 0, notes: '', bookmark: null, checkpointAnswered: false }); }
  saveLessonState(lessonId, patch, scope = 'student') {
    const key = this.#lessonKey(lessonId, scope);
    const value = mergeLessonState(this.getLessonState(lessonId, scope), patch);
    this.#data.lessonStates[key] = value;
    this.#persist();
    return this.#clone(value);
  }
  getAttempt(examId) { this.#exists('exams', examId); return this.#readAttempt(examId, Date.now()); }
  startAttempt(examId, now = Date.now(), retake = false) {
    const exam = this.#exists('exams', examId);
    this.#timestamp(now);
    const existing = this.#readAttempt(examId, now);
    if (existing && !(retake && existing.status === 'submitted')) return existing;
    const attempt = createAttempt(examId, exam.duration, now);
    this.#data.attempts[examId] = attempt;
    this.#persist();
    return this.#clone(attempt);
  }
  saveAttempt(examId, patch) {
    const current = this.getAttempt(examId);
    this.#assert(current, 'ابدأ محاولة الاختبار أولاً.');
    if (current.status === 'submitted') return current;
    this.#assert(this.#object(patch), 'بيانات المحاولة غير صالحة.');
    this.#json(patch);
    this.#assert(Object.keys(patch).every(key => ['answers', 'review', 'current'].includes(key)), 'تعديل وقت المحاولة أو نتيجتها غير مسموح.');
    const value = { ...current, ...this.#clone(patch) };
    this.#attempt(examId, value);
    this.#data.attempts[examId] = value;
    this.#persist();
    return this.#clone(value);
  }
  submitAttempt(examId, now = Date.now(), reason = 'manual') {
    const exam = this.#exists('exams', examId);
    const current = this.#data.attempts[examId];
    this.#assert(current, 'ابدأ محاولة الاختبار أولاً.');
    if (current.status === 'submitted') return this.#clone(current);
    this.#timestamp(now);
    this.#assert(['manual', 'timeout'].includes(reason), 'سبب تقديم المحاولة غير صالح.');
    const attempt = gradeAttempt(current, exam.questions, now, reason);
    this.#data.attempts[examId] = attempt;
    this.#persist();
    return this.#clone(attempt);
  }
}


// REPOSITORY END
