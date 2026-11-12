const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { ApiRecords } = require('../../apps/web/src/api-records.ts');

test('record adapter interoperates with an actual local HTTP server', async () => {
  const records = new Map();
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (!req.url.startsWith('/api/v1/records/subjects')) { res.writeHead(404).end(); return; }
    const id = req.url.split('/')[5];
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = ''; for await (const chunk of req) body += chunk;
      const value = { ...JSON.parse(body), id: id || 's1' };
      records.set(value.id, value);
      res.writeHead(req.method === 'POST' ? 201 : 200).end(JSON.stringify(value)); return;
    }
    if (req.method === 'DELETE') { res.writeHead(records.delete(id) ? 204 : 404).end(); return; }
    if (id && !records.has(id)) { res.writeHead(404).end(); return; }
    res.end(JSON.stringify(id ? records.get(id) : [...records.values()]));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const api = new ApiRecords(new URL(`http://127.0.0.1:${server.address().port}/api/v1/`), fetch);
    const saved = await api.save('subjects', { name: 'علوم' });
    assert.equal(saved.id, 's1');
    assert.equal((await api.list('subjects')).length, 1);
    await api.save('subjects', { ...saved, name: 'رياضيات' });
    assert.equal((await api.get('subjects', saved.id)).name, 'رياضيات');
    assert.equal(await api.remove('subjects', saved.id), true);
    assert.equal(await api.get('subjects', saved.id), null);
    assert.equal(await api.remove('subjects', saved.id), false);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
