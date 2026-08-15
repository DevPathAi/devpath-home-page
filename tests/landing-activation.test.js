// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = (path) => resolve(process.cwd(), path);
const read = (path) => readFileSync(root(path), 'utf-8');
const html = read('index.html');
const styles = read('assets/styles.css');
const main = read('src/main.js');
const document = new DOMParser().parseFromString(html, 'text/html');

const DIAGNOSTIC_URL = 'https://app.leva.ai.kr/diagnostic';

describe('Mission Spine 랜딩 활성화 계약', () => {
  it('모든 1차 진단 CTA가 같은 문구와 canonical 진단 경로를 쓴다', () => {
    const ctas = [...document.querySelectorAll('[data-diagnostic-cta="primary"]')];

    expect(ctas.length).toBeGreaterThanOrEqual(4);
    expect(ctas.map((cta) => cta.textContent.trim()))
      .toEqual(ctas.map(() => '가입 없이 진단 시작'));
    expect(ctas.map((cta) => cta.getAttribute('href')))
      .toEqual(ctas.map(() => DIAGNOSTIC_URL));
  });

  it('측정 전 시간 약속 대신 15문항·로그인 시점·산출물을 명시한다', () => {
    const visibleCopy = document.body.textContent.replace(/\s+/g, ' ');

    expect(visibleCopy).toContain('15문항');
    expect(visibleCopy).toContain('결과를 저장할 때만 로그인');
    expect(visibleCopy).toContain('12주 학습 경로');
    expect(visibleCopy).toContain('오늘의 미션');
    expect(visibleCopy).not.toContain('20초');
    expect(visibleCopy).not.toMatch(/(?:약\s*)?\d+\s*분|몇\s*분/);
  });

  it('canned quiz 대신 앱 LearningPath 구조를 따르는 sample Outcome Preview를 노출한다', () => {
    const preview = document.querySelector('[data-fixture-schema="learning-path.v1"]');
    const fields = [...preview.querySelectorAll('[data-field]')]
      .map((node) => node.dataset.field);

    expect(preview.textContent).toContain('예시 결과');
    expect(fields).toEqual([
      'diagnosis.diagnosedLevel',
      'milestones[0]',
      'milestones[0].tasks[2]',
      'context',
    ]);
    expect(preview.textContent).toContain('비동기 기초');
    expect(preview.textContent).toContain('에러 처리 패턴 적용');
    expect(preview.textContent).toContain('현재 목표');
    expect(preview.textContent).toContain('최근 학습');
    expect(main).not.toContain("'mini-diagnostic':");
    expect(existsSync(root('src/widgets/mini-diagnostic.js'))).toBe(false);
  });

  it('약어보다 사용자 언어를 먼저 쓰고 실제 경로 링크를 제공한다', () => {
    const visibleCopy = document.body.textContent.replace(/\s+/g, ' ');
    const plainLanguage = visibleCopy.indexOf('현재 목표와 최근 학습을 함께 전달');
    const abbreviation = visibleCopy.indexOf('학습 맥락(LCS)');
    const secondary = document.querySelector('.hero__actions .btn-secondary');

    expect(plainLanguage).toBeGreaterThanOrEqual(0);
    expect(abbreviation).toBeGreaterThan(plainLanguage);
    expect(secondary.textContent.trim()).toBe('실제 12주 경로 보기');
    expect(secondary.getAttribute('href')).toBe('#path-preview');
  });

  it('수치가 없는 정적 fallback 제목과 실제 2-tier 가격을 유지한다', () => {
    expect(document.querySelector('.traction__title').textContent.trim())
      .toBe('베타 진행 상황');
    expect(document.querySelectorAll('.pricing__tier')).toHaveLength(2);
    expect(document.querySelector('#pricing').textContent).toContain('0원');
    expect(document.querySelector('#pricing').textContent).toContain('9,900원');
  });

  it('모바일 header가 44px menu와 보조 navigation의 no-JS fallback을 가진다', () => {
    const details = document.querySelector('details.mobile-nav');
    const summary = details?.querySelector('summary.mobile-nav__toggle');
    const labels = [...details.querySelectorAll('nav a')].map((link) => link.textContent.trim());

    expect(summary).not.toBeNull();
    expect(labels).toEqual(expect.arrayContaining(['작동 방식', '실제 경로', '요금', '개발 기록', '소개']));
    expect(styles).toMatch(/\.mobile-nav__toggle\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  });

  it('semantic token stylesheet를 먼저 읽고 styles.css는 값 재정의 없이 소비한다', () => {
    const tokenLink = html.indexOf('/assets/tokens.css');
    const stylesLink = html.indexOf('/assets/styles.css');

    expect(tokenLink).toBeGreaterThan(-1);
    expect(stylesLink).toBeGreaterThan(tokenLink);
    expect(styles).toContain('var(--dp-color-bg)');
    expect(styles).toContain('var(--dp-space-lg)');
    expect(styles).not.toMatch(/--dp-[\w-]+\s*:/);
    expect(styles).not.toMatch(/--(?:indigo|slate|bg|surface|border|text|brand|space|radius|container|hairline)[\w-]*\s*:/);
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('작은 본문과 라벨에 저대비 faint 텍스트 토큰을 쓰지 않는다', () => {
    expect(styles).not.toContain('var(--dp-color-text-faint)');
  });

  it('네 window class 경계와 reduced-motion 규칙을 가진다', () => {
    expect(styles).toContain('@media (min-width: 600px)');
    expect(styles).toContain('@media (min-width: 840px)');
    expect(styles).toContain('@media (min-width: 1240px)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('업데이트 리드 폼은 진단 CTA보다 낮은 보조 action이다', () => {
    const lead = document.querySelector('#lead');
    const leadFormSource = read('src/widgets/lead-form.js');

    expect(lead.textContent).toContain('베타 업데이트');
    expect(lead.querySelector('.lead-form__fallback .btn-secondary')).not.toBeNull();
    expect(leadFormSource).toContain('btn btn-secondary lf-submit');
    expect(leadFormSource).not.toContain('btn btn-primary lf-submit');
  });
});
