// Local built-app preview. Serves an explicit allowlist, never source files.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const host = option('--host', '127.0.0.1');
const port = Number(option('--port', '4174'));
if (!['127.0.0.1', '0.0.0.0'].includes(host) || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview address');
const files = new Set(['index.html', 'sw.js', 'manifest.webmanifest', 'third-party-notices.txt']);
// Hashed build filenames change while the preview process may remain running.
// Validate each requested public asset instead of retaining an obsolete listing.
const publicAsset = /^(assets|icons)\/[\w.-]+\.(js|css|png|svg)$/;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { allow: 'GET, HEAD' }).end(); return; }
  let pathname;
  try { pathname = new URL(request.url, 'http://localhost').pathname; } catch { response.writeHead(400).end(); return; }
  const file = ['/', '/student/exam', '/auth/callback'].includes(pathname) ? 'index.html' : pathname.slice(1);
  if (file === 'favicon.ico') { response.writeHead(204).end(); return; }
  if ((!files.has(file) && !publicAsset.test(file)) || !fs.existsSync(path.join(dist, file))) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': types[path.extname(file)], 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  if (request.method === 'HEAD') response.end(); else fs.createReadStream(path.join(dist, file)).pipe(response);
});
server.listen(port, host, () => console.log(`Almas built preview: http://${host}:${port}/`));
