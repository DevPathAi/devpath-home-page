import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderPagesWorker } from '../scripts/pages-worker.mjs';
import { onRequestGet as inviteRounds } from '../functions/api/invite-rounds.js';
import { onRequestPost as lead } from '../functions/api/lead.js';
import { onRequestGet as stats } from '../functions/api/stats.js';

// 2026-09-21: 릴리스 파이프라인(landing-last)은 봉인된 dist 만 배포한다. functions/ 는 dist 밖이라
// 운영에서 /api/* 가 통째로 404 가 됐다. 그래서 함수를 dist/_worker.js(Pages advanced mode)로
// 묶는다 — functions/ 가 원천이고, 이 테스트는 "묶인 것이 원천과 똑같이 동작한다"를 고정한다.

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const ENV = { APPS_SCRIPT_URL: 'https://script.example.test/exec' };
const scratch = [];
const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function temporaryDirectory() {
  const dir = mkdtempSync(join(tmpdir(), 'pages-worker-'));
  scratch.push(dir);
  return dir;
}

async function loadWorker(source = renderPagesWorker(root('functions'))) {
  const file = join(temporaryDirectory(), '_worker.mjs');
  writeFileSync(file, source);
  return (await import(pathToFileURL(file).href)).default;
}

function assets() {
  const seen = [];
  return {
    seen,
    binding: { fetch: async (request) => { seen.push(request); return new Response('static', { status: 200 }); } },
  };
}

const snapshot = async (response) => ({
  status: response.status,
  type: response.headers.get('Content-Type'),
  cache: response.headers.get('Cache-Control'),
  body: await response.text(),
});

describe('dist/_worker.js 는 functions/ 와 똑같이 동작한다', () => {
  it('GET /api/invite-rounds', async () => {
    const upstream = JSON.stringify([{ roundNumber: 1, deliveredCount: 12, date: '2026-09-01', email: 'x@y.z' }]);
    globalThis.fetch = async () => new Response(upstream, { status: 200 });
    const request = () => new Request('https://leva.ai.kr/api/invite-rounds');
    const worker = await loadWorker();
    const bundled = await snapshot(await worker.fetch(request(), { ...ENV, ASSETS: assets().binding }, {}));
    const direct = await snapshot(await inviteRounds({ request: request(), env: ENV }));
    expect(bundled).toEqual(direct);
    expect(bundled.status).toBe(200);
    expect(JSON.parse(bundled.body)).toEqual([{ roundNumber: 1, deliveredCount: 12, date: '2026-09-01' }]);
  });

  it('POST /api/lead', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, lead_id: 'L1' }), { status: 200 });
    const request = () => new Request('https://leva.ai.kr/api/lead', { method: 'POST', body: '{"lead_id":"L1"}' });
    const worker = await loadWorker();
    const bundled = await snapshot(await worker.fetch(request(), { ...ENV, ASSETS: assets().binding }, {}));
    const direct = await snapshot(await lead({ request: request(), env: ENV }));
    expect(bundled).toEqual(direct);
    expect(JSON.parse(bundled.body)).toEqual({ ok: true, lead_id: 'L1' });
  });

  it('GET /api/stats', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, signups: 7, email: 'leak@example.test' }), { status: 200 });
    const request = () => new Request('https://leva.ai.kr/api/stats');
    const worker = await loadWorker();
    const bundled = await snapshot(await worker.fetch(request(), { ...ENV, ASSETS: assets().binding }, {}));
    const direct = await snapshot(await stats({ request: request(), env: ENV }));
    expect(bundled).toEqual(direct);
    expect(bundled.body).not.toContain('leak@example.test');
  });

  it('환경변수가 없으면 원천과 같은 503 을 낸다', async () => {
    const worker = await loadWorker();
    const response = await worker.fetch(
      new Request('https://leva.ai.kr/api/lead', { method: 'POST', body: '{}' }),
      { ASSETS: assets().binding },
      {},
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'endpoint_not_configured' });
  });
});

describe('그 밖의 요청은 전부 정적 자산으로 넘긴다', () => {
  it.each([
    ['정적 페이지', 'GET', 'https://leva.ai.kr/updates/'],
    ['모르는 API 경로', 'GET', 'https://leva.ai.kr/api/unknown'],
    ['핸들러가 없는 메서드', 'GET', 'https://leva.ai.kr/api/lead'],
    ['접두사만 같은 경로', 'GET', 'https://leva.ai.kr/api/lead/extra'],
    ['핸들러가 없는 HEAD', 'HEAD', 'https://leva.ai.kr/api/stats'],
  ])('%s', async (_, method, url) => {
    const static_ = assets();
    const worker = await loadWorker();
    const request = new Request(url, { method });
    const response = await worker.fetch(request, { ...ENV, ASSETS: static_.binding }, {});
    expect(static_.seen).toEqual([request]);
    expect(await response.text()).toBe('static');
  });
});

describe('생성은 결정적이고 fail-closed 다', () => {
  it('같은 입력이면 같은 바이트를 내고 CR 이 없다', () => {
    const first = renderPagesWorker(root('functions'));
    expect(renderPagesWorker(root('functions'))).toBe(first);
    expect(first).not.toContain('\r');
    expect(first.endsWith('\n')).toBe(true);
    const routes = [...first.matchAll(/^ROUTES\.set\('([^']+)'/gm)].map((m) => m[1]);
    expect(routes).toEqual(['/api/invite-rounds', '/api/lead', '/api/stats']);
  });

  it('줄바꿈이 CRLF 인 원천도 같은 바이트를 낸다', () => {
    const dir = temporaryDirectory();
    mkdirSync(join(dir, 'api'));
    for (const name of ['invite-rounds', 'lead', 'stats']) {
      const lf = readFileSync(root(`functions/api/${name}.js`), 'utf8').replace(/\r\n/g, '\n');
      writeFileSync(join(dir, 'api', `${name}.js`), lf.replace(/\n/g, '\r\n'));
    }
    expect(renderPagesWorker(dir)).toBe(renderPagesWorker(root('functions')));
  });

  function functionsWith(files) {
    const dir = temporaryDirectory();
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true });
      writeFileSync(join(dir, path), body);
    }
    return dir;
  }
  const handler = 'export async function onRequestGet() { return new Response("ok"); }\n';

  it.each([
    ['import 가 있는 함수', { 'api/a.js': `import x from './x.js';\n${handler}` }, /import/],
    ['동적 import', { 'api/a.js': `${handler}const y = await import('./y.js');\n` }, /import/],
    ['핸들러가 아닌 export', { 'api/a.js': `${handler}export const helper = 1;\n` }, /export/],
    ['default export', { 'api/a.js': `${handler}export default { fetch() {} };\n` }, /export/],
    ['핸들러가 없는 파일', { 'api/a.js': 'const nothing = 1;\n' }, /핸들러/],
    ['중첩 디렉터리', { 'api/nested/a.js': handler }, /api/],
    ['api 밖의 최상위 경로', { 'api/a.js': handler, 'other/b.js': handler }, /api/],
    ['동적 경로 세그먼트', { 'api/[id].js': handler }, /파일 이름/],
    ['미들웨어', { 'api/_middleware.js': handler }, /파일 이름/],
    ['함수가 하나도 없음', { 'api/readme.txt': 'x' }, /함수/],
  ])('%s 는 빌드를 실패시킨다', (_, files, message) => {
    expect(() => renderPagesWorker(functionsWith(files))).toThrow(message);
  });
});

describe('빌드 산출물에 함수가 묶여 있다', () => {
  // dist/ 는 build-output.test.js 가 쓴다. 파일 단위로 병렬 실행되므로 같은 디렉터리를 다시 빌드하면
  // 서로의 산출물을 지운다 — public-pages-build.test.js 처럼 전용 출력 디렉터리를 쓴다.
  const output = (path) => root(`build/pages-worker-dist/${path}`);

  beforeAll(() => {
    execFileSync('node', ['build.mjs'], {
      cwd: root('.'),
      stdio: 'pipe',
      env: { ...process.env, BUILD_OUTPUT_DIR: 'build/pages-worker-dist' },
    });
  }, 60_000);

  it('dist/_worker.js 는 생성기의 출력과 바이트가 같다', () => {
    expect(existsSync(output('_worker.js'))).toBe(true);
    expect(readFileSync(output('_worker.js'), 'utf8')).toBe(renderPagesWorker(root('functions')));
  });

  it('dist/_routes.json 이 함께 있어 /api/* 만 워커를 거친다', () => {
    expect(JSON.parse(readFileSync(output('_routes.json'), 'utf8')).include).toEqual(['/api/*']);
  });

  it('dist 의 워커가 실제로 /api 요청에 답한다', async () => {
    const worker = (await import(`${pathToFileURL(output('_worker.js')).href}?t=${Date.now()}`)).default;
    const response = await worker.fetch(
      new Request('https://leva.ai.kr/api/lead', { method: 'POST', body: '{}' }),
      { ASSETS: assets().binding },
      {},
    );
    expect(response.status).toBe(503);
  });
});
