import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

describe('빌드 산출물', () => {
  beforeAll(() => {
    execFileSync('node', ['build.mjs'], { cwd: root('.'), stdio: 'pipe' });
  }, 60_000);

  it('원고 수만큼 글 페이지를 낸다', () => {
    const sources = readdirSync(root('content/notes')).filter((f) => f.endsWith('.md'));
    const built = readdirSync(root('dist/notes')).filter((f) => f !== 'index.html');

    expect(built).toHaveLength(sources.length);
  });

  it('인덱스와 sitemap을 낸다', () => {
    expect(existsSync(root('dist/notes/index.html'))).toBe(true);
    expect(existsSync(root('dist/sitemap.xml'))).toBe(true);
  });

  it('sitemap이 글 URL을 담는다', () => {
    expect(readFileSync(root('dist/sitemap.xml'), 'utf-8')).toContain('/notes/');
  });
});
