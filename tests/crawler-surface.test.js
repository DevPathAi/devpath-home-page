import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf-8');

function deployEntries() {
  const m = read('build.mjs').match(/const DEPLOY_ENTRIES = \[([^\]]*)\]/);
  if (!m) throw new Error('DEPLOY_ENTRIES를 찾지 못했다');
  return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

// Cloudflare Pages는 404.html이 없으면 매칭되지 않는 경로에 index.html을 200으로
// 돌려준다(실측: /zzz-no-page → 200 text/html). 검색엔진과 애드센스 심사 모두
// 이 soft-404를 감점 요인으로 본다.
describe('404 페이지', () => {
  it('404.html이 존재하고 배포 화이트리스트에 있다', () => {
    expect(existsSync(root('404.html'))).toBe(true);
    expect(deployEntries()).toContain('404.html');
  });

  it('색인되지 않도록 noindex를 선언한다', () => {
    const directives = read('404.html').match(/<meta name="robots" content="([^"]+)"/)?.[1];
    expect(directives).toContain('noindex');
  });

  it('홈으로 돌아갈 길을 준다', () => {
    expect(read('404.html')).toContain('href="/"');
  });
});

// robots.txt가 sitemap을 선언하는데 파일이 없으면, 그 URL마저 index.html을
// 200으로 돌려준다 — 크롤러에게 깨진 약속이 된다.
describe('sitemap.xml', () => {
  it('존재하고 배포 화이트리스트에 있다', () => {
    expect(existsSync(root('sitemap.xml'))).toBe(true);
    expect(deployEntries()).toContain('sitemap.xml');
  });

  it('robots.txt가 선언한 URL과 실제 배포 경로가 일치한다', () => {
    const declared = read('robots.txt').match(/^Sitemap:\s*(\S+)$/m)?.[1];
    expect(declared).toBe('https://leva.ai.kr/sitemap.xml');
  });

  it('실제 존재하는 페이지만 담는다', () => {
    const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(['https://leva.ai.kr/', 'https://leva.ai.kr/privacy']);
  });

  // Pages가 .html을 떼는 clean URL로 308 리다이렉트하므로, 사이트맵이
  // /privacy.html을 가리키면 크롤러가 매번 리다이렉트를 한 번 더 탄다.
  it('리다이렉트되는 .html 경로를 담지 않는다', () => {
    expect(read('sitemap.xml')).not.toContain('.html');
  });
});
