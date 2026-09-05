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

// _headers 가 /assets/* 를 max-age=31536000, immutable 로 선언한다. 그런데
// 파일명이 styles.css 로 고정이면 내용을 고쳐도 이미 받아 간 브라우저는 1년간
// 옛 파일을 쓴다 — 선언과 실제가 반대였다. 이름에 내용 해시를 넣어 「불변」을
// 사실로 만든다.
describe('자산은 내용이 바뀌면 이름이 바뀐다', () => {
  const assets = () => readdirSync(root('dist/assets'));
  const htmlFiles = () => [
    ...readdirSync(root('dist')).filter((f) => f.endsWith('.html')),
    ...readdirSync(root('dist/notes')).map((f) => `notes/${f}`),
    'updates/index.html',
  ];

  it('해시 없는 이름은 남지 않는다', () => {
    expect(assets()).not.toContain('styles.css');
    expect(assets()).not.toContain('og-image.png');
  });

  it('해시가 붙은 이름으로 나온다', () => {
    expect(assets().some((f) => /^styles\.[0-9a-f]{8}\.css$/.test(f))).toBe(true);
  });

  // 참조가 옛 이름에 남으면 사이트가 통째로 스타일을 잃는다.
  it('모든 HTML이 해시된 이름을 가리킨다', () => {
    for (const file of htmlFiles()) {
      const html = readFileSync(root(`dist/${file}`), 'utf-8');
      expect(html, `${file} 이 해시 없는 자산을 가리킨다`).not.toMatch(
        /\/assets\/(styles\.css|public\.css|og-image\.png|favicon\.svg)/,
      );
      const cssRefs = [...html.matchAll(/href="\/assets\/([^"/]+\.css)"/g)].map((match) => match[1]);
      for (const ref of cssRefs) {
        expect(ref, `${file} 이 해시 없는 CSS를 가리킨다`).toMatch(/\.[0-9a-f]{8}\.css$/);
        expect(assets(), `${file} 이 없는 CSS를 가리킨다`).toContain(ref);
      }
      if (file !== 'index.html') {
        expect(cssRefs, `${file} 에 스타일시트 참조가 없다`).not.toHaveLength(0);
      }
    }
  });

  it('내용이 같으면 해시도 같다', () => {
    const before = assets().find((f) => f.startsWith('styles.'));
    execFileSync('node', ['build.mjs'], { cwd: root('.'), stdio: 'pipe' });

    expect(assets().find((f) => f.startsWith('styles.'))).toBe(before);
  });

  it('해시된 styles가 해시된 semantic token 파일을 import한다', () => {
    const styleName = assets().find((f) => /^styles\.[0-9a-f]{8}\.css$/.test(f));
    const tokenName = assets().find((f) => /^tokens\.[0-9a-f]{8}\.css$/.test(f));
    const builtStyles = readFileSync(root(`dist/assets/${styleName}`), 'utf-8');

    expect(tokenName).toBeTruthy();
    expect(builtStyles).toContain(`@import url("./${tokenName}")`);
    expect(builtStyles).not.toContain('@import url("./tokens.css")');
  });
});
