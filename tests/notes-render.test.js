import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { escapeHtml, renderNote, renderIndex } from '../scripts/notes.mjs';

const template = readFileSync(
  fileURLToPath(new URL('../templates/note.html', import.meta.url)),
  'utf-8',
);

const NOTE = {
  slug: 'empty-response-reported-success',
  title: '빈 응답을 성공으로 보고하던 함수',
  description: '기록되지 않은 신청이 "성공"으로 보였다.',
  date: '2026-08-10',
  body: '## 증상\n\n한 줄이었다.\n\n```js\nconst a = 1;\n```\n',
};

describe('escapeHtml', () => {
  it('HTML 특수문자를 이스케이프한다', () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;');
  });
});

describe('renderNote', () => {
  const html = renderNote(NOTE, template);

  it('제목과 날짜를 싣는다', () => {
    expect(html).toContain('<h1>빈 응답을 성공으로 보고하던 함수</h1>');
    expect(html).toContain('2026-08-10');
  });

  it('마크다운 본문을 HTML로 변환한다', () => {
    expect(html).toContain('<h2>증상</h2>');
    expect(html).toContain('<code');
  });

  // Pages가 .html을 떼는 clean URL로 308 리다이렉트한다.
  it('canonical이 확장자 없는 자기 URL을 가리킨다', () => {
    expect(html).toContain('<link rel="canonical" href="https://leva.ai.kr/notes/empty-response-reported-success" />');
    expect(html).not.toContain('.html"');
  });

  it('description의 따옴표가 속성을 깨뜨리지 않는다', () => {
    expect(html).toContain('content="기록되지 않은 신청이 &quot;성공&quot;으로 보였다."');
  });

  it('애드센스 스크립트는 넣되 광고 슬롯은 넣지 않는다', () => {
    expect(html).toContain('ca-pub-2785578834914321');
    expect(html).not.toContain('adsbygoogle"');
  });

  it('목록으로 돌아가는 링크가 있다', () => {
    expect(html).toContain('href="/notes"');
  });

  it('치환하지 못한 자리표시자가 남지 않는다', () => {
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe('아티클 조판', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../assets/styles.css', import.meta.url)),
    'utf-8',
  );

  // 코드블록의 긴 줄이 가로로 넘치면 모바일에서 페이지 전체가 밀린다.
  it('코드블록이 자기 안에서 가로 스크롤된다', () => {
    expect(css).toMatch(/\.note pre\s*\{[^}]*overflow-x:\s*auto/);
  });
});

describe('renderIndex', () => {
  const indexTemplate = readFileSync(
    fileURLToPath(new URL('../templates/notes-index.html', import.meta.url)),
    'utf-8',
  );
  const NOTES = [
    { ...NOTE, slug: 'newer', title: '나중 글', date: '2026-08-10' },
    { ...NOTE, slug: 'older', title: '먼저 글', date: '2026-08-01' },
  ];
  const html = renderIndex(NOTES, indexTemplate);

  it('모든 글로 가는 링크가 있다', () => {
    expect(html).toContain('href="/notes/newer"');
    expect(html).toContain('href="/notes/older"');
  });

  it('받은 순서를 그대로 유지한다', () => {
    expect(html.indexOf('/notes/newer')).toBeLessThan(html.indexOf('/notes/older'));
  });

  it('canonical이 /notes다', () => {
    expect(html).toContain('<link rel="canonical" href="https://leva.ai.kr/notes" />');
  });

  it('애드센스 스크립트는 넣되 광고 슬롯은 넣지 않는다', () => {
    expect(html).toContain('ca-pub-2785578834914321');
    expect(html).not.toContain('adsbygoogle"');
  });

  it('치환하지 못한 자리표시자가 남지 않는다', () => {
    expect(html).not.toMatch(/\{\{\w+\}\}/);
  });
});
