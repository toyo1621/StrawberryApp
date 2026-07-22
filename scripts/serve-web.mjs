import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), 'web-build');
const port = Number(process.env.PORT || 4173);
const indexPath = resolve(root, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
const detectedBasePath = indexHtml.match(/(?:href|src)="(\/[^"/]+)\/(?:favicon\.ico|_expo\/)/)?.[1] || '';
const basePath = (process.env.PREVIEW_BASE_PATH ?? detectedBasePath).replace(/\/+$/, '');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);

  if (requestPath === '/__strawberry_preview_health') {
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
    }).end(JSON.stringify({ ok: true, basePath: basePath || '/' }));
    return;
  }

  if (basePath && requestPath === '/') {
    response.writeHead(302, { location: `${basePath}/` }).end();
    return;
  }

  if (basePath && requestPath !== basePath && !requestPath.startsWith(`${basePath}/`)) {
    response.writeHead(404).end('Not found');
    return;
  }

  const pathWithinBuild = basePath ? requestPath.slice(basePath.length) : requestPath;
  const relativePath = pathWithinBuild === '/' || pathWithinBuild === ''
    ? 'index.html'
    : pathWithinBuild.replace(/^\/+/, '');
  let filePath = resolve(root, relativePath);

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(400).end('Bad request');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = resolve(filePath, 'index.html');
    }
    await stat(filePath);
  } catch {
    filePath = resolve(root, 'index.html');
  }

  response.writeHead(200, {
    'cache-control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=31536000, immutable',
    'content-type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}${basePath || '/'}`);
});
