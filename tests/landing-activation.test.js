// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = (path) => resolve(process.cwd(), path);
const html = readFileSync(root('index.html'), 'utf8');
const tokensCss = readFileSync(root('assets/tokens.css'), 'utf8');
const document = new DOMParser().parseFromString(html, 'text/html');
const visibleCopy = document.body.textContent.replace(/\s+/g, ' ');
const DIAGNOSTIC_URL = 'https://app.leva.ai.kr/diagnostic';

describe('확정된 홈페이지 활성화 계약', () => {
  it('네 개의 1차 진단 CTA가 같은 문구와 앱 경로를 쓴다', () => {
    const ctas = [...document.querySelectorAll('[data-diagnostic-cta="primary"]')];
    expect(ctas).toHaveLength(4);
    expect(ctas.map((cta) => cta.textContent.trim())).toEqual(ctas.map(() => '가입 없이 진단 시작'));
    expect(ctas.every((cta) => cta.getAttribute('href') === DIAGNOSTIC_URL)).toBe(true);
  });

  it('진단 문항·로그인 시점·12주 경로·미션을 과장 없이 명시한다', () => {
    expect(visibleCopy).toContain('로그인 없이 15문항');
    expect(visibleCopy).toContain('12주 학습 경로');
    expect(visibleCopy).toContain('결과를 저장할 때 로그인');
    expect(visibleCopy).toContain('오늘 시작할 한 가지 미션');
    expect(visibleCopy).not.toMatch(/20초|(?:약\s*)?\d+\s*분|몇\s*분/);
  });

  it('내부 fixture 표기 없이 1·4·7·10주차를 보여 준다', () => {
    const roadmap = document.querySelector('.roadmap-grid');
    expect([...roadmap.querySelectorAll('.weeks')].map((node) => node.textContent.trim()))
      .toEqual(['WEEK 01', 'WEEK 04', 'WEEK 07', 'WEEK 10']);
    expect(roadmap.textContent).toContain('Spring Data JPA');
    expect(html).not.toMatch(/fixture|data-fixture-schema/i);
  });

  // 점검 H-2(B안): 생성 문장을 사람이 다듬었으므로 「실제 경로」로 표기하지 않는다.
  // 완료 조건은 미션과 다른, 관찰 가능한 결과물로 쓴다.
  it('12주 경로는 사람이 다듬은 예시로 표기하고 완료 조건이 관찰 가능하다', () => {
    const section = document.querySelector('section.roadmap');
    expect(section.querySelector('h2').textContent.trim()).toBe('12주 경로 예시');
    expect(section.textContent).toContain('백엔드 트랙의 경로 구성을 보여주는 예시입니다. 실제 내용은 진단 결과에 따라 달라집니다.');
    expect(section.textContent).not.toMatch(/실제 12주|실제 경로|Backend Spring 프로젝트를|향상시킵니다/);
    const phases = [...section.querySelectorAll('.road-phase')].map((phase) => ({
      title: phase.querySelector('h3').textContent.trim(),
      mission: phase.querySelector('.milestone b').textContent.trim(),
      done: phase.querySelector('.road-task').textContent.trim(),
    }));
    expect(phases).toEqual([
      { title: 'Spring Boot 프로젝트 시작', mission: '미션 · 프로젝트를 만들고 프로필별 설정을 나눕니다', done: '완료 조건 · 로컬에서 실행되고 /health 요청에 200이 반환됩니다' },
      { title: 'Spring Data JPA 쿼리', mission: '미션 · 조회 쿼리 3개를 작성하고 테스트합니다', done: '완료 조건 · 쿼리 테스트가 통과하고 N+1 발생 지점을 1곳 이상 고쳤습니다' },
      { title: '상태 점검과 관측', mission: '미션 · Actuator로 헬스 체크를 구성합니다', done: '완료 조건 · DB 연결이 끊기면 헬스 응답이 DOWN으로 바뀝니다' },
      { title: '리팩토링과 마무리', mission: '미션 · 테스트 결과를 근거로 3곳을 리팩토링합니다', done: '완료 조건 · 리팩토링 전후 테스트가 모두 통과합니다' },
    ]);
  });

  // 점검 H-4: 기록이 8월에 멈춰 「최신 3편」이 운영 중단처럼 읽혔다.
  it('개발 기록 섹션은 「최신」을 약속하지 않는다', () => {
    const records = document.querySelector('#records');
    expect(records.querySelector('h2').textContent.trim()).toBe('개발 기록');
    expect(records.textContent).not.toContain('최신 3편');
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

  it('semantic 팔레트 값을 재선언하지 않고 canonical token mirror를 소비한다', () => {
    expect(html).toContain('href="/assets/tokens.css"');
    expect(html).toContain('--ink: var(--dp-color-text-primary)');
    expect(html).toContain('--green: var(--dp-color-primary)');
    expect(html).toContain('--amber: var(--dp-color-warning)');
    expect(html).not.toMatch(/--(?:ink|green|amber):\s*#[0-9a-f]{6}/i);
    expect(tokensCss).toContain('--dp-color-primary: #5653E7');
  });

  it('Home 리드폼 없이 앱 로그인으로 AI 멘토 초대를 신청한다', () => {
    expect(document.querySelector('[data-widget="lead-form"]')).toBeNull();
    expect(document.querySelector('#pricing a[href="https://app.leva.ai.kr/login?intent=invite"]')).not.toBeNull();
  });
});
