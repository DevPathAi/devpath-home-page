import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectNotes } from '../scripts/notes.mjs';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

// slug를 바꾸면 옛 URL이 404가 된다. sitemap에 이미 나간 주소라면
// 크롤러와 링크를 잃는다. 리다이렉트로 잇되, 대상이 실재하는지는 기계가 본다.
describe('_redirects', () => {
  const lines = existsSync(root('_redirects'))
    ? readFileSync(root('_redirects'), 'utf-8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [];

  it('파일이 존재한다', () => {
    expect(existsSync(root('_redirects'))).toBe(true);
  });

  it('이름이 바뀐 개발기의 옛 URL을 새 URL로 잇는다', () => {
    expect(lines.some((l) => l.startsWith('/notes/canvaskit-cannot-be-reviewed'))).toBe(true);
  });

  it('모든 규칙이 301로 영구 이동을 알린다', () => {
    const codes = lines.map((l) => l.split(/\s+/)[2]);

    expect(codes.every((c) => c === '301')).toBe(true);
  });

  // 대상이 없으면 리다이렉트가 404로 데려간다. 옛 주소를 그냥 두는 것보다 나쁘다.
  it('리다이렉트 대상이 실재하는 글이다', () => {
    const slugs = collectNotes(root('content/notes')).map((n) => n.slug);
    const targets = lines
      .map((l) => l.split(/\s+/)[1])
      .filter((t) => t.startsWith('/notes/'))
      .map((t) => t.replace('/notes/', ''));

    expect(targets.every((t) => slugs.includes(t))).toBe(true);
  });
});
