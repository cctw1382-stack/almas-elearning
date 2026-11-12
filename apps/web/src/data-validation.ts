export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && Object.prototype.toString.call(value) === '[object Object]';
}

export function isSafeKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length <= 120 &&
    !['__proto__', 'prototype', 'constructor'].includes(key);
}

export function assertJson(value: unknown, seen = new Set<unknown>(), depth = 0): void {
  assert(depth < 30, 'بيانات متداخلة أكثر من المسموح.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') {
    assert(Number.isFinite(value), 'قيمة عددية غير صالحة.');
    return;
  }
  assert(Array.isArray(value) || isObject(value), 'قيمة البيانات غير صالحة.');
  assert(!seen.has(value), 'بيانات دائرية غير صالحة.');
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    assert(isSafeKey(key), 'مفتاح بيانات غير صالح.');
    assertJson(item, seen, depth + 1);
  }
  seen.delete(value);
}

export function validateText(value: unknown, label: string, limit: number, required = true): asserts value is string {
  assert(typeof value === 'string' && (!required || value.trim().length > 0) && value.length <= limit,
    label + ' مطلوب وبحد أقصى ' + limit + ' حرفاً.');
}

export function validateRange(value: unknown, max: number, label: string): asserts value is number {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max,
    label + ' يجب أن يكون بين 0 و' + max + '.');
}

export function validateTimestamp(value: unknown): asserts value is number {
  assert(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000,
    'وقت المحاولة غير صالح.');
}
