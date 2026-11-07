import type { LessonState } from './repository';
import { assert, assertJson, isObject, validateRange, validateText } from './data-validation.ts';

export function validateLessonState(value: unknown): asserts value is LessonState {
  assert(isObject(value), 'بيانات تقدم الدرس غير صالحة.');
  validateRange(value.percent, 100, 'نسبة التقدم');
  validateRange(value.seconds, 8640000, 'الوقت بالثواني');
  validateText(value.notes, 'الملاحظات', 10000, false);
  if (value.bookmark !== null) {
    assert(typeof value.bookmark === 'number' && Number.isFinite(value.bookmark) &&
      value.bookmark >= 0 && value.bookmark <= 8640000, 'وقت العلامة المرجعية غير صالح.');
  }
  assert(typeof value.checkpointAnswered === 'boolean', 'حالة السؤال غير صالحة.');
}

export function mergeLessonState(current: LessonState, patch: unknown): LessonState {
  assert(isObject(patch), 'بيانات تقدم الدرس غير صالحة.');
  assertJson(patch);
  assert(Object.keys(patch).every(key => ['percent', 'seconds', 'notes', 'bookmark', 'checkpointAnswered'].includes(key)),
    'حقل تقدم الدرس غير معروف.');
  const value = { ...current, ...patch };
  validateLessonState(value);
  return value;
}
