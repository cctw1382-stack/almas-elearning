// Local review server: exposes only the requested prototype, never directories.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const prototype = path.resolve(__dirname, '../prototype/index.html');
const server = http.createServer((request, response) => {
  if (!['GET','HEAD'].includes(request.method)) {
    response.writeHead(405, {allow:'GET, HEAD'}).end();return;
  }
  if (request.url === '/favicon.ico') {response.writeHead(204).end();return;}
  if (!['/','/index.html'].includes(request.url)) {
    response.writeHead(404).end();return;
  }
  response.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  if(request.method==='HEAD')response.end();else fs.createReadStream(prototype).pipe(response);
});
server.listen(4173,'127.0.0.1',()=>process.stdout.write('Almas preview: http://127.0.0.1:4173/\n'));
