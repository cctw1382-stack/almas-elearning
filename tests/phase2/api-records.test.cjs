const test = require('node:test');
const assert = require('node:assert/strict');
const { ApiRecords } = require('../../apps/web/src/api-records.ts');

test('record transport uses distinct CRUD routes and does not send ambient credentials', async () => {
  const calls = [];
  const api = new ApiRecords(new URL('https://example.test/api/v1/'), async (url, init) => {
    calls.push({ url: url.href, ...init });
    if (init.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json(init.method === 'GET' && url.pathname.endsWith('/subjects') ? [{ id: 's1', name: 'علوم' }] : { id: 's1', name: 'علوم' });
  });
  assert.equal((await api.list('subjects')).length, 1);
  assert.equal((await api.get('subjects', 's1')).id, 's1');
  await api.save('subjects', { name: 'علوم' });
  await api.save('subjects', { id: 's1', name: 'علوم' });
  assert.equal(await api.remove('subjects', 's1'), true);
  assert.deepEqual(calls.map(x => x.method), ['GET', 'GET', 'POST', 'PUT', 'DELETE']);
  assert.ok(calls.every(x => x.credentials === 'omit' && x.cache === 'no-store' && x.redirect === 'error'));
  assert.equal(calls[3].url, 'https://example.test/api/v1/records/subjects/s1');
});

test('record transport rejects invalid data and paths, and distinguishes absence from server failure', async () => {
  let status = 404;
  const api = new ApiRecords(new URL('https://example.test/'), async () => new Response(null, { status }));
  assert.equal(await api.get('subjects', 'missing'), null);
  assert.equal(await api.remove('subjects', 'missing'), false);
  await assert.rejects(api.list('subjects'));
  await assert.rejects(api.get('../private', 's1'));
  await assert.rejects(api.get('subjects', '..'));
  status = 500;
  await assert.rejects(api.get('subjects', 's1'), /500/);
  const malformed = new ApiRecords(new URL('https://example.test/'), async () => Response.json({ id: 's1', name: 17 }));
  await assert.rejects(malformed.get('subjects', 's1'));
});
