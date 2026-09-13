import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectNotes, renderNote } from '../scripts/notes.mjs';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf-8');

const template = read('templates/note.html');

const NOTE = {
  slug: 'empty-response-reported-success',
  title: '빈 응답을 성공으로 보고하던 함수',
  description: '기록되지 않은 신청이 "성공"으로 보였다.',
  date: '2026-08-10',
  body: '## 증상\n\n한 줄이었다.\n',
};

// 개발 기록은 검색으로 들어오는 유일한 공개 콘텐츠인데, 읽고 나면 나갈 길이
// 「목록으로」밖에 없었다. 개별 글 10편이 아니라 템플릿 한 곳에 CTA를 둔다.
describe('개발 기록 CTA', () => {
  const html = renderNote(NOTE, template);

  it('제품 소개와 가입 없는 진단을 앱으로 보낸다', () => {
    expect(html).toContain('aria-label="레바 시작하기"');
    expect(html).toContain('<p class="eyebrow">이 글의 제품</p>');
    expect(html).toContain('레바는 사수 없는 0~3년차 개발자의 첫 AI 사수입니다.');
    expect(html).toContain('href="https://app.leva.ai.kr/diagnostic"');
    expect(html).toContain('가입 없이 진단 시작');
  });

  // 본문을 다 읽은 자리가 전환 의도가 가장 높다. 목록 링크보다 먼저 와야 한다.
  it('본문 끝, 목록 링크 앞에 놓인다', () => {
    expect(html.indexOf('note__cta')).toBeGreaterThan(html.indexOf('<h1>'));
    expect(html.indexOf('note__cta')).toBeLessThan(html.indexOf('note__back'));
  });

  it('진단을 주 CTA로 두고 초대 신청을 보조 링크로 남긴다', () => {
    const anchor = html.match(/<a[^>]*href="https:\/\/app\.leva\.ai\.kr\/diagnostic"[^>]*>([^<]*)<\/a>/);

    expect(anchor).not.toBeNull();
    expect(anchor[1]).toContain('가입 없이 진단 시작');
    expect(html).toContain('<a class="text-link" href="https://app.leva.ai.kr/login">AI 멘토 초대 신청</a>');
  });

  it('목록으로 돌아가는 길은 그대로 남는다', () => {
    expect(html).toContain('href="/notes/"');
  });
});

// 템플릿 한 곳을 고쳤으니 원고 전부에 실려야 한다. 템플릿만 단언하면
// 렌더 경로가 바뀌었을 때를 못 잡는다.
describe('원고 전체 반영', () => {
  const notes = collectNotes(root('content/notes'));

  it('원고가 하나 이상 있다', () => {
    expect(notes.length).toBeGreaterThan(0);
  });

  it('모든 글에 CTA가 실린다', () => {
    const missing = notes
      .filter((n) => !renderNote(n, template).includes('href="https://app.leva.ai.kr/diagnostic"'))
      .map((n) => n.slug);

    expect(missing).toEqual([]);
  });
});

describe('개발 기록 목록 CTA', () => {
  const indexTemplate = read('templates/notes-index.html');

  it('목록 마지막에도 같은 진단·초대 경로를 둔다', () => {
    expect(indexTemplate).toContain('aria-label="레바 시작하기"');
    expect(indexTemplate).toContain('href="https://app.leva.ai.kr/diagnostic"');
    expect(indexTemplate).toContain('href="https://app.leva.ai.kr/login"');
    expect(indexTemplate.indexOf('note__cta')).toBeLessThan(indexTemplate.indexOf('</main>'));
  });
});

describe('CTA 조판', () => {
  const css = read('assets/styles.css');

  it('note__cta 스타일이 있다', () => {
    expect(css).toMatch(/\.note__cta\s*\{/);
  });
});
