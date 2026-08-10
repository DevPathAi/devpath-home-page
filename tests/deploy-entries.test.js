import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const buildSrc = readFileSync(root('build.mjs'), 'utf-8');

// build.mjs의 DEPLOY_ENTRIES 배열 리터럴을 그대로 읽어낸다.
function deployEntries() {
  const m = buildSrc.match(/const DEPLOY_ENTRIES = \[([^\]]*)\]/);
  if (!m) throw new Error('DEPLOY_ENTRIES를 찾지 못했다');
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

// 크롤러가 반드시 읽어야 하는 파일. 이 둘만 양방향으로 못박는다.
const CRAWLER_FILES = ['robots.txt', 'ads.txt'];

describe('배포 화이트리스트', () => {
  // build.mjs는 없는 엔트리를 ENOENT로 조용히 건너뛴다("빌드 초기 단계 허용").
  // 그래서 "목록에 있는데 파일이 없다"가 빌드를 깨지 않고 조용히 배포에서 빠진다.
  // 실제로 _redirects·favicon.ico는 지금도 목록에만 있고 파일이 없다 — 이는
  // 의도된 허용이므로 전수 검사는 하지 않고, 크롤러 필수 파일만 단언한다.
  it.each(CRAWLER_FILES)('%s는 목록에 있고 파일도 존재한다', (name) => {
    expect(deployEntries()).toContain(name); // 목록 누락 → dist/로 안 나감
    expect(existsSync(root(name))).toBe(true); // 파일 부재 → 조용히 건너뜀
  });

  it('robots.txt가 크롤러를 허용한다', () => {
    const txt = readFileSync(root('robots.txt'), 'utf-8');
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
  });

  it('ads.txt가 퍼블리셔 ID를 담고 있다', () => {
    const txt = readFileSync(root('ads.txt'), 'utf-8');
    expect(txt).toContain('pub-2785578834914321');
    expect(txt).toContain('DIRECT');
  });
});

// Pages 프로젝트에 functions/가 있으면 기본적으로 *모든* 요청이 Function을
// 호출하고, 그게 Workers 무료 한도(100,000 req/일)를 소모한다. 정적 자산
// 요청은 원래 무제한 무료인데 그 혜택을 잃는다.
// wrangler가 _routes.json을 자동 생성하지만 외부에서 확인할 수 없으므로
// 명시적으로 넣어 덮어쓴다.
describe('Pages 라우팅(_routes.json)', () => {
  it('_routes.json이 목록에 있고 파일도 존재한다', () => {
    expect(deployEntries()).toContain('_routes.json');
    expect(existsSync(root('_routes.json'))).toBe(true);
  });

  it('Function은 /api/* 에서만 실행된다', () => {
    const cfg = JSON.parse(readFileSync(root('_routes.json'), 'utf-8'));
    expect(cfg.version).toBe(1);
    expect(cfg.include).toEqual(['/api/*']);
  });

  it('include가 실제 functions 디렉터리와 일치한다', () => {
    // functions/api/ 아래에만 핸들러가 있다. 다른 최상위 경로가 생기면
    // _routes.json도 함께 고쳐야 하므로 여기서 어긋남을 잡는다.
    const cfg = JSON.parse(readFileSync(root('_routes.json'), 'utf-8'));
    const tops = readdirSync(root('functions'));
    expect(tops).toEqual(['api']);
    expect(cfg.include).toEqual(tops.map((t) => `/${t}/*`));
  });
});
