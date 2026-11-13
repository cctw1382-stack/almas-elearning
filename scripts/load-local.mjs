import { createServer } from 'node:http';
import { once } from 'node:events';
import { cpus, totalmem, platform, release } from 'node:os';
import { performance } from 'node:perf_hooks';

const workers = Number(process.argv[2] ?? 8);
const rounds = Number(process.argv[3] ?? 10);
if (!Number.isInteger(workers) || workers < 1 || workers > 100 ||
    !Number.isInteger(rounds) || rounds < 1 || rounds > 100) throw new Error('Expected workers and rounds from 1 to 100');

const learners = new Map();
const server = createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://127.0.0.1');
  const id = req.headers['x-fixture-learner'];
  const learner = learners.get(id);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST' && pathname === '/session' && id) {
    learners.set(id, { progress: 0, started: false });
  } else if (!learner) {
    res.writeHead(401).end();
    return;
  } else if (req.method === 'GET' && pathname === '/lesson') {
    res.setHeader('Content-Type', 'application/json');
    res.end('{"lesson":"fixture"}');
    return;
  } else if (req.method === 'PUT' && pathname === '/progress') {
    learner.progress = 12000;
  } else if (req.method === 'POST' && pathname === '/attempt/start' && !learner.started) {
    learner.started = true;
  } else if (req.method === 'POST' && pathname === '/attempt/submit' && learner.started) {
    learner.started = false;
  } else if (req.method === 'GET' && pathname === '/video/index.m3u8') {
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.end('#EXTM3U\n#EXTINF:1,\nsegment-0.ts\n#EXT-X-ENDLIST\n');
    return;
  } else if (req.method === 'GET' && pathname === '/video/segment-0.ts') {
    res.setHeader('Content-Type', 'video/mp2t');
    res.end(Buffer.alloc(64 * 1024));
    return;
  } else {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(204).end();
});

server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = 'http://127.0.0.1:' + server.address().port;
const steps = [
  ['POST', '/session'], ['GET', '/lesson'], ['PUT', '/progress'],
  ['POST', '/attempt/start'], ['POST', '/attempt/submit'],
  ['GET', '/video/index.m3u8'], ['GET', '/video/segment-0.ts'],
];
const samples = [];
const errors = { '4xx': 0, '5xx': 0, transport: 0 };
try {
  await Promise.all(Array.from({ length: workers }, async (_, worker) => {
    for (let run = 0; run < rounds; run++) {
      for (const [method, path] of steps) {
        const start = performance.now();
        try {
          const response = await fetch(base + path, {
            method, headers: { 'x-fixture-learner': String(worker) },
            signal: AbortSignal.timeout(5000),
          });
          await response.arrayBuffer();
          if (response.status >= 500) errors['5xx']++;
          else if (response.status >= 400) errors['4xx']++;
        } catch {
          errors.transport++;
        } finally {
          samples.push(performance.now() - start);
        }
      }
    }
  }));
} finally {
  server.close();
}
samples.sort((a, b) => a - b);
const percentile = p => Number(samples[Math.ceil(samples.length * p) - 1].toFixed(2));
console.log(JSON.stringify({
  scope: 'local in-process HTTP simulation', workers, rounds, requests: samples.length,
  milliseconds: { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) },
  errors, host: { platform: platform(), release: release(), cpu: cpus()[0]?.model,
    logicalProcessors: cpus().length, memoryGiB: Number((totalmem() / 2 ** 30).toFixed(1)), node: process.version },
}, null, 2));
if (Object.values(errors).some(Boolean)) process.exitCode = 1;
