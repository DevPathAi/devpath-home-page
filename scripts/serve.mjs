// 의존성 0 정적 파일 서버 (dev / preview / Playwright webServer 용).
// 사용: node scripts/serve.mjs [rootDir=.] [port=4321]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';

const rootDir = resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 4321);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

async function resolvePath(urlPath) {
  // 쿼리 제거 + 디렉토리 탈출 방지
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(rootDir, clean);
  if (!filePath.startsWith(rootDir)) filePath = rootDir; // traversal 차단
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    // SPA 아님 — 404로 떨어뜨린다
  }
  return filePath;
}

const server = createServer(async (req, res) => {
  try {
    const filePath = await resolvePath(req.url || '/');
    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${rootDir} → http://127.0.0.1:${port}`);
});
