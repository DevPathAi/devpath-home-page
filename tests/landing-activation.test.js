// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = (path) => resolve(process.cwd(), path);
const html = readFileSync(root('index.html'), 'utf8');
const document = new DOMParser().parseFromString(html, 'text/html');
const visibleCopy = document.body.textContent.replace(/\s+/g, ' ');
const DIAGNOSTIC_URL = 'https://app.leva.ai.kr/diagnostic';

describe('확정된 홈페이지 활성화 계약', () => {
  it('네 개의 1차 진단 CTA가 같은 문구와 앱 경로를 쓴다', () => {
    const ctas = [...document.querySelectorAll('[data-diagnostic-cta="primary"]')];
    expect(ctas).toHaveLength(4);
    expect(ctas.map((cta) => cta.textContent.trim())).toEqual(ctas.map(() => '가입 없이 진단 시작'));
    expect(ctas.map((cta) => cta.getAttribute('href'))).toEqual(ctas.map(() => DIAGNOSTIC_URL));
  });

  it('진단 문항·로그인 시점·12주 경로·미션을 과장 없이 명시한다', () => {
    expect(visibleCopy).toContain('로그인 없이 15문항');
    expect(visibleCopy).toContain('12주 학습 경로');
    expect(visibleCopy).toContain('결과를 저장할 때 로그인');
    expect(visibleCopy).toContain('오늘 시작할 한 가지 미션');
    expect(visibleCopy).not.toMatch(/20초|(?:약\s*)?\d+\s*분|몇\s*분/);
  });

  it('내부 fixture 표기 없이 실제 1·4·7·10주차를 보여 준다', () => {
    const roadmap = document.querySelector('.roadmap-grid');
    expect([...roadmap.querySelectorAll('.weeks')].map((node) => node.textContent.trim()))
      .toEqual(['WEEK 01', 'WEEK 04', 'WEEK 07', 'WEEK 10']);
    expect(roadmap.textContent).toContain('Spring Data JPA');
    expect(html).not.toMatch(/fixture|data-fixture-schema/i);
  });

  it('같은 질문 뒤에만 자동 첨부 맥락을 설명한다', () => {
    const comparison = document.querySelector('#lcs');
    expect(comparison.textContent).toContain('맥락 없이 물으면');
    expect(comparison.textContent).toContain('같은 질문을, 레바에서');
    expect(comparison.querySelector('.answer.before').textContent).not.toContain('자동 첨부된 맥락');
    expect(comparison.querySelector('.answer.after').textContent).toContain('자동 첨부된 맥락');
  });

  it('traction·비교 카드 없이 승인된 3행 가격표만 둔다', () => {
    expect(document.querySelector('#traction')).toBeNull();
    expect(document.querySelectorAll('#pricing .price-row')).toHaveLength(3);
    expect(document.querySelector('#pricing').textContent).toContain('무료 베타');
    expect(document.querySelector('#pricing').textContent).toContain('월 9,900원 예정');
  });

  it('모바일 메뉴는 44px control과 승인된 순서를 가진다', () => {
    const details = document.querySelector('details.mobile-nav');
    const labels = [...details.querySelectorAll('nav a:not(.btn)')].map((link) => link.textContent.trim());
    expect(details.querySelector('summary')).not.toBeNull();
    expect(labels).toEqual(['작동 방식', 'LCS', '요금', '개발 기록', '소개', '로그인']);
    expect(html).toMatch(/\.mobile-nav summary\s*\{[^}]*min-height:\s*44px/s);
  });

  it('승인 팔레트만 쓰고 갈색·크림 계열을 쓰지 않는다', () => {
    expect(html).toContain('--ink: #12231E');
    expect(html).toContain('--green: #1FA97A');
    expect(html).toContain('--amber: #F5A524');
    expect(html).not.toMatch(/#FDF1E0|#78350F|#F2D0A0|#2E2007/i);
  });

  it('Home 리드폼 없이 앱 로그인으로 AI 멘토 초대를 신청한다', () => {
    expect(document.querySelector('[data-widget="lead-form"]')).toBeNull();
    expect(document.querySelector('#pricing a[href="https://app.leva.ai.kr/login"]')).not.toBeNull();
  });
});
