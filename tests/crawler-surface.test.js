import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectNotes, renderSitemap } from '../scripts/notes.mjs';

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

// sitemap은 이제 생성물이다. 레포에 정적 파일로 두지 않으므로
// 화이트리스트가 아니라 "원고 집합과 일치하는가"를 단언한다.
describe('sitemap', () => {
  it('robots.txt가 선언한 URL과 실제 배포 경로가 일치한다', () => {
    const declared = read('robots.txt').match(/^Sitemap:\s*(\S+)$/m)?.[1];
    expect(declared).toBe('https://leva.ai.kr/sitemap.xml');
  });

  it('정적 파일로 남아 있지 않다', () => {
    expect(existsSync(root('sitemap.xml'))).toBe(false);
    expect(deployEntries()).not.toContain('sitemap.xml');
  });

  it('원고 파일 집합과 sitemap의 글 URL 집합이 일치한다', () => {
    const slugs = readdirSync(root('content/notes'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .sort();
    const notes = collectNotes(root('content/notes'));
    const locs = [...renderSitemap(notes).matchAll(/<loc>https:\/\/leva\.ai\.kr\/notes\/([^<]+)<\/loc>/g)]
      .map((m) => m[1])
      .sort();

    expect(locs).toEqual(slugs);
  });
});

// sitemap만으로는 부족하다. 고아 페이지는 색인이 잘 안 된다.
describe('개발 기록 발견 가능성', () => {
  it('홈에서 /notes/로 가는 링크가 있다', () => {
    expect(read('index.html')).toContain('href="/notes/"');
  });

  // 308을 한 번 더 타는 링크가 남아 있으면 안 된다(실측: /notes → /notes/).
  it('리다이렉트되는 무슬래시 링크를 남기지 않는다', () => {
    expect(read('index.html')).not.toContain('href="/notes"');
  });
});

// 요금을 본 직후이자 폼에 닿기 직전이 질문이 가장 많이 생기는 자리다.
describe('홈 FAQ', () => {
  const html = read('index.html');

  it('FAQ 섹션이 있다', () => {
    expect(html).toContain('id="faq"');
  });

  it('요금과 리드 폼 사이에 놓인다', () => {
    expect(html.indexOf('id="pricing"')).toBeLessThan(html.indexOf('id="faq"'));
    expect(html.indexOf('id="faq"')).toBeLessThan(html.indexOf('id="lead"'));
  });

  it('상세는 /beta로 보낸다', () => {
    expect(html).toContain('href="/beta"');
  });

  it('확정되지 않은 초대 기간을 약속하지 않는다', () => {
    expect(html).not.toMatch(/(며칠|영업일|\d+\s*일)\s*(안에|이내|내로)/);
  });
});
