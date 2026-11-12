const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

test('running preview serves newly built assets but never source files', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'almas-preview-test-'));
  let server;
  try {
    await fs.mkdir(path.join(root, 'scripts'));
    await fs.mkdir(path.join(root, 'dist/assets'), { recursive: true });
    await fs.copyFile(path.resolve(__dirname, '../../apps/web/scripts/preview.mjs'), path.join(root, 'scripts/preview.mjs'));
    await fs.writeFile(path.join(root, 'dist/index.html'), 'test page');
    await fs.writeFile(path.join(root, 'dist/private.txt'), 'not public');
    server = spawn(process.execPath, [path.join(root, 'scripts/preview.mjs'), '--port', '5199'], { stdio: ['ignore', 'pipe', 'pipe'] });
    await Promise.race([
      once(server.stdout, 'data'),
      once(server, 'exit').then(([code]) => { throw Error('Preview exited: ' + code); }),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('Preview startup timeout')), 10000); timer.unref(); }),
    ]);
    const url = 'http://127.0.0.1:5199';
    assert.equal((await fetch(url + '/assets/new-release.js')).status, 404);
    await fs.writeFile(path.join(root, 'dist/assets/new-release.js'), 'window.release = 2;');
    const response = await fetch(url + '/assets/new-release.js');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'window.release = 2;');
    assert.equal((await fetch(url + '/private.txt')).status, 404);
    assert.equal((await fetch(url + '/scripts/preview.mjs')).status, 404);
    assert.equal((await fetch(url + '/', { method: 'POST' })).status, 405);
  } finally {
    if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
    await fs.rm(root, { recursive: true, force: true });
  }
});
