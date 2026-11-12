import type { DataRecord } from './repository';
import { assert, isObject, isSafeKey, validateText, validateRange, validateTimestamp } from './data-validation.ts';

interface Question { id?: string; text: string; options: string[]; correct: number }
interface ReferenceData {
collections: { subjects: DataRecord[]; students: DataRecord[]; children: DataRecord[] };
}

export function validateQuestion(question: unknown, needsId: boolean): asserts question is Question {
  assert(isObject(question), 'صيغة السؤال غير صالحة.');
  if (needsId) assert(isSafeKey(question.id), 'معرّف السؤال غير صالح.');
  validateText(question.text, 'نص السؤال', 2000);
  assert(Array.isArray(question.options) && question.options.length >= 2 && question.options.length <= 6, 'السؤال يحتاج خيارين إلى ستة خيارات.');
  question.options.forEach(option => validateText(option, 'خيار السؤال', 500));
  assert(typeof question.correct === 'number' && Number.isInteger(question.correct) && question.correct >= 0 && question.correct < question.options.length, 'خيار الإجابة الصحيحة غير صالح.');
}
export function validateRecord(kind: string, record: unknown, data: ReferenceData): asserts record is DataRecord {
  assert(isObject(record) && isSafeKey(record.id), 'معرّف السجل غير صالح.');
  validateText(record.name, 'الاسم', 120);
  if (record.detail !== undefined) validateText(record.detail, 'التفاصيل', 2000, false);
  if (record.status !== undefined) validateText(record.status, 'الحالة', 120);
  if (record.submission !== undefined) validateText(record.submission, 'نص التسليم', 5000, false);
  if (record.teacher !== undefined) validateText(record.teacher, 'اسم المعلم', 120, false);
  if (['lessons', 'exams', 'assignments'].includes(kind)) assert(typeof record.subjectId === 'string' && data.collections.subjects.some(subject => subject.id === record.subjectId), 'المادة المرتبطة غير موجودة.');
  if (['exams', 'assignments'].includes(kind) && record.studentIds !== undefined) {
    assert(Array.isArray(record.studentIds) && record.studentIds.every(id => isSafeKey(id) && data.collections.students.some(student => student.id === id)), 'قائمة الطلاب تحتوي معرّف طالب غير صالح أو غير موجود.');
    assert(new Set(record.studentIds).size === record.studentIds.length, 'قائمة الطلاب تحتوي معرّفات مكررة.');
  }
  if (kind === 'assignments' && record.submissions !== undefined) {
    assert(isObject(record.submissions), 'صيغة تسليمات الواجب غير صالحة.');
    for (const [studentId, answer] of Object.entries(record.submissions)) {
      assert(isSafeKey(studentId) && data.collections.students.some(student => student.id === studentId), 'تسليم الواجب مرتبط بطالب غير موجود.');
      validateText(answer, 'إجابة تسليم الواجب', 5000);
    }
  }
  if (kind === 'lessons') { validateText(record.duration, 'مدة الدرس', 40); if (record.checkpoint !== undefined) validateQuestion(record.checkpoint, false); }
  if (kind === 'exams') {
    assert(typeof record.duration === 'number' && Number.isInteger(record.duration) && record.duration >= 1 && record.duration <= 10800, 'مدة الاختبار يجب أن تكون بين ثانية و180 دقيقة.');
    assert(Array.isArray(record.questions) && record.questions.length > 0 && record.questions.length <= 100, 'الاختبار يحتاج أسئلة صالحة.');
    record.questions.forEach(question => validateQuestion(question, true));
    assert(new Set(record.questions.map(question => question.id)).size === record.questions.length, 'معرّفات أسئلة الاختبار مكررة.');
  }
  if (kind === 'students') { validateRange(record.grade, 100, 'الدرجة'); validateRange(record.progress, 100, 'نسبة التقدم'); }
  if (kind === 'children') { validateText(record.grade, 'الصف', 120); validateRange(record.progress, 100, 'نسبة التقدم'); assert(typeof record.studentId === 'string' && data.collections.students.some(student => student.id === record.studentId), 'الطالب المرتبط غير موجود.'); }
  if (kind === 'attendance') assert(typeof record.childId === 'string' && data.collections.children.some(child => child.id === record.childId), 'الابن المرتبط غير موجود.');
  if (record.role !== undefined) assert(typeof record.role === 'string' && ['all', 'student', 'teacher', 'parent', 'admin'].includes(record.role), 'الدور غير صالح.');
  if (record.at !== undefined) validateTimestamp(record.at);
}

