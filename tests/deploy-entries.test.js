import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
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
