import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectNotes, renderSitemap } from '../scripts/notes.mjs';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

// 404는 noindex라 sitemap에 실리면 안 된다. 유일한 예외로 못박는다.
const NOINDEX_PAGES = ['404.html'];

function deployEntries() {
  const m = readFileSync(root('build.mjs'), 'utf-8').match(/const DEPLOY_ENTRIES = \[([^\]]*)\]/);
  if (!m) throw new Error('DEPLOY_ENTRIES를 찾지 못했다');
  return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

// 정적 페이지는 파일·배포목록·sitemap 세 곳을 손으로 맞춰야 한다.
// 하나라도 빠지면 조용히 배포에서 빠지거나 색인에서 빠진다.
describe('정적 페이지 3자 일치', () => {
  const files = readdirSync(root('.'))
    .filter((f) => f.endsWith('.html'))
    .filter((f) => !NOINDEX_PAGES.includes(f))
    .sort();

  it('루트의 모든 html이 배포 화이트리스트에 있다', () => {
    const entries = deployEntries();

    expect(files.filter((f) => !entries.includes(f))).toEqual([]);
  });

  it('noindex 페이지도 배포는 된다', () => {
    const entries = deployEntries();

    expect(NOINDEX_PAGES.filter((f) => !entries.includes(f))).toEqual([]);
  });

  it('루트의 모든 html이 sitemap 고정 경로에 있다', () => {
    const xml = renderSitemap(collectNotes(root('content/notes')));
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    // index.html → https://leva.ai.kr/ , privacy.html → https://leva.ai.kr/privacy
    const expected = files.map((f) =>
      f === 'index.html' ? 'https://leva.ai.kr/' : `https://leva.ai.kr/${f.replace(/\.html$/, '')}`,
    );

    expect(expected.filter((u) => !locs.includes(u))).toEqual([]);
  });

  it('noindex 페이지는 sitemap에 없다', () => {
    const xml = renderSitemap(collectNotes(root('content/notes')));

    expect(xml).not.toContain('/404');
  });
});
