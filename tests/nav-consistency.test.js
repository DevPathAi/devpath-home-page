import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf-8');

// 페이지마다 푸터 링크가 제각각이면, 어떤 페이지에 도착한 사람은
// 나머지 페이지로 갈 길이 없다. 실제로 privacy에는 /notes 링크가 없었다.
const PAGES = ['index.html', 'privacy.html', 'beta.html', 'about.html'];
const TEMPLATES = ['templates/note.html', 'templates/notes-index.html'];
const REQUIRED_LINKS = ['/beta', '/about', '/notes/', '/privacy'];

describe('푸터 내비 일관성', () => {
  it.each([...PAGES, ...TEMPLATES])('%s 푸터가 공통 링크를 담는다', (page) => {
    const html = read(page);
    const footer = html.slice(html.indexOf('site-footer__links'));

    expect(REQUIRED_LINKS.filter((l) => !footer.includes(`href="${l}"`))).toEqual([]);
  });
});

describe('광고 크롤러 허용', () => {
  const txt = read('robots.txt');

  // Mediapartners-Google은 User-agent: * 그룹을 무시하고
  // 자기 이름으로 쓴 규칙만 따른다(Google 문서).
  it('Mediapartners-Google 그룹을 명시한다', () => {
    expect(txt).toMatch(/User-agent:\s*Mediapartners-Google/);
  });

  it('명시 그룹이 전체를 허용한다', () => {
    const group = txt.slice(txt.search(/User-agent:\s*Mediapartners-Google/));
    expect(group).toMatch(/Allow:\s*\//);
  });

  it('기존 전체 크롤러 허용을 유지한다', () => {
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Sitemap: https://leva.ai.kr/sitemap.xml');
  });
});
