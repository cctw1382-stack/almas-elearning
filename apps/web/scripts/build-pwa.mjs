import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = (await fs.readdir(path.join(dist, 'assets'))).filter(name => /^[\w.-]+\.(js|css)$/.test(name));
const files = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', ...assets.map(name => `assets/${name}`)].sort();
const worker = await fs.readFile(path.join(root, '.pwa/service-worker.js'), 'utf8');
const hash = createHash('sha256').update(worker);
for (const file of files) hash.update(file).update(await fs.readFile(path.join(dist, file)));
const version = hash.digest('hex').slice(0,24);
const script = `const CACHE_NAME = "almas-shell-${version}";\nconst PRECACHE = ${JSON.stringify(files.map(file => '/' + file))};\n${worker}`;
await fs.writeFile(path.join(dist, 'sw.js'), script);
console.log(`Offline shell: ${files.length} public assets, version ${version}`);
