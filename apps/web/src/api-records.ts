import type { DataRecord } from './repository';
import { assert, assertJson, isObject, isSafeKey } from './data-validation.ts';

/** Phase-two transport contract. Production authorization belongs to the server. */
export interface AsyncRecords {
  list(kind: string): Promise<DataRecord[]>;
  get(kind: string, id: string): Promise<DataRecord | null>;
  save(kind: string, record: Partial<DataRecord>): Promise<DataRecord>;
  remove(kind: string, id: string): Promise<boolean>;
}

function record(value: unknown): DataRecord {
  assertJson(value);
  assert(isObject(value) && isSafeKey(value.id) && typeof value.name === 'string', 'استجابة السجل غير صالحة.');
  return { ...value, id: value.id, name: value.name };
}

export class ApiRecords implements AsyncRecords {
  private base: URL;
  private transport: typeof fetch;
  constructor(base: URL, transport: typeof fetch) {
    assert(['http:', 'https:'].includes(base.protocol) && !base.username && !base.password && !base.search && !base.hash,
      'عنوان خدمة البيانات غير صالح.');
    this.base = new URL(base.href.endsWith('/') ? base.href : base.href + '/');
    this.transport = transport;
  }

  private url(kind: string, id?: string): URL {
    assert(isSafeKey(kind) && /^[a-z]+$/.test(kind), 'نوع المجموعة غير صالح.');
    if (id !== undefined) assert(isSafeKey(id) && !['.', '..'].includes(id), 'معرّف غير صالح.');
    return new URL('records/' + kind + (id === undefined ? '' : '/' + encodeURIComponent(id)), this.base);
  }

  private async request(url: URL, method: string, body?: unknown): Promise<Response> {
    if (body !== undefined) assertJson(body);
    const response = await this.transport(url, {
      method, credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && response.status !== 404) throw new Error('تعذر إتمام طلب البيانات (' + response.status + ').');
    return response;
  }

  async list(kind: string): Promise<DataRecord[]> {
    const response = await this.request(this.url(kind), 'GET');
    assert(response.ok, 'المجموعة غير موجودة.');
    const value: unknown = await response.json();
    assert(Array.isArray(value), 'استجابة القائمة غير صالحة.');
    return value.map(record);
  }

  async get(kind: string, id: string): Promise<DataRecord | null> {
    const response = await this.request(this.url(kind, id), 'GET');
    return response.status === 404 ? null : record(await response.json());
  }

  async save(kind: string, value: Partial<DataRecord>): Promise<DataRecord> {
    const response = await this.request(this.url(kind, value.id), value.id === undefined ? 'POST' : 'PUT', value);
    assert(response.ok, 'السجل غير موجود.');
    return record(await response.json());
  }

  async remove(kind: string, id: string): Promise<boolean> {
    const response = await this.request(this.url(kind, id), 'DELETE');
    return response.status !== 404;
  }
}
