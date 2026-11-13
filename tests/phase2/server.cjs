// Test-only release server. No production data or APIs are exposed.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../apps/web/dist');
let nextRelease = false;
let failRelease = false;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/__test__/release' && request.method === 'POST') {
    nextRelease = url.searchParams.get('next') === 'true';
    failRelease = url.searchParams.get('fail') === 'true';
    response.writeHead(204).end(); return;
  }
  if (url.pathname.startsWith('/api/') || url.pathname === '/private-video.webm') {
    response.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end('test-only private response'); return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  if (failRelease && requested === 'manifest.webmanifest') { response.writeHead(503).end(); return; }
  const file = path.resolve(root, requested);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
  let body = fs.readFileSync(file);
  if (nextRelease && (requested === 'index.html' || requested === 'sw.js')) {
    const revisedHTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('<html ', '<html data-test-release="second" ');
    if (requested === 'index.html') body = Buffer.from(revisedHTML);
    else {
      const revision = crypto.createHash('md5').update(revisedHTML).digest('hex');
      const text = body.toString().replace(/const CACHE_NAME = [^;]+;/, 'const CACHE_NAME = "almas-shell-' + revision + '";');
      if (text === body.toString()) throw new Error('Test release must change the generated index precache revision');
      body = Buffer.from(text);
    }
  }
  response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  response.end(request.method === 'HEAD' ? undefined : body);
}).listen(5181, '127.0.0.1');
