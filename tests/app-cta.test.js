import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), 'utf-8');

const APP = 'https://app.leva.ai.kr/diagnostic';

// 게스트 진단은 앱에서 이미 동작한다(로그인 없이 앱을 열면 진단 화면이 뜬다).
// 그런데 랜딩의 모든 CTA가 이메일 폼으로 향해, 지금 써볼 수 있는 제품을
// 대기열 뒤에 숨기고 있었다(외부 리뷰 실측: 랜딩 HTML에 app.leva.ai.kr 0회).
// 「진단」을 약속하는 버튼은 진단으로 보내고, 「초대」는 이메일로 남긴다.
describe('진단 CTA는 앱으로 보낸다', () => {
  const html = read('index.html');

  it('랜딩이 앱을 가리킨다', () => {
    expect(html).toContain(APP);
  });

  it('히어로 1차 CTA가 앱으로 간다', () => {
    const hero = html.slice(html.indexOf('class="hero-actions"'), html.indexOf('class="hero-proof"'));

    expect(hero).toContain(`href="${APP}"`);
  });

  it('헤더 CTA가 앱으로 간다', () => {
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));

    expect(header).toContain(`href="${APP}"`);
  });

  it('요금의 AI 멘토 초대 CTA는 앱 로그인으로 간다', () => {
    const pricing = html.slice(html.indexOf('id="pricing"'), html.indexOf('id="faq"'));

    expect(pricing).toContain('href="https://app.leva.ai.kr/login"');
  });

  it('최종 진단 CTA가 앱으로 간다', () => {
    const finalCta = html.slice(html.indexOf('final-cta'), html.indexOf('</main>'));

    expect(finalCta).toContain(`href="${APP}"`);
  });
});

describe('AI 멘토 초대는 앱에서 신청한다', () => {
  const html = read('index.html');

  it('Home 리드폼 없이 로그인으로 직결한다', () => {
    expect(html).not.toContain('data-widget="lead-form"');
    expect(html).toContain('href="https://app.leva.ai.kr/login">AI 멘토 초대 신청</a>');
  });
});
