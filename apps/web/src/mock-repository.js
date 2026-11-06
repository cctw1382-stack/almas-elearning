
"use strict";
import { LocalPersistence } from './local-persistence';
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
  #object(value) { return value !== null && Object.prototype.toString.call(value) === '[object Object]'; }
  #safeKey(key) { return typeof key === 'string' && key.length > 0 && key.length <= 120 && !['__proto__', 'prototype', 'constructor'].includes(key); }
  #assert(condition, message) { if (!condition) throw new Error(message); }
  #json(value, seen = new Set(), depth = 0) {
    this.#assert(depth < 30, 'بيانات متداخلة أكثر من المسموح.');
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
    if (typeof value === 'number') { this.#assert(Number.isFinite(value), 'قيمة عددية غير صالحة.'); return; }
    this.#assert(Array.isArray(value) || this.#object(value), 'قيمة البيانات غير صالحة.');
    this.#assert(!seen.has(value), 'بيانات دائرية غير صالحة.');
    seen.add(value);
    for (const [key, item] of Object.entries(value)) {
      this.#assert(this.#safeKey(key), 'مفتاح بيانات غير صالح.');
      this.#json(item, seen, depth + 1);
    }
    seen.delete(value);
  }
  #text(value, label, limit, required = true) {
    this.#assert(typeof value === 'string' && (!required || value.trim().length > 0) && value.length <= limit, label + ' مطلوب وبحد أقصى ' + limit + ' حرفاً.');
  }
  #range(value, max, label) { this.#assert(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max, label + ' يجب أن يكون بين 0 و' + max + '.'); }
  #timestamp(value) { this.#assert(Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000, 'وقت المحاولة غير صالح.'); }
  #collection(kind) { this.#assert(Object.hasOwn(this.#data.collections, kind), 'نوع المجموعة غير معروف.'); return this.#data.collections[kind]; }
  #exists(kind, id) { this.#assert(this.#safeKey(id), 'معرّف غير صالح.'); const record = this.#collection(kind).find(item => item.id === id); this.#assert(record, 'العنصر المطلوب غير موجود.'); return record; }
  #question(question, needsId) {
    this.#assert(this.#object(question), 'صيغة السؤال غير صالحة.');
    if (needsId) this.#assert(this.#safeKey(question.id), 'معرّف السؤال غير صالح.');
    this.#text(question.text, 'نص السؤال', 2000);
    this.#assert(Array.isArray(question.options) && question.options.length >= 2 && question.options.length <= 6, 'السؤال يحتاج خيارين إلى ستة خيارات.');
    question.options.forEach(option => this.#text(option, 'خيار السؤال', 500));
    this.#assert(Number.isInteger(question.correct) && question.correct >= 0 && question.correct < question.options.length, 'خيار الإجابة الصحيحة غير صالح.');
  }
  #record(kind, record, data = this.#data) {
    this.#assert(this.#object(record) && this.#safeKey(record.id), 'معرّف السجل غير صالح.');
    this.#text(record.name, 'الاسم', 120);
    if (record.detail !== undefined) this.#text(record.detail, 'التفاصيل', 2000, false);
    if (record.status !== undefined) this.#text(record.status, 'الحالة', 120);
    if (record.submission !== undefined) this.#text(record.submission, 'نص التسليم', 5000, false);
    if (record.teacher !== undefined) this.#text(record.teacher, 'اسم المعلم', 120, false);
    if (['lessons', 'exams', 'assignments'].includes(kind)) this.#assert(typeof record.subjectId === 'string' && data.collections.subjects.some(subject => subject.id === record.subjectId), 'المادة المرتبطة غير موجودة.');
    if (['exams', 'assignments'].includes(kind) && record.studentIds !== undefined) {
      this.#assert(Array.isArray(record.studentIds) && record.studentIds.every(id => this.#safeKey(id) && data.collections.students.some(student => student.id === id)), 'قائمة الطلاب تحتوي معرّف طالب غير صالح أو غير موجود.');
      this.#assert(new Set(record.studentIds).size === record.studentIds.length, 'قائمة الطلاب تحتوي معرّفات مكررة.');
    }
    if (kind === 'assignments' && record.submissions !== undefined) {
      this.#assert(this.#object(record.submissions), 'صيغة تسليمات الواجب غير صالحة.');
      for (const [studentId, answer] of Object.entries(record.submissions)) {
        this.#assert(this.#safeKey(studentId) && data.collections.students.some(student => student.id === studentId), 'تسليم الواجب مرتبط بطالب غير موجود.');
        this.#text(answer, 'إجابة تسليم الواجب', 5000);
      }
    }
    if (kind === 'lessons') { this.#text(record.duration, 'مدة الدرس', 40); this.#question(record.checkpoint, false); }
    if (kind === 'exams') {
      this.#assert(Number.isInteger(record.duration) && record.duration >= 1 && record.duration <= 10800, 'مدة الاختبار يجب أن تكون بين ثانية و180 دقيقة.');
      this.#assert(Array.isArray(record.questions) && record.questions.length > 0 && record.questions.length <= 100, 'الاختبار يحتاج أسئلة صالحة.');
      record.questions.forEach(question => this.#question(question, true));
      this.#assert(new Set(record.questions.map(question => question.id)).size === record.questions.length, 'معرّفات أسئلة الاختبار مكررة.');
    }
    if (kind === 'students') { this.#range(record.grade, 100, 'الدرجة'); this.#range(record.progress, 100, 'نسبة التقدم'); }
    if (kind === 'children') { this.#text(record.grade, 'الصف', 120); this.#range(record.progress, 100, 'نسبة التقدم'); this.#assert(typeof record.studentId === 'string' && data.collections.students.some(student => student.id === record.studentId), 'الطالب المرتبط غير موجود.'); }
    if (kind === 'attendance') this.#assert(typeof record.childId === 'string' && data.collections.children.some(child => child.id === record.childId), 'الابن المرتبط غير موجود.');
    if (record.role !== undefined) this.#assert(['all', 'student', 'teacher', 'parent', 'admin'].includes(record.role), 'الدور غير صالح.');
    if (record.at !== undefined) this.#timestamp(record.at);
  }
  #lessonState(value) {
    this.#assert(this.#object(value), 'بيانات تقدم الدرس غير صالحة.');
    this.#range(value.percent, 100, 'نسبة التقدم');
    this.#range(value.seconds, 8640000, 'الوقت بالثواني');
    this.#text(value.notes, 'الملاحظات', 10000, false);
    if (value.bookmark !== null) this.#assert(typeof value.bookmark === 'number' && Number.isFinite(value.bookmark) && value.bookmark >= 0 && value.bookmark <= 8640000, 'وقت العلامة المرجعية غير صالح.');
    this.#assert(typeof value.checkpointAnswered === 'boolean', 'حالة السؤال غير صالحة.');
  }
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
    this.#assert(this.#object(patch), 'بيانات تقدم الدرس غير صالحة.');
    this.#json(patch);
    this.#assert(Object.keys(patch).every(key => ['percent', 'seconds', 'notes', 'bookmark', 'checkpointAnswered'].includes(key)), 'حقل تقدم الدرس غير معروف.');
    const value = { ...this.getLessonState(lessonId, scope), ...this.#clone(patch) };
    this.#lessonState(value);
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
    const attempt = { examId, status: 'active', deadline: now + exam.duration * 1000, answers: {}, review: [], current: 0 };
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
    const attempt = { ...current, status: 'submitted', score: exam.questions.reduce((score, question) => score + (current.answers[question.id] === question.correct ? 1 : 0), 0), total: exam.questions.length, submittedAt: now, reason: now >= current.deadline ? 'timeout' : reason };
    this.#data.attempts[examId] = attempt;
    this.#persist();
    return this.#clone(attempt);
  }
}


// REPOSITORY END
